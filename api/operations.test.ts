import { beforeEach, describe, expect, it, vi } from 'vitest'

const { requireOrganizationAccess, authenticateAgent, saveHeartbeat } = vi.hoisted(() => ({ requireOrganizationAccess: vi.fn(), authenticateAgent: vi.fn(), saveHeartbeat: vi.fn().mockResolvedValue([]) }))

vi.mock('../src/server/agent-auth.js', () => ({ authenticateAgent }))
vi.mock('../src/server/heartbeat-repository.js', () => ({ saveHeartbeat }))

vi.mock('../src/server/tenant-auth.js', () => ({
  requireOrganizationAccess,
}))

vi.mock('../src/server/operations-repository.js', () => ({
  getIncidentDetails: vi.fn(),
  listAuditLogs: vi.fn(),
  listIncidents: vi.fn().mockResolvedValue([]),
  listTelemetrySamples: vi.fn(),
  saveEventIncident: vi.fn(),
  saveTelemetrySample: vi.fn(),
}))

import handler from './operations.js'

describe('operations API authorization boundary', () => {
  beforeEach(() => {
    requireOrganizationAccess.mockReset()
    authenticateAgent.mockReset()
    saveHeartbeat.mockReset().mockResolvedValue([])
  })

  it('returns 401 before reading operation data without a session', async () => {
    requireOrganizationAccess.mockResolvedValue({
      response: Response.json({ error: 'Unauthorized' }, { status: 401 }),
    })

    const response = await handler(new Request('http://localhost/api/operations?organizationId=org-a'))

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
  })

  it('returns 403 for an authenticated user without organization membership', async () => {
    requireOrganizationAccess.mockResolvedValue({
      response: Response.json({ error: 'Forbidden' }, { status: 403 }),
    })

    const response = await handler(new Request('http://localhost/api/operations?organizationId=org-a'))

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'Forbidden' })
  })

  it('rejects a heartbeat without a valid agent credential', async () => {
    authenticateAgent.mockResolvedValue(null)

    const response = await handler(new Request('http://localhost/api/operations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'heartbeat', organizationId: 'org-a', deviceId: 'device-a', hostname: 'host-a', agentVersion: '1.0.0', metrics: { cpu: 1, memory: 2, disk: 3 } }),
    }))

    expect(response.status).toBe(401)
  })


  it('rejects a heartbeat when payload identity differs from the credential identity', async () => {
    authenticateAgent.mockResolvedValue({ agentId: 'agent-uuid', organizationId: 'org-a', deviceId: 'device-a' })

    const response = await handler(new Request('http://localhost/api/operations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-agent-token': 'monsys_test' },
      body: JSON.stringify({ type: 'heartbeat', organizationId: 'org-a', deviceId: 'device-b', hostname: 'host-a', agentVersion: '1.0.0', metrics: { cpu: 1, memory: 2, disk: 3 } }),
    }))

    expect(response.status).toBe(401)
  })

  it('persists heartbeat using the database agent ID resolved from its credential', async () => {
    authenticateAgent.mockResolvedValue({ agentId: 'agent-uuid', organizationId: 'org-a', deviceId: 'device-a' })

    const response = await handler(new Request('http://localhost/api/operations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-agent-token': 'monsys_test' },
      body: JSON.stringify({ type: 'heartbeat', organizationId: 'org-a', deviceId: 'device-a', hostname: 'host-a', agentVersion: '1.0.0', metrics: { cpu: 1, memory: 2, disk: 3 } }),
    }))

    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.agent.id).toBe('agent-uuid')
    expect(saveHeartbeat).toHaveBeenCalledWith(
      { id: 'agent-uuid', deviceId: 'device-a', version: '1.0.0', connected: true },
      'host-a',
      expect.objectContaining({ organizationId: 'org-a', metrics: { cpu: 1, memory: 2, disk: 3 } }),
    )
  })

  it('accepts a member and preserves the organization scope on reads', async () => {
    requireOrganizationAccess.mockResolvedValue({ session: { user: { id: 'user-a' } }, role: 'VIEWER' })

    const response = await handler(new Request('http://localhost/api/operations?organizationId=org-a'))

    expect(response.status).toBe(200)
    expect(requireOrganizationAccess).toHaveBeenCalledWith(expect.any(Request), 'org-a')
  })
})
