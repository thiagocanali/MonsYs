import { describe, expect, it } from 'vitest'
import { RuleEngine, createEvent, type Rule, type MetricSample, evaluateCondition } from './rules.js'

const baseRule: Rule = { id: 'r-1', name: 'CPU alta', metric: 'cpu_usage', operator: '>', threshold: 90, duration: 60, severity: 'WARNING' }
const sample = (value: number, seconds = 0): MetricSample => ({ metric: 'cpu_usage', value, timestamp: new Date(1_000_000 + seconds * 1000) })

describe('Rule Engine', () => {
  it.each([
    ['>', 91, 90, true], ['>', 90, 90, false], ['<', 89, 90, true], ['<', 90, 90, false],
    ['>=', 90, 90, true], ['<=', 90, 90, true], ['==', 90, 90, true], ['==', 91, 90, false],
  ] as const)('avalia o operador %s', (operator, value, threshold, expected) => {
    expect(evaluateCondition(operator, value, threshold)).toBe(expected)
  })

  it('exige a métrica correta', () => {
    const engine = new RuleEngine()
    expect(engine.evaluate(baseRule, { ...sample(95), metric: 'memory_usage' }).matched).toBe(false)
  })

  it('respeita duration antes de disparar', () => {
    const engine = new RuleEngine()
    expect(engine.evaluate(baseRule, sample(95)).matched).toBe(false)
    expect(engine.evaluate(baseRule, sample(95, 59)).matched).toBe(false)
    expect(engine.evaluate(baseRule, sample(95, 60)).matched).toBe(true)
  })

  it('reseta duration quando a condição deixa de ser satisfeita', () => {
    const engine = new RuleEngine()
    engine.evaluate(baseRule, sample(95))
    engine.evaluate(baseRule, sample(80, 30))
    expect(engine.evaluate(baseRule, sample(95, 60)).matched).toBe(false)
  })

  it.each(['INFO', 'WARNING', 'CRITICAL'] as const)('preserva severity %s no evento', severity => {
    const event = createEvent({ ...baseRule, severity }, 'org-1', 'device-1', sample(95))
    expect(event.severity).toBe(severity)
  })

  it('cria evento com contexto operacional', () => {
    const event = createEvent({ ...baseRule, duration: 0 }, 'org-1', 'device-1', sample(95))
    expect(event).toMatchObject({ organizationId: 'org-1', deviceId: 'device-1', ruleId: 'r-1', status: 'OPEN', title: 'CPU alta' })
  })
})
