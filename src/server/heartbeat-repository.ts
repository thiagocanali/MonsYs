import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import type { AgentHeartbeat } from '../domain/agent.js'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export interface HeartbeatAgent {
  id: string
  deviceId: string
  version: string
  connected: boolean
}

/**
 * Persist agent liveness and its three standard utilization samples atomically.
 * A failed telemetry insert must not leave the heartbeat partially recorded.
 */
export async function saveHeartbeat(agent: HeartbeatAgent, hostname: string, heartbeat: AgentHeartbeat & { organizationId: string }) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(
      `INSERT INTO agents (id, device_id, version, connected, hostname, last_seen_at)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (id) DO UPDATE SET
         version = EXCLUDED.version,
         connected = EXCLUDED.connected,
         hostname = EXCLUDED.hostname,
         last_seen_at = EXCLUDED.last_seen_at`,
      [agent.id, agent.deviceId, agent.version, agent.connected, hostname, heartbeat.timestamp],
    )

    const metrics = [
      ['cpu_usage', heartbeat.metrics.cpu],
      ['memory_usage', heartbeat.metrics.memory],
      ['disk_usage', heartbeat.metrics.disk],
    ] as const

    for (const [metric, value] of metrics) {
      await client.query(
        `INSERT INTO telemetry_samples
          (id, organization_id, device_id, metric, value, recorded_at)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [randomUUID(), heartbeat.organizationId, agent.deviceId, metric, value, heartbeat.timestamp],
      )
    }

    await client.query('COMMIT')
    return metrics.map(([metric, value]) => ({ metric, value, recordedAt: heartbeat.timestamp }))
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function closeHeartbeatPool() {
  await pool.end()
}
