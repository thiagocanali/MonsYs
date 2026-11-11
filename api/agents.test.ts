import { beforeEach, describe, expect, it, vi } from 'vitest'

const { authPool, requireOrganizationAccess, issueAgentToken, client } = vi.hoisted(() => {
  const client = { query: vi.fn(), release: vi.fn() }
  return {
    authPool: { connect: vi.fn() },
    requireOrganizationAccess: vi.fn(),
    issueAgentToken: vi.fn(),
    client,
  }
})

vi.mock('../src/server/auth.js', () => ({ authPool }))
vi.mock('../src/server/tenant-auth.js', () => ({ requireOrganizationAccess }))
vi.mock('../src/server/agent-auth.js', () => ({ issueAgentToken }))

import { handler } from './agents.js'

const request = () => new Request('http://localhost/api/agents', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ organizationId: 'org-a', deviceId: 'device-a' }),
})

describe('agent provisioning transaction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireOrganizationAccess.mockResolvedValue({ session: { user: { id: 'user-a' } }, role: 'ADMIN' })
    authPool.connect.mockResolvedValue(client)
    client.query.mockImplementation(async (sql: string) => {
      if (sql.includes('INSERT INTO agents')) return { rows: [{ id: 'agent-uuid' }] }
      return { rows: [] }
    })
    issueAgentToken.mockResolvedValue('monsys_test_token')
  })

  it('commits the agent and credential together', async () => {
    const response = await handler(request())

    expect(response.status).toBe(201)
    expect(client.query).toHaveBeenCalledWith('BEGIN')
    expect(issueAgentToken).toHaveBeenCalledWith('agent-uuid', 'org-a', client)
    expect(client.query).toHaveBeenCalledWith('COMMIT')
    expect(client.release).toHaveBeenCalledOnce()
  })

  it('rolls back the agent insert when credential creation fails', async () => {
    issueAgentToken.mockRejectedValue(new Error('credential insert failed'))

    const response = await handler(request())

    expect(response.status).toBe(500)
    expect(client.query).toHaveBeenCalledWith('ROLLBACK')
    expect(client.query).not.toHaveBeenCalledWith('COMMIT')
    expect(client.release).toHaveBeenCalledOnce()
  })
})
