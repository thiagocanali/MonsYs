import { describe, expect, it } from 'vitest'
import { getAgentStatus, validateHeartbeat } from './agent.js'

const payload = { deviceId: 'dev-1', hostname: 'host-1', agentVersion: '1.0.0', timestamp: new Date('2026-09-27T10:00:00Z'), metrics: { cpu: 20, memory: 30, disk: 40 } }

describe('agent heartbeat', () => {
  it('accepts valid telemetry', () => expect(validateHeartbeat(payload).status).toBe('ONLINE'))
  it('rejects invalid metric ranges', () => expect(() => validateHeartbeat({ ...payload, metrics: { ...payload.metrics, cpu: 101 } })).toThrow('cpu'))
  it('rejects missing identity', () => expect(() => validateHeartbeat({ ...payload, deviceId: '' })).toThrow('deviceId'))
  it('classifies freshness', () => {
    const now = new Date('2026-09-27T10:00:00Z')
    expect(getAgentStatus(new Date('2026-09-27T09:59:30Z'), now)).toBe('ONLINE')
    expect(getAgentStatus(new Date('2026-09-27T09:56:00Z'), now)).toBe('DEGRADED')
    expect(getAgentStatus(new Date('2026-09-27T09:50:00Z'), now)).toBe('OFFLINE')
  })
})
