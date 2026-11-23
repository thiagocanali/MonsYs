import type { Pool } from 'pg'

export const REQUIRED_TABLES = [
  'user', 'session', 'account', 'verification', 'organizations', 'organization_members',
  'agents', 'agent_credentials', 'telemetry_samples', 'events', 'incidents',
  'timeline_entries', 'runbooks', 'actions', 'action_results', 'audit_logs',
  'rule_evaluation_states',
] as const

/** Catalogs only: this check never reads application records or changes schema. */
export const READINESS_SQL = `
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled,
       EXISTS (
         SELECT 1 FROM aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) acl
         WHERE acl.grantee = 0
       ) OR EXISTS (
         SELECT 1 FROM pg_roles browser_role
          WHERE browser_role.rolname IN ('anon', 'authenticated')
            AND has_table_privilege(browser_role.oid, c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
       ) AS browser_grants,
       (SELECT bool_and(has_table_privilege(c.oid, privilege))
          FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE']) privilege)
       AND (NOT c.relrowsecurity OR r.rolsuper OR r.rolbypassrls
            OR (c.relowner = r.oid AND NOT c.relforcerowsecurity)) AS server_access,
       ARRAY(SELECT a.attname::text || ':' || format_type(a.atttypid, a.atttypmod)
               FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
               ORDER BY a.attnum) AS columns,
       ARRAY(SELECT a.attname::text FROM pg_constraint p
               JOIN pg_attribute a ON a.attrelid = p.conrelid AND a.attnum = ANY(p.conkey)
               WHERE p.conrelid = c.oid AND p.contype = 'p' ORDER BY a.attname) AS primary_key
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_roles r ON r.rolname = current_user
 WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND c.relname = ANY($1::text[])
 ORDER BY c.relname`

interface TableInventory {
  table_name: string
  rls_enabled: boolean
  browser_grants: boolean
  server_access: boolean
  columns: string[]
  primary_key: string[]
}

export interface DatabaseReadiness {
  ready: boolean
  checkedTables: number
  missingTables: string[]
  tablesWithoutRls: string[]
  tablesWithBrowserGrants: string[]
  tablesWithoutServerAccess: string[]
  ruleStateSchemaValid: boolean
}

export async function inspectDatabaseReadiness(pool: Pick<Pool, 'query'>): Promise<DatabaseReadiness> {
  const result = await pool.query<TableInventory>(READINESS_SQL, [[...REQUIRED_TABLES]])
  const inventory = new Map(result.rows.map(row => [row.table_name, row]))
  const missingTables = REQUIRED_TABLES.filter(name => !inventory.has(name))
  const tablesWithoutRls = result.rows.filter(row => !row.rls_enabled).map(row => row.table_name)
  const tablesWithBrowserGrants = result.rows.filter(row => row.browser_grants).map(row => row.table_name)
  const tablesWithoutServerAccess = result.rows.filter(row => !row.server_access).map(row => row.table_name)
  const state = inventory.get('rule_evaluation_states')
  const ruleStateSchemaValid = Boolean(state
    && ['scope_key:text', 'state:jsonb', 'updated_at:timestamp with time zone'].every(column => state.columns.includes(column))
    && state.primary_key.length === 1 && state.primary_key[0] === 'scope_key')
  return {
    ready: !missingTables.length && !tablesWithoutRls.length && !tablesWithBrowserGrants.length
      && !tablesWithoutServerAccess.length && ruleStateSchemaValid,
    checkedTables: result.rows.length,
    missingTables, tablesWithoutRls, tablesWithBrowserGrants, tablesWithoutServerAccess, ruleStateSchemaValid,
  }
}
