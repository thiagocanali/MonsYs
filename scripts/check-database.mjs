import { Pool } from 'pg'
import { inspectDatabaseReadiness } from '../src/server/database-readiness.ts'

// Supply the target explicitly. Do not load or infer a production .env file.
if (!process.env.DATABASE_CHECK_URL) {
  console.error('Set DATABASE_CHECK_URL to the intended staging connection using your secret manager.')
  process.exitCode = 2
} else {
  const pool = new Pool({
    connectionString: process.env.DATABASE_CHECK_URL,
    max: 1, connectionTimeoutMillis: 5_000, statement_timeout: 10_000,
  })
  pool.on('error', () => console.error('Database readiness connection failed'))
  try {
    const result = await inspectDatabaseReadiness(pool)
    console.log(JSON.stringify(result, null, 2))
    process.exitCode = result.ready ? 0 : 1
  } catch {
    // Driver errors may contain connection details. Never print them or the URL.
    console.error('Unable to inspect database readiness. Verify connectivity and catalog permissions.')
    process.exitCode = 2
  } finally { await pool.end() }
}
