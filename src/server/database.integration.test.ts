import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readFile, readdir } from 'node:fs/promises'
import { Pool } from 'pg'
import { RuleEngine, createRuleEvaluationScopeKey, type RuleEvaluationStateStore } from '../domain/rules.js'

const connectionString = process.env.TEST_DATABASE_URL
// Never infer a test target from production DATABASE_URL.
describe.skipIf(!connectionString)('PostgreSQL authenticated operational flow', () => {
  let pool: Pool
  let auth: typeof import('./auth.js')['auth']
  let organizations: typeof import('../../api/organizations.js')['handler']
  let agents: typeof import('../../api/agents.js')['handler']
  let operations: typeof import('../../api/operations.js')['handler']
  let close: () => Promise<void>
  let createPostgresStore: (pool: Pool) => RuleEvaluationStateStore = () => { throw new Error('PostgreSQL state store was not initialized') }
  const origin = 'http://localhost:3000'
  let cookie = ''
  let organizationId = ''
  let userId = ''
  let token = ''
  const request = (path: string, body?: unknown, credentials = cookie) => new Request(`${origin}/api/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', origin, cookie: credentials },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })

  beforeAll(async () => {
    const url = new URL(connectionString!)
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('Integration tests require disposable local PostgreSQL')
    process.env.DATABASE_URL = connectionString
    process.env.BETTER_AUTH_URL = origin
    process.env.BETTER_AUTH_SECRET = 'disposable-integration-test-secret-32-characters'
    pool = new Pool({ connectionString })
    await pool.query("DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$; DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;")
    const existing = await pool.query("SELECT count(*)::int AS count FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r'")
    if (existing.rows[0].count === 0) {
      const directory = new URL('../../database/migrations/', import.meta.url)
      for (const file of (await readdir(directory)).filter(file => file.endsWith('.sql')).sort()) {
        await pool.query(await readFile(new URL(file, directory), 'utf8'))
      }
    } else if (existing.rows[0].count !== 16) {
      // Any partially initialized database must fail fast instead of masking migration drift.
      throw new Error('Incomplete test database schema: expected an empty database or all 17 tables')
    }
    const requiredTables = await pool.query("SELECT to_regclass('public.agents') AS agents, to_regclass('public.session') AS session, to_regclass('public.rule_evaluation_states') AS rule_states")
    if (!requiredTables.rows[0].agents || !requiredTables.rows[0].session || !requiredTables.rows[0].rule_states) {
      throw new Error('Test database is missing required MonsYs tables')
    }
    const authModule = await import('./auth.js')
    auth = authModule.auth
    close = () => authModule.authPool.end()
    const { PostgresRuleEvaluationStateStore } = await import('./rule-evaluation-state-store.js')
    createPostgresStore = testPool => new PostgresRuleEvaluationStateStore(testPool)
    organizations = (await import('../../api/organizations.js')).handler
    agents = (await import('../../api/agents.js')).handler
    operations = (await import('../../api/operations.js')).handler
  })
  afterAll(async () => { await close?.(); await pool?.end() })

  it('signs up, persists tenant-scoped telemetry, and enforces human and agent access', async () => {
    const unique = crypto.randomUUID()
    const signup = await auth.handler(request('auth/sign-up/email', { name: 'Integration', email: `${unique}@example.test`, password: 'integration-password-123' }))
    expect(signup.status).toBe(200)
    cookie = signup.headers.getSetCookie().map(value => value.split(';')[0]).join('; ')
    userId = (await signup.json()).user.id
    const create = await organizations(request('organizations', { name: 'Integration', slug: unique }))
    expect(create.status).toBe(201)
    organizationId = (await create.json()).id
    const duplicate = await organizations(request('organizations', { name: 'Duplicate', slug: unique }))
    expect(duplicate.status).toBe(409)
    const invalid = await organizations(request('organizations', { name: 'Invalid', slug: 'INVALID SLUG' }))
    expect(invalid.status).toBe(400)
    const noSession = await organizations(request('organizations', { name: 'Unauthorized', slug: 'no-session' }, ''))
    expect(noSession.status).toBe(401)
    const memberships = await organizations(request('organizations'))
    expect(memberships.status).toBe(200)
    expect((await memberships.json()).some((item: { id: string; role: string }) => item.id === organizationId && item.role === 'ADMIN')).toBe(true)
    const provision = await agents(request('agents', { organizationId, deviceId: 'device' }))
    expect(provision.status).toBe(201)
    token = (await provision.json()).token
    const heartbeat = { type: 'heartbeat', organizationId, deviceId: 'device', hostname: 'host', agentVersion: '1.0', metrics: { cpu: 95, memory: 60, disk: 40 } }
    const authenticated = request('operations', heartbeat, '')
    authenticated.headers.set('x-agent-token', token)
    expect((await operations(authenticated)).status).toBe(200)
    const samples = await pool.query('SELECT metric FROM telemetry_samples WHERE organization_id = $1', [organizationId])
    expect(samples.rowCount).toBe(3)
    expect((await operations(request('operations', heartbeat, ''))).status).toBe(401)
    const otherOrg = await organizations(request('organizations', { name: 'Other', slug: `other-${unique}` }))
    const otherId = (await otherOrg.json()).id
    const forged = request('operations', { ...heartbeat, organizationId: otherId }, '')
    forged.headers.set('x-agent-token', token)
    expect((await operations(forged)).status).toBe(401)
    await expect(pool.query('INSERT INTO agent_credentials(id, agent_id, organization_id, token_hash) SELECT $1,id,$2,$3 FROM agents WHERE organization_id=$4', [crypto.randomUUID(), otherId, 'a'.repeat(64), organizationId])).rejects.toMatchObject({ code: '23503' })

    const rule = { id: 'cpu', name: 'CPU high', metric: 'cpu', operator: '>', threshold: 90, duration: 0, severity: 'WARNING' }
    const result = await operations(request('operations', { organizationId, deviceId: 'device', rule, sample: { metric: 'cpu', value: 95 } }))
    expect(result.status).toBe(201)
    const incidentId = (await result.json()).incident.id
    const detail = await operations(request(`operations?organizationId=${organizationId}&incidentId=${incidentId}`))
    expect(detail.status).toBe(200)
    expect((await detail.json()).timeline).toHaveLength(2)
    expect((await operations(request(`operations?organizationId=${otherId}&incidentId=${incidentId}`))).status).toBe(404)
    await pool.query("UPDATE organization_members SET role='VIEWER' WHERE organization_id=$1 AND user_id=$2", [organizationId, userId])
    expect((await agents(request('agents', { organizationId, deviceId: 'forbidden' }))).status).toBe(403)
    expect((await operations(request('operations', { type: 'telemetry', organizationId, deviceId: 'device', metric: 'cpu', value: 3 }))).status).toBe(403)
    expect((await operations(request(`operations?organizationId=${organizationId}`, undefined, ''))).status).toBe(401)
  })

  it('isolates organization memberships between independently authenticated users', async () => {
    const suffix = crypto.randomUUID()
    const first = await auth.handler(request('auth/sign-up/email', {
      name: 'Tenant A', email: `a-${suffix}@example.test`, password: 'integration-password-123',
    }, ''))
    expect(first.status).toBe(200)
    const firstCookie = first.headers.getSetCookie().map(value => value.split(';')[0]).join('; ')
    const firstOrg = await organizations(request('organizations', { name: 'Tenant A', slug: `a-${suffix}` }, firstCookie))
    expect(firstOrg.status).toBe(201)
    const firstId = (await firstOrg.json()).id

    const second = await auth.handler(request('auth/sign-up/email', {
      name: 'Tenant B', email: `b-${suffix}@example.test`, password: 'integration-password-123',
    }, ''))
    expect(second.status).toBe(200)
    const secondCookie = second.headers.getSetCookie().map(value => value.split(';')[0]).join('; ')
    const anonymousList = await organizations(request('organizations', undefined, ''))
    expect(anonymousList.status).toBe(401)
    const firstList = await organizations(request('organizations', undefined, firstCookie))
    expect(firstList.status).toBe(200)
    expect((await firstList.json()).some((item: { id: string }) => item.id === firstId)).toBe(true)
    const secondList = await organizations(request('organizations', undefined, secondCookie))
    expect(secondList.status).toBe(200)
    expect((await secondList.json()).some((item: { id: string }) => item.id === firstId)).toBe(false)
    expect((await agents(request('agents', { organizationId: firstId, deviceId: 'foreign-device' }, secondCookie))).status).toBe(403)
    expect((await operations(request(`operations?organizationId=${firstId}`, undefined, secondCookie))).status).toBe(403)
  })


  it('persists and serializes rule evaluation state across independent engine instances', async () => {
    const storeA = createPostgresStore(pool)
    const storeB = createPostgresStore(pool)
    const engineA = new RuleEngine(storeA)
    const engineB = new RuleEngine(storeB)
    const scope = createRuleEvaluationScopeKey(organizationId, 'durable-device', 'cpu-high')
    const rule = { id: 'cpu-high', name: 'CPU alta', metric: 'cpu_usage', operator: '>' as const, threshold: 90, duration: 60, severity: 'WARNING' as const }
    const start = new Date('2026-11-15T00:00:00.000Z')
    const first = { metric: 'cpu_usage', value: 95, timestamp: start }
    await engineA.evaluate(rule, first, start, scope)

    const thresholdTime = new Date(start.getTime() + 60_000)
    const threshold = { metric: 'cpu_usage', value: 95, timestamp: thresholdTime }
    const concurrent = await Promise.all([
      engineA.evaluate(rule, threshold, thresholdTime, scope),
      engineB.evaluate(rule, threshold, thresholdTime, scope),
    ])
    expect(concurrent.filter(result => result.matched)).toHaveLength(1)
    const persisted = await pool.query('SELECT state FROM public.rule_evaluation_states WHERE scope_key = $1', [scope])
    expect(persisted.rows[0]?.state).toMatchObject({ triggered: true })

    const restartedEngine = new RuleEngine(createPostgresStore(pool))
    const afterRestartTime = new Date(start.getTime() + 90_000)
    const afterRestart = await restartedEngine.evaluate(
      rule,
      { metric: 'cpu_usage', value: 95, timestamp: afterRestartTime },
      afterRestartTime,
      scope,
    )
    expect(afterRestart.matched).toBe(false)
    expect(afterRestart.reason).toContain('already triggered')

    await storeB.clear(scope)
    const resetTime = new Date(start.getTime() + 120_000)
    const afterClear = await engineA.evaluate(
      rule,
      { metric: 'cpu_usage', value: 95, timestamp: resetTime },
      resetTime,
      scope,
    )
    expect(afterClear.matched).toBe(false)
  })

  it('blocks browser database roles including sensitive auth records', async () => {
    const tables = await pool.query("SELECT relname, relrowsecurity FROM pg_class JOIN pg_namespace n ON n.oid=relnamespace WHERE n.nspname='public' AND relkind='r'")
    expect(tables.rows).toHaveLength(17)
    expect(tables.rows.every(table => table.relrowsecurity)).toBe(true)
    const publicGrants = await pool.query(`
      SELECT table_name, grantee, privilege_type
      FROM information_schema.role_table_grants
      WHERE table_schema = 'public'
        AND grantee IN ('PUBLIC', 'anon', 'authenticated')
    `)
    expect(publicGrants.rows).toEqual([])
    for (const role of ['anon', 'authenticated']) {
      const client = await pool.connect()
      try {
        await client.query(`SET ROLE ${role}`)
        await expect(client.query('SELECT * FROM public.session')).rejects.toMatchObject({ code: '42501' })
        await expect(client.query('SELECT * FROM public.incidents')).rejects.toMatchObject({ code: '42501' })
      } finally { await client.query('RESET ROLE'); client.release() }
    }
  })
})
