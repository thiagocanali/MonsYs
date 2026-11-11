import { auth } from '../src/server/auth.js'

export async function handler(request: Request): Promise<Response> {
  return auth.handler(request)
}

export default { fetch: handler }
