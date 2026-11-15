import { beforeEach, describe, expect, it, vi } from 'vitest'

const handleAuth = vi.fn()
vi.mock('../src/server/auth.js', () => ({ auth: { handler: handleAuth } }))

import { handler } from './auth.js'

beforeEach(() => handleAuth.mockReset())

describe('authentication API boundary', () => {
  it('preserves successful Better Auth responses and headers', async () => {
    const expected = Response.json({ user: { id: 'u1' } }, { status: 200, headers: { 'Set-Cookie': 'session=test; HttpOnly' } })
    handleAuth.mockResolvedValue(expected)
    const request = new Request('https://monsys.example/api/auth/get-session')
    expect(await handler(request)).toBe(expected)
    expect(handleAuth).toHaveBeenCalledWith(request)
  })

  it('preserves expected authentication failures', async () => {
    const expected = Response.json({ code: 'INVALID_EMAIL_OR_PASSWORD' }, { status: 401 })
    handleAuth.mockResolvedValue(expected)
    expect(await handler(new Request('https://monsys.example/api/auth/sign-in/email'))).toBe(expected)
  })

  it('returns a safe non-cacheable 503 when the auth handler throws', async () => {
    handleAuth.mockRejectedValue(new Error('DATABASE_URL=secret-value connection failed'))
    const response = await handler(new Request('https://monsys.example/api/auth/get-session'))
    expect(response.status).toBe(503)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    const body = await response.text()
    expect(body).toContain('temporarily unavailable')
    expect(body).not.toContain('secret-value')
    expect(body).not.toContain('DATABASE_URL')
  })
})
