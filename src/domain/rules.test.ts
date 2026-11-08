import { describe, expect, it } from 'vitest'
import { InMemoryRuleEvaluationStateStore, RuleEngine, createEvent, type Rule, type MetricSample, evaluateCondition } from './rules.js'

const baseRule: Rule = { id: 'r-1', name: 'CPU alta', metric: 'cpu_usage', operator: '>', threshold: 90, duration: 60, severity: 'WARNING' }
const sample = (value: number, seconds = 0): MetricSample => ({ metric: 'cpu_usage', value, timestamp: new Date(1_000_000 + seconds * 1000) })

describe('Rule Engine', () => {
  it.each([
    ['>', 91, 90, true], ['>', 90, 90, false], ['<', 89, 90, true], ['<', 90, 90, false],
    ['>=', 90, 90, true], ['<=', 90, 90, true], ['==', 90, 90, true], ['==', 91, 90, false],
  ] as const)('avalia o operador %s', (operator, value, threshold, expected) => {
    expect(evaluateCondition(operator, value, threshold)).toBe(expected)
  })

  it('exige a métrica correta', async () => {
    const engine = new RuleEngine()
    expect((await engine.evaluate(baseRule, { ...sample(95), metric: 'memory_usage' })).matched).toBe(false)
  })

  it('reseta a janela quando chega uma amostra de outra métrica no mesmo escopo', async () => {
    const engine = new RuleEngine()
    await engine.evaluate(baseRule, sample(95), sample(95).timestamp, 'org:device:rule')
    const wrongMetric = { ...sample(95, 30), metric: 'memory_usage' }
    expect((await engine.evaluate(baseRule, wrongMetric, wrongMetric.timestamp, 'org:device:rule')).matched).toBe(false)
    expect((await engine.evaluate(baseRule, sample(95, 60), sample(95, 60).timestamp, 'org:device:rule')).matched).toBe(false)
  })

  it('reinicia a janela diante de amostra fora de ordem', async () => {
    const engine = new RuleEngine()
    await engine.evaluate(baseRule, sample(95, 60), sample(95, 60).timestamp, 'org:device:rule')
    const older = sample(95, 30)
    const evaluation = await engine.evaluate(baseRule, older, older.timestamp, 'org:device:rule')
    expect(evaluation.matched).toBe(false)
    expect(evaluation.activeSince).toEqual(older.timestamp)
  })

  it('rejeita amostras com valor não finito ou timestamp inválido', async () => {
    const engine = new RuleEngine()
    await expect(engine.evaluate(baseRule, { ...sample(Number.NaN) })).rejects.toThrow('finite number')
    await expect(engine.evaluate(baseRule, { ...sample(95), timestamp: new Date(Number.NaN) })).rejects.toThrow('valid date')
  })

  it('respeita duration antes de disparar', async () => {
    const engine = new RuleEngine()
    expect((await engine.evaluate(baseRule, sample(95))).matched).toBe(false)
    expect((await engine.evaluate(baseRule, sample(95, 59))).matched).toBe(false)
    expect((await engine.evaluate(baseRule, sample(95, 60))).matched).toBe(true)
  })

  it('isola duration por dispositivo quando a mesma regra é compartilhada', async () => {
    const engine = new RuleEngine()
    const first = new Date(1_000_000)
    const scopedRule = { ...baseRule }

    expect((await engine.evaluate(scopedRule, { metric: 'cpu_usage', value: 95, timestamp: first }, first, 'org-1:device-1:r-1')).matched).toBe(false)
    expect((await engine.evaluate(scopedRule, { metric: 'cpu_usage', value: 95, timestamp: new Date(1_030_000) }, new Date(1_030_000), 'org-1:device-2:r-1')).matched).toBe(false)
    expect((await engine.evaluate(scopedRule, { metric: 'cpu_usage', value: 95, timestamp: new Date(1_060_000) }, new Date(1_060_000), 'org-1:device-1:r-1')).matched).toBe(true)
  })

  it('dispara apenas uma vez enquanto a condição permanece satisfeita', async () => {
    const engine = new RuleEngine()
    const scope = 'org-1:device-1:r-1'

    expect((await engine.evaluate(baseRule, sample(95), sample(95).timestamp, scope)).matched).toBe(false)
    expect((await engine.evaluate(baseRule, sample(95, 60), sample(95, 60).timestamp, scope)).matched).toBe(true)
    const repeated = await engine.evaluate(baseRule, sample(95, 90), sample(95, 90).timestamp, scope)
    expect(repeated.matched).toBe(false)
    expect(repeated.reason).toContain('already triggered')
  })

  it('permite novo alerta depois que a condição é normalizada', async () => {
    const engine = new RuleEngine()
    const scope = 'org-1:device-1:r-1'

    await engine.evaluate(baseRule, sample(95), sample(95).timestamp, scope)
    expect((await engine.evaluate(baseRule, sample(95, 60), sample(95, 60).timestamp, scope)).matched).toBe(true)
    await engine.evaluate(baseRule, sample(80, 90), sample(80, 90).timestamp, scope)
    expect((await engine.evaluate(baseRule, sample(95, 120), sample(95, 120).timestamp, scope)).matched).toBe(false)
    expect((await engine.evaluate(baseRule, sample(95, 180), sample(95, 180).timestamp, scope)).matched).toBe(true)
  })

  it('reseta duration quando a condição deixa de ser satisfeita', async () => {
    const engine = new RuleEngine()
    await engine.evaluate(baseRule, sample(95))
    await engine.evaluate(baseRule, sample(80, 30))
    expect((await engine.evaluate(baseRule, sample(95, 60))).matched).toBe(false)
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


describe('Rule evaluation state store', () => {
  it('permite compartilhar o estado entre instâncias do engine', async () => {
    const store = new InMemoryRuleEvaluationStateStore()
    const firstEngine = new RuleEngine(store)
    const secondEngine = new RuleEngine(store)

    await firstEngine.evaluate(baseRule, sample(95), sample(95).timestamp, 'org-1:device-1:r-1')
    const evaluation = await secondEngine.evaluate(baseRule, sample(95, 60), sample(95, 60).timestamp, 'org-1:device-1:r-1')

    expect(evaluation.matched).toBe(true)
  })
})
