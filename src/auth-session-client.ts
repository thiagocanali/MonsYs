export interface BrowserSession { user: { name: string; email: string } }

export async function fetchBrowserSession(): Promise<BrowserSession | null> {
  const response = await fetch('/api/auth/get-session', { credentials: 'include', cache: 'no-store' })
  if (!response.ok) throw new Error('Session lookup failed')
  const session: unknown = await response.json()
  if (session === null) return null
  if (!session || typeof session !== 'object' || !('user' in session)) throw new Error('Invalid session response')
  const user = session.user
  if (!user || typeof user !== 'object' || !('name' in user) || !('email' in user) || typeof user.name !== 'string' || typeof user.email !== 'string') {
    throw new Error('Invalid session user')
  }
  return session as BrowserSession
}

export async function revokeBrowserSession(): Promise<void> {
  const response = await fetch('/api/auth/sign-out', { method: 'POST', credentials: 'include' })
  if (!response.ok) throw new Error('Sign-out failed')
  const remaining = await fetchBrowserSession()
  if (remaining?.user) throw new Error('Session is still active')
}
