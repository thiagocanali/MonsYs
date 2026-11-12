import { randomUUID } from 'node:crypto'
import { issueAgentToken } from '../src/server/agent-auth.js'
import { authPool } from '../src/server/auth.js'
import { requireOrganizationAccess } from '../src/server/tenant-auth.js'

export async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 })

  try {
    const body: unknown = await request.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body)) return Response.json({ error: 'Request body must be a JSON object' }, { status: 400 })
    const payload = body as Record<string, unknown>
    const organizationId = typeof payload.organizationId === 'string' ? payload.organizationId.trim() : ''
    const deviceId = typeof payload.deviceId === 'string' ? payload.deviceId.trim() : ''
    if (!organizationId || !deviceId || organizationId.length > 200 || deviceId.length > 200) {
      return Response.json({ error: 'organizationId and deviceId are required and must contain at most 200 characters' }, { status: 400 })
    }

    const access = await requireOrganizationAccess(request, organizationId, ['ADMIN'])
    if ('response' in access) return access.response

    // Agent identity is globally unique; device IDs are only unique within an organization.
    // Never derive the database primary key from a caller-controlled device ID.
    const agentId = randomUUID()
    const client = await authPool.connect()

    try {
      await client.query('BEGIN')
      const agent = await client.query(
        `INSERT INTO agents (id, organization_id, device_id, version, connected, hostname, last_seen_at)
         VALUES ($1, $2, $3, 'pending', false, 'pending', NOW())
         RETURNING id`,
        [agentId, organizationId, deviceId],
      )
      const token = await issueAgentToken(agent.rows[0].id, organizationId, client)
      await client.query('COMMIT')
      return Response.json({ agentId: agent.rows[0].id, organizationId, deviceId, token }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
    } catch (error) {
      try {
        await client.query('ROLLBACK')
      } catch {
        // Preserve the original provisioning failure; the connection is released below.
      }
      if ((error as { code?: string }).code === '23505') return Response.json({ error: 'Device is already registered in this organization' }, { status: 409 })
      return Response.json({ error: 'Unable to provision agent credential' }, { status: 500 })
    } finally {
      client.release()
    }
  } catch {
    return Response.json({ error: 'Unable to provision agent credential' }, { status: 500 })
  }
}

export default { fetch: handler }
