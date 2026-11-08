# Better Auth schema generation and database inspection

**Purpose:** produce a version-matched Better Auth schema artifact and a read-only inventory of the target PostgreSQL database before any migration is designed or applied.

## Version and adapter

The lockfile currently resolves `better-auth@1.7.18`. The application config is `src/server/auth.ts` and passes a `pg.Pool` to Better Auth. Keep the CLI version aligned with the lockfile; do not use `@latest` for this baseline.

The CLI's `generate` command supports generating a Drizzle schema without connecting to the database. The repository already depends on `drizzle-orm`. From the repository root, run:

```bash
npx --yes auth@1.7.18 generate \
  --config ./src/server/auth.ts \
  --adapter drizzle \
  --dialect postgresql \
  --output ./tmp/better-auth-schema.ts \
  --yes
```

This command generates the Better Auth core schema required by the loaded configuration. It is an artifact for review, not a migration and not proof that the live database matches it. Inspect the generated file before deciding how to version or integrate it. Do not commit generated output until the team has reviewed naming, ID types, and compatibility with the existing custom `organizations` and `organization_members` tables.

The config constructs a PostgreSQL pool from `DATABASE_URL`. Drizzle schema generation is documented to work without a database connection, but the config itself is still loaded. Run this in a trusted environment and never print or share environment values.

## Read-only live database inventory

1. Open the SQL editor for the intended Supabase/PostgreSQL project.
2. Run the statements in [database-readonly-inspection.sql](./database-readonly-inspection.sql).
3. Export only the result sets (schemas, table/column metadata, constraints, indexes, and detected migration-table names).
4. Review the output locally before sharing. Remove database/project identifiers or any unrelated metadata you do not want to disclose.

The SQL reads PostgreSQL catalogs and `information_schema` only. It does not create, alter, insert, update, or delete objects or rows.

## Reconciliation rules

- Compare the generated Better Auth tables with actual table/column types and constraints.
- Compare operational tables with `database-schema-contract.md`.
- Identify whether the project has Supabase Auth tables, Better Auth tables, both, or neither; do not infer authentication ownership from the provider alone.
- Inspect migration history before preparing a migration.
- Treat existing user IDs, memberships, agents, and credentials as production data. Plan explicit reconciliation; never truncate or recreate them as a shortcut.
- Only after this review should additive migrations be drafted and tested against a disposable PostgreSQL database.

## What this procedure does not do

- It does not connect to or inspect the live database automatically.
- It does not run Better Auth's `migrate` command.
- It does not apply SQL or change Supabase project settings.
- It does not prove RLS is enabled or correctly enforced.
