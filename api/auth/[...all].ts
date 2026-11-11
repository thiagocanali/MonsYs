import { auth } from '../../../src/server/auth.js'

export default async function handler(request: Request): Promise<Response> {
  return auth.handler(request)
}
