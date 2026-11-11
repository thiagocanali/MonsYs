import { ValidationError } from './validation.js'

export type AgentStatus = 'ONLINE' | 'DEGRADED' | 'OFFLINE'

export interface HeartbeatPayload {
  deviceId: string
  hostname: string
  agentVersion: string
  timestamp: Date
  metrics: { cpu: number; memory: number; disk: number }
}

export interface AgentHeartbeat extends HeartbeatPayload {
  status: AgentStatus
}

export function validateHeartbeat(payload: HeartbeatPayload): AgentHeartbeat {
  if ([payload.deviceId, payload.hostname, payload.agentVersion].some(value => typeof value !== 'string' || !value.trim() || value.length > 200)) throw new ValidationError('deviceId, hostname and agentVersion are required')
  if (!(payload.timestamp instanceof Date) || Number.isNaN(payload.timestamp.getTime())) throw new ValidationError('timestamp must be a valid date')
  if (!payload.metrics || typeof payload.metrics !== 'object' || Array.isArray(payload.metrics)) throw new ValidationError('cpu, memory and disk metrics are required')
  for (const name of ['cpu', 'memory', 'disk'] as const) {
    const value = payload.metrics[name]
    if (!Number.isFinite(value) || value < 0 || value > 100) throw new ValidationError(`${name} must be between 0 and 100`)
  }
  return { ...payload, status: 'ONLINE' }
}

export function getAgentStatus(lastSeenAt: Date, now = new Date()): AgentStatus {
  const age = now.getTime() - lastSeenAt.getTime()
  if (age <= 90_000) return 'ONLINE'
  if (age <= 300_000) return 'DEGRADED'
  return 'OFFLINE'
}
