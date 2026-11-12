import { Pool } from 'pg'

// One bounded pool per function instance, shared by all repositories in it.
export const databasePool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 30_000,
  statement_timeout: 15_000,
})
// Idle connection failures must not terminate the function process.
databasePool.on('error', () => console.error('Database idle connection failed'))
