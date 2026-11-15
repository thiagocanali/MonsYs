import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getSession, query, connect } = vi.hoisted(() => ({
  getSession: vi.fn(),
  query: vi.fn(),
  connect: vi.fn(),
}))

vi.mock('../src/server/auth.js', () => ({
  getSession,
  authPool: { query, connect },
}))

import { handler } from './organizations.js'

const request = (method = 'GET', body?: unknown) => new Request('https://monsys.example/api/organizations', {
  method,
  headers: { Origin: 'https://monsys.example', 'Content-Type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
})

beforeEach(() => {
  getSession.mockReset()
  query.mockReset()
  connect.mockReset()
  getSession.mockResolvedValue({ user: { id: 'user-1' } })
})

describe('organization API unavailable responses', () => {
  it('does not expose auth backend errors', async () => {
    getSession.mockRejectedValue(new Error('DATABASE_URL=private'))
    const response = await handler(request())
    expect(response.status).toBe(503)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.text()).not.toContain('private')
  })

  it('does not expose failed organization reads', async () => {
    query.mockRejectedValue(new Error('password=private'))
    const response = await handler(request())
    expect(response.status).toBe(503)
    expect(await response.text()).not.toContain('private')
  })

  it('does not expose connection failures during organization creation', async () => {
    connect.mockRejectedValue(new Error('host=private'))
    const response = await handler(request('POST', { name: 'Example', slug: 'example' }))
    expect(response.status).toBe(503)
    expect(await response.text()).not.toContain('private')
  })

  it('preserves duplicate-slug conflict when rollback itself fails', async () => {
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(Object.assign(new Error('duplicate key'), { code: '23505' }))
        .mockRejectedValueOnce(new Error('rollback unavailable')),
      release: vi.fn(),
    }
    connect.mockResolvedValue(client)
    const response = await handler(request('POST', { name: 'Example', slug: 'example' }))
    expect(response.status).toBe(409)
    expect(client.query).toHaveBeenCalledWith('ROLLBACK')
    expect(client.release).toHaveBeenCalledOnce()
    expect(await response.text()).not.toContain('rollback unavailable')
  })

  it('retains unauthorized responses', async () => {
    getSession.mockResolvedValue(null)
    expect((await handler(request())).status).toBe(401)
  })
})
