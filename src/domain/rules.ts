export const OPERATORS = ['>', '<', '>=', '<=', '=='] as const
export type Operator = (typeof OPERATORS)[number]
export type Severity = 'INFO' | 'WARNING' | 'CRITICAL'

export interface Rule { id: string; name: string; metric: string; operator: Operator; threshold: number; duration: number; severity: Severity; runbookId?: string }
export interface MetricSample { metric: string; value: number; timestamp: Date }
export interface RuleEvaluation { matched: boolean; activeSince?: Date; reason: string }

export interface RuleEvaluationState { activeSince?: Date; lastSampleAt?: Date; triggered: boolean }

/** Builds an unambiguous tenant/device/rule key for evaluation state. */
export function createRuleEvaluationScopeKey(organizationId: string, deviceId: string, ruleId: string): string {
  const parts = [organizationId, deviceId, ruleId]
  if (parts.some(part => !part.trim())) throw new Error('Organization, device and rule IDs are required for rule evaluation scope')
  return JSON.stringify(parts)
}

export interface RuleEvaluationStateMutation<T> {
  state: RuleEvaluationState | undefined
  result: T
}

/**
 * A store must serialize each transaction by scopeKey. PostgreSQL adapters must
 * hold a transaction-scoped database lock until the new state is saved.
 */
export interface RuleEvaluationStateStore {
  transact<T>(scopeKey: string, operation: (current: RuleEvaluationState | undefined) => RuleEvaluationStateMutation<T>): Promise<T>
  clear(scopeKey: string): Promise<void>
}

function cloneRuleEvaluationState(state: RuleEvaluationState | undefined): RuleEvaluationState | undefined {
  return state ? { ...state, activeSince: state.activeSince ? new Date(state.activeSince) : undefined, lastSampleAt: state.lastSampleAt ? new Date(state.lastSampleAt) : undefined } : undefined
}

export class InMemoryRuleEvaluationStateStore implements RuleEvaluationStateStore {
  private readonly states = new Map<string, RuleEvaluationState>()
  private readonly locks = new Map<string, Promise<void>>()

  private async exclusively<T>(scopeKey: string, operation: () => T | Promise<T>): Promise<T> {
    const previous = this.locks.get(scopeKey) ?? Promise.resolve()
    let release!: () => void
    const current = new Promise<void>(resolve => { release = resolve })
    this.locks.set(scopeKey, current)
    await previous
    try {
      return await operation()
    } finally {
      release()
      if (this.locks.get(scopeKey) === current) this.locks.delete(scopeKey)
    }
  }

  async transact<T>(scopeKey: string, operation: (current: RuleEvaluationState | undefined) => RuleEvaluationStateMutation<T>): Promise<T> {
    return this.exclusively(scopeKey, () => {
      const mutation = operation(cloneRuleEvaluationState(this.states.get(scopeKey)))
      if (mutation.state) this.states.set(scopeKey, cloneRuleEvaluationState(mutation.state)!)
      else this.states.delete(scopeKey)
      return mutation.result
    })
  }

  async clear(scopeKey: string): Promise<void> {
    await this.exclusively(scopeKey, () => { this.states.delete(scopeKey) })
  }
}
export interface Event { id: string; organizationId: string; deviceId: string; ruleId: string; severity: Severity; status: 'OPEN' | 'RESOLVED'; title: string; message: string; createdAt: Date; updatedAt: Date; resolvedAt?: Date }

export function validateRule(rule: Rule): void {
  if (!rule.id.trim()) throw new Error('Rule ID is required')
  if (!rule.name.trim() || !rule.metric.trim()) throw new Error('Rule name and metric are required')
  if (!OPERATORS.includes(rule.operator)) throw new Error(`Unsupported operator: ${rule.operator}`)
  if (!Number.isFinite(rule.threshold)) throw new Error('Threshold must be a finite number')
  if (!Number.isFinite(rule.duration) || rule.duration < 0) throw new Error('Duration must be a non-negative number')
  if (!['INFO', 'WARNING', 'CRITICAL'].includes(rule.severity)) throw new Error(`Unsupported severity: ${rule.severity}`)
}

export function validateMetricSample(sample: MetricSample): void {
  if (!sample.metric.trim()) throw new Error('Metric name is required')
  if (!Number.isFinite(sample.value)) throw new Error('Metric value must be a finite number')
  if (!(sample.timestamp instanceof Date) || Number.isNaN(sample.timestamp.getTime())) {
    throw new Error('Metric timestamp must be a valid date')
  }
}

export function evaluateCondition(operator: Operator, value: number, threshold: number): boolean {
  if (operator === '>') return value > threshold
  if (operator === '<') return value < threshold
  if (operator === '>=') return value >= threshold
  if (operator === '<=') return value <= threshold
  return value === threshold
}

export class RuleEngine {
  constructor(private readonly stateStore: RuleEvaluationStateStore = new InMemoryRuleEvaluationStateStore()) {}

  async evaluate(rule: Rule, sample: MetricSample, now = sample.timestamp, scopeKey = rule.id): Promise<RuleEvaluation> {
    validateRule(rule)
    validateMetricSample(sample)
    if (!(now instanceof Date) || Number.isNaN(now.getTime())) throw new Error('Evaluation time must be a valid date')
    return this.stateStore.transact<RuleEvaluation>(scopeKey, previousState => {
      if (sample.metric !== rule.metric) return { state: undefined, result: { matched: false, reason: 'Metric does not match rule' } }
      if (!evaluateCondition(rule.operator, sample.value, rule.threshold)) return { state: undefined, result: { matched: false, reason: 'Condition is not satisfied' } }

      // Out-of-order samples must not inherit a duration window from the future.
      const lastSampleAt = previousState?.lastSampleAt ?? previousState?.activeSince
      const isOutOfOrder = Boolean(lastSampleAt && sample.timestamp.getTime() < lastSampleAt.getTime())
      if (isOutOfOrder && previousState?.triggered) {
        return { state: previousState, result: { matched: false, activeSince: previousState.activeSince, reason: 'Out-of-order sample ignored; alert remains triggered' } }
      }

      const since = previousState?.activeSince && !isOutOfOrder ? previousState.activeSince : sample.timestamp
      const alreadyTriggered = previousState?.triggered ?? false
      const durationSatisfied = (now.getTime() - since.getTime()) / 1000 >= rule.duration
      const matched = durationSatisfied && !alreadyTriggered
      const state = { activeSince: since, lastSampleAt: sample.timestamp, triggered: alreadyTriggered || matched }
      const reason = matched
        ? 'Condition and duration are satisfied; alert triggered'
        : alreadyTriggered && durationSatisfied
          ? 'Condition remains satisfied; alert was already triggered'
          : 'Condition is satisfied but duration is not complete'
      return { state, result: { matched, activeSince: since, reason } }
    })
  }
  async clear(scopeKey: string): Promise<void> { await this.stateStore.clear(scopeKey) }
}

export function createEvent(rule: Rule, organizationId: string, deviceId: string, sample: MetricSample, id: string = crypto.randomUUID()): Event {
  validateRule(rule)
  validateMetricSample(sample)
  if (!organizationId.trim() || !deviceId.trim()) throw new Error('Organization and device are required')
  const now = sample.timestamp
  return { id, organizationId, deviceId, ruleId: rule.id, severity: rule.severity, status: 'OPEN', title: rule.name, message: `${sample.metric} ${rule.operator} ${rule.threshold} (observed: ${sample.value})`, createdAt: now, updatedAt: now }
}
