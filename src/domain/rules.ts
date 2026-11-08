export const OPERATORS = ['>', '<', '>=', '<=', '=='] as const
export type Operator = (typeof OPERATORS)[number]
export type Severity = 'INFO' | 'WARNING' | 'CRITICAL'

export interface Rule { id: string; name: string; metric: string; operator: Operator; threshold: number; duration: number; severity: Severity; runbookId?: string }
export interface MetricSample { metric: string; value: number; timestamp: Date }
export interface RuleEvaluation { matched: boolean; activeSince?: Date; reason: string }

export interface RuleEvaluationState { activeSince?: Date; triggered: boolean }

export interface RuleEvaluationStateStore {
  get(scopeKey: string): Promise<RuleEvaluationState | undefined>
  set(scopeKey: string, state: RuleEvaluationState): Promise<void>
  clear(scopeKey: string): Promise<void>
  clearAll(): Promise<void>
}

export class InMemoryRuleEvaluationStateStore implements RuleEvaluationStateStore {
  private readonly states = new Map<string, RuleEvaluationState>()

  async get(scopeKey: string): Promise<RuleEvaluationState | undefined> {
    const state = this.states.get(scopeKey)
    return state ? { ...state, activeSince: state.activeSince ? new Date(state.activeSince) : undefined } : undefined
  }

  async set(scopeKey: string, state: RuleEvaluationState): Promise<void> {
    this.states.set(scopeKey, { ...state, activeSince: state.activeSince ? new Date(state.activeSince) : undefined })
  }

  async clear(scopeKey: string): Promise<void> { this.states.delete(scopeKey) }
  async clearAll(): Promise<void> { this.states.clear() }
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
    if (sample.metric !== rule.metric) {
      await this.stateStore.clear(scopeKey)
      return { matched: false, reason: 'Metric does not match rule' }
    }
    if (!evaluateCondition(rule.operator, sample.value, rule.threshold)) {
      await this.stateStore.clear(scopeKey)
      return { matched: false, reason: 'Condition is not satisfied' }
    }
    const previousState = await this.stateStore.get(scopeKey)
    // Out-of-order samples must not inherit a duration window from the future.
    const isOutOfOrder = Boolean(previousState?.activeSince && sample.timestamp.getTime() < previousState.activeSince.getTime())
    const since = previousState?.activeSince && !isOutOfOrder
      ? previousState.activeSince
      : sample.timestamp
    const alreadyTriggered = isOutOfOrder ? false : previousState?.triggered ?? false
    const durationSatisfied = (now.getTime() - since.getTime()) / 1000 >= rule.duration
    const matched = durationSatisfied && !alreadyTriggered
    await this.stateStore.set(scopeKey, { activeSince: since, triggered: alreadyTriggered || matched })
    const reason = matched
      ? 'Condition and duration are satisfied; alert triggered'
      : alreadyTriggered && durationSatisfied
        ? 'Condition remains satisfied; alert was already triggered'
        : 'Condition is satisfied but duration is not complete'
    return { matched, activeSince: since, reason }
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
