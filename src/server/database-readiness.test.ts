import { describe, expect, it, vi } from 'vitest'
import { inspectDatabaseReadiness, READINESS_SQL, REQUIRED_TABLES } from './database-readiness.js'

function inventory() {
  return REQUIRED_TABLES.map(table_name => ({
    table_name, rls_enabled: true, browser_grants: false, server_access: true,
    columns: table_name === 'rule_evaluation_states'
      ? ['scope_key:text', 'state:jsonb', 'updated_at:timestamp with time zone'] : [],
    primary_key: table_name === 'rule_evaluation_states' ? ['scope_key'] : ['id'],
  }))
}
function inspect(rows: ReturnType<typeof inventory>) {
  return inspectDatabaseReadiness({ query: vi.fn().mockResolvedValue({ rows }) })
}

describe('database activation readiness', () => {
  it('uses a parameterized catalog-only query with no application row access', async () => {
    const query = vi.fn().mockResolvedValue({ rows: inventory() })
    await inspectDatabaseReadiness({ query })
    expect(query).toHaveBeenCalledExactlyOnceWith(READINESS_SQL, [[...REQUIRED_TABLES]])
    expect(READINESS_SQL).toMatch(/FROM pg_class c JOIN pg_namespace n/)
    expect(READINESS_SQL).toMatch(/c\.relname = ANY\(\$1::text\[\]\)/)
    expect(READINESS_SQL).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE)\s+(?:INTO|TABLE|FROM|public\.)/i)
  })
  it('requires the durable table in addition to the existing foundation', async () => {
    const result = await inspect(inventory().filter(row => row.table_name !== 'rule_evaluation_states'))
    expect(result.ready).toBe(false)
    expect(result.missingTables).toEqual(['rule_evaluation_states'])
  })
  it('does not treat an empty database as ready', async () => {
    expect((await inspect([])).missingTables).toHaveLength(17)
  })
  it('accepts the complete backend-only baseline', async () => {
    expect((await inspect(inventory())).ready).toBe(true)
  })
  it('rejects public grants, disabled RLS and an unusable server role', async () => {
    const rows = inventory()
    rows[0].browser_grants = true
    rows[1].rls_enabled = false
    rows[2].server_access = false
    const result = await inspect(rows)
    expect(result.ready).toBe(false)
    expect(result.tablesWithBrowserGrants).toEqual(['user'])
    expect(result.tablesWithoutRls).toEqual(['session'])
    expect(result.tablesWithoutServerAccess).toEqual(['account'])
  })
  it('checks column types and the scope primary key, not only the table name', async () => {
    const rows = inventory()
    const state = rows.find(row => row.table_name === 'rule_evaluation_states')!
    state.columns = ['scope_key:text', 'state:text', 'updated_at:timestamp with time zone']
    expect((await inspect(rows)).ruleStateSchemaValid).toBe(false)
    state.columns[1] = 'state:jsonb'
    state.primary_key = ['scope_key', 'id']
    expect((await inspect(rows)).ruleStateSchemaValid).toBe(false)
  })
})
