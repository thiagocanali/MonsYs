import { betterAuth } from 'better-auth'
import { Pool } from 'pg'

export const authPool = new Pool({ connectionString: process.env.DATABASE_URL })

const exactOrigins = [
  'http://localhost:3000',
  process.env.V0_RUNTIME_URL,
  process.env.V0_DEV_APP_URL,
  process.env.V0_BUILD_URL,
  process.env.V0_SANDBOX_URL,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined,
].filter((origin): origin is string => Boolean(origin))

export const auth = betterAuth({
  database: authPool,
  emailAndPassword: { enabled: true },
  baseURL: process.env.BETTER_AUTH_URL
    ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined)
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined)
    ?? process.env.V0_RUNTIME_URL,
  trustedOrigins: exactOrigins,
  ...(process.env.NODE_ENV === 'development'
    ? {
        advanced: {
          defaultCookieAttributes: {
            sameSite: 'none' as const,
            secure: true,
          },
        },
      }
    : {}),
})

export type AuthSession = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>

export async function getSession(request: Request) {
  return auth.api.getSession({ headers: request.headers })
}
