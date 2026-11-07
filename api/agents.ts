import { issueAgentToken } from '../src/server/agent-auth.js'
import { authPool } from '../src/server/auth.js'
import { requireOrganizationAccess } from '../src/server/tenant-auth.js'

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 })
  try {
    const body = await request.json() as { organizationId?: unknown; deviceId?: unknown }
    const organizationId = typeof body.organizationId === 'string' ? body.organizationId.trim() : ''
    const deviceId = typeof body.deviceId === 'string' ? body.deviceId.trim() : ''
    if (!organizationId || !deviceId) return Response.json({ error: 'organizationId and deviceId are required' }, { status: 400 })

    const access = await requireOrganizationAccess(request, organizationId, ['ADMIN'])
    if ('response' in access) return access.response

    const agent = await authPool.query(
      `INSERT INTO agents (id, device_id, version, connected, hostname, last_seen_at)
       VALUES ($1, $2, 'pending', false, 'pending', NOW())
       ON CONFLICT (id) DO UPDATE SET device_id = EXCLUDED.device_id
       RETURNING id`,
      [`agent-${deviceId}`, deviceId],
    )
    const token = await issueAgentToken(agent.rows[0].id, organizationId)
    return Response.json({ agentId: agent.rows[0].id, organizationId, token }, { status: 201 })
  } catch {
    return Response.json({ error: 'Unable to provision agent credential' }, { status: 500 })
  }
}
