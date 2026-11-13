import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchBrowserSession, revokeBrowserSession } from './auth-session-client.js'

afterEach(() => vi.unstubAllGlobals())

describe('browser session lifecycle', () => {
  it('accepts a confirmed user and includes cookies without caching', async () => {
    const request = vi.fn().mockResolvedValue(Response.json({ user: { name: 'Pessoa', email: 'pessoa@example.com' } }))
    vi.stubGlobal('fetch', request)
    expect(await fetchBrowserSession()).toEqual({ user: { name: 'Pessoa', email: 'pessoa@example.com' } })
    expect(request).toHaveBeenCalledWith('/api/auth/get-session', { credentials: 'include', cache: 'no-store' })
  })

  it('rejects unsuccessful or malformed session lookups instead of granting access', async () => {
    for (const response of [new Response(null, { status: 503 }), Response.json({ user: null }), Response.json({ unexpected: true })]) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))
      await expect(fetchBrowserSession()).rejects.toThrow()
    }
  })

  it('returns null for an unauthenticated session', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(null)))
    expect(await fetchBrowserSession()).toBeNull()
  })

  it('signs out with cookies and confirms the server invalidated the session', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(Response.json({ success: true }))
      .mockResolvedValueOnce(Response.json(null))
    vi.stubGlobal('fetch', request)
    await expect(revokeBrowserSession()).resolves.toBeUndefined()
    expect(request).toHaveBeenNthCalledWith(1, '/api/auth/sign-out', { method: 'POST', credentials: 'include' })
    expect(request).toHaveBeenNthCalledWith(2, '/api/auth/get-session', { credentials: 'include', cache: 'no-store' })
  })

  it('does not treat failed sign-out or still-active sessions as success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 })))
    await expect(revokeBrowserSession()).rejects.toThrow('Sign-out failed')
    const request = vi.fn().mockResolvedValueOnce(Response.json({ success: true }))
      .mockResolvedValueOnce(Response.json({ user: { name: 'Pessoa', email: 'pessoa@example.com' } }))
    vi.stubGlobal('fetch', request)
    await expect(revokeBrowserSession()).rejects.toThrow('Session is still active')
  })
})
