import { createHash, randomBytes } from 'node:crypto'
import type { PoolClient } from 'pg'
import { authPool } from './auth.js'

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export interface AuthenticatedAgent {
  agentId: string
  organizationId: string
  deviceId: string
}

export async function issueAgentToken(agentId: string, organizationId: string, client?: PoolClient) {
  const token = `monsys_${randomBytes(32).toString('base64url')}`
  const query = client ? client.query.bind(client) : authPool.query.bind(authPool)
  await query(
    'INSERT INTO agent_credentials (id, agent_id, organization_id, token_hash) VALUES ($1,$2,$3,$4)',
    [crypto.randomUUID(), agentId, organizationId, hashToken(token)],
  )
  return token
}

export async function authenticateAgent(
  request: Request,
  organizationId: string,
  deviceId: string,
): Promise<AuthenticatedAgent | null> {
  const authorization = request.headers.get('authorization')
  const token = request.headers.get('x-agent-token')
    ?? (authorization?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null)
  if (!token || !token.startsWith('monsys_')) return null

  const result = await authPool.query<{
    agent_id: string
    organization_id: string
    device_id: string
  }>(
    `SELECT c.agent_id, c.organization_id, a.device_id
       FROM agent_credentials c
       JOIN agents a ON a.id = c.agent_id AND a.organization_id = c.organization_id
      WHERE c.organization_id = $1
        AND a.device_id = $2
        AND c.token_hash = $3
        AND c.revoked_at IS NULL
        AND (c.expires_at IS NULL OR c.expires_at > NOW())
      LIMIT 1`,
    [organizationId, deviceId, hashToken(token)],
  )

  const agent = result.rows[0]
  if (!agent) return null

  return {
    agentId: agent.agent_id,
    organizationId: agent.organization_id,
    deviceId: agent.device_id,
  }
}
