import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 })

export default async function handler(): Promise<Response> {
  const startedAt = Date.now()
  try {
    await pool.query('SELECT 1')
    return Response.json({ status: 'ok', database: 'ok', latencyMs: Date.now() - startedAt, timestamp: new Date().toISOString() })
  } catch {
    return Response.json({ status: 'degraded', database: 'unavailable', latencyMs: Date.now() - startedAt, timestamp: new Date().toISOString() }, { status: 503 })
  }
}
