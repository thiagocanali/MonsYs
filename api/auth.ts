import { auth } from '../src/server/auth.js'

export async function handler(request: Request): Promise<Response> {
  try {
    return await auth.handler(request)
  } catch {
    // Never expose database details, credentials or stack traces to clients.
    return Response.json(
      { error: 'Authentication service temporarily unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}

export default { fetch: handler }
