import { databasePool as pool } from '../src/server/database.js'


export async function handler(): Promise<Response> {
  const startedAt = Date.now()
  try {
    await pool.query('SELECT 1')
    return Response.json({ status: 'ok', database: 'ok', latencyMs: Date.now() - startedAt, timestamp: new Date().toISOString() })
  } catch {
    return Response.json({ status: 'degraded', database: 'unavailable', latencyMs: Date.now() - startedAt, timestamp: new Date().toISOString() }, { status: 503 })
  }
}

export default { fetch: handler }
