export const OPERATORS = ['>', '<', '>=', '<=', '=='] as const
export type Operator = (typeof OPERATORS)[number]
export type Severity = 'INFO' | 'WARNING' | 'CRITICAL'

export interface Rule { id: string; name: string; metric: string; operator: Operator; threshold: number; duration: number; severity: Severity; runbookId?: string }
export interface MetricSample { metric: string; value: number; timestamp: Date }
export interface RuleEvaluation { matched: boolean; activeSince?: Date; reason: string }
export interface Event { id: string; organizationId: string; deviceId: string; ruleId: string; severity: Severity; status: 'OPEN' | 'RESOLVED'; title: string; message: string; createdAt: Date; updatedAt: Date; resolvedAt?: Date }

export function validateRule(rule: Rule): void {
  if (!rule.name.trim() || !rule.metric.trim()) throw new Error('Rule name and metric are required')
  if (!OPERATORS.includes(rule.operator)) throw new Error(`Unsupported operator: ${rule.operator}`)
  if (!Number.isFinite(rule.threshold)) throw new Error('Threshold must be a finite number')
  if (!Number.isFinite(rule.duration) || rule.duration < 0) throw new Error('Duration must be a non-negative number')
  if (!['INFO', 'WARNING', 'CRITICAL'].includes(rule.severity)) throw new Error(`Unsupported severity: ${rule.severity}`)
}

export function evaluateCondition(operator: Operator, value: number, threshold: number): boolean {
  if (operator === '>') return value > threshold
  if (operator === '<') return value < threshold
  if (operator === '>=') return value >= threshold
  if (operator === '<=') return value <= threshold
  return value === threshold
}

export class RuleEngine {
  private readonly activeSince = new Map<string, Date>()
  evaluate(rule: Rule, sample: MetricSample, now = sample.timestamp, scopeKey = rule.id): RuleEvaluation {
    validateRule(rule)
    if (sample.metric !== rule.metric) return { matched: false, reason: 'Metric does not match rule' }
    if (!evaluateCondition(rule.operator, sample.value, rule.threshold)) { this.activeSince.delete(scopeKey); return { matched: false, reason: 'Condition is not satisfied' } }
    const since = this.activeSince.get(scopeKey) ?? sample.timestamp
    this.activeSince.set(scopeKey, since)
    const matched = (now.getTime() - since.getTime()) / 1000 >= rule.duration
    return { matched, activeSince: since, reason: matched ? 'Condition and duration are satisfied' : 'Condition is satisfied but duration is not complete' }
  }
  clear(ruleId: string): void { this.activeSince.delete(ruleId) }
}

export function createEvent(rule: Rule, organizationId: string, deviceId: string, sample: MetricSample, id: string = crypto.randomUUID()): Event {
  const now = sample.timestamp
  return { id, organizationId, deviceId, ruleId: rule.id, severity: rule.severity, status: 'OPEN', title: rule.name, message: `${sample.metric} ${rule.operator} ${rule.threshold} (observed: ${sample.value})`, createdAt: now, updatedAt: now }
}
