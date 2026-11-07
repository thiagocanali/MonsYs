import { beforeEach, describe, expect, it, vi } from 'vitest'

const { requireOrganizationAccess } = vi.hoisted(() => ({ requireOrganizationAccess: vi.fn() }))

vi.mock('../src/server/tenant-auth.js', () => ({
  requireOrganizationAccess,
}))

vi.mock('../src/server/operations-repository.js', () => ({
  getIncidentDetails: vi.fn(),
  listAuditLogs: vi.fn(),
  listIncidents: vi.fn().mockResolvedValue([]),
  listTelemetrySamples: vi.fn(),
  saveAgent: vi.fn(),
  saveEventIncident: vi.fn(),
  saveTelemetrySample: vi.fn(),
}))

import handler from './operations.js'

describe('operations API authorization boundary', () => {
  beforeEach(() => {
    requireOrganizationAccess.mockReset()
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

  it('accepts a member and preserves the organization scope on reads', async () => {
    requireOrganizationAccess.mockResolvedValue({ session: { user: { id: 'user-a' } }, role: 'VIEWER' })

    const response = await handler(new Request('http://localhost/api/operations?organizationId=org-a'))

    expect(response.status).toBe(200)
    expect(requireOrganizationAccess).toHaveBeenCalledWith(expect.any(Request), 'org-a')
  })
})
