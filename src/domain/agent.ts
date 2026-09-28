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
  if (!payload.deviceId || !payload.hostname || !payload.agentVersion) throw new Error('deviceId, hostname and agentVersion are required')
  if (!(payload.timestamp instanceof Date) || Number.isNaN(payload.timestamp.getTime())) throw new Error('timestamp must be a valid date')
  for (const [name, value] of Object.entries(payload.metrics)) {
    if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error(`${name} must be between 0 and 100`)
  }
  return { ...payload, status: 'ONLINE' }
}

export function getAgentStatus(lastSeenAt: Date, now = new Date()): AgentStatus {
  const age = now.getTime() - lastSeenAt.getTime()
  if (age <= 90_000) return 'ONLINE'
  if (age <= 300_000) return 'DEGRADED'
  return 'OFFLINE'
}
