import { createHash, randomBytes } from 'node:crypto'
import { authPool } from './auth.js'

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function issueAgentToken(agentId: string, organizationId: string) {
  const token = `monsys_${randomBytes(32).toString('base64url')}`
  await authPool.query(
    'INSERT INTO agent_credentials (id, agent_id, organization_id, token_hash) VALUES ($1,$2,$3,$4)',
    [crypto.randomUUID(), agentId, organizationId, hashToken(token)],
  )
  return token
}

export async function authenticateAgent(request: Request, organizationId: string, deviceId: string) {
  const token = request.headers.get('x-agent-token') ?? request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return false

  const result = await authPool.query(
    `SELECT 1 FROM agent_credentials c JOIN agents a ON a.id = c.agent_id
     WHERE c.organization_id = $1 AND a.device_id = $2 AND c.token_hash = $3
       AND c.revoked_at IS NULL AND (c.expires_at IS NULL OR c.expires_at > NOW()) LIMIT 1`,
    [organizationId, deviceId, hashToken(token)],
  )
  return result.rowCount === 1
}
