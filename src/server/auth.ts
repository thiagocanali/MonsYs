import { betterAuth } from 'better-auth'
import { databasePool } from './database.js'

export const authPool = databasePool

const exactOrigins = [
  ...(process.env.NODE_ENV === 'production' ? [] : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5173', 'http://127.0.0.1:5173']),
  process.env.BETTER_AUTH_URL,
  process.env.V0_RUNTIME_URL,
  process.env.V0_DEV_APP_URL,
  process.env.V0_BUILD_URL,
  process.env.V0_SANDBOX_URL,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined,
].filter((origin): origin is string => Boolean(origin))

export const auth = betterAuth({
  database: authPool,
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
  baseURL: process.env.BETTER_AUTH_URL
    ?? (process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined)
    ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined)
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined)
    ?? process.env.V0_RUNTIME_URL,
  trustedOrigins: exactOrigins,
})

export type AuthSession = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>

export async function getSession(request: Request) {
  return auth.api.getSession({ headers: request.headers })
}
