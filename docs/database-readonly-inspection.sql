-- MonsYs: read-only PostgreSQL schema inventory
-- Safe to run in the Supabase SQL editor. Catalog/information_schema reads only.
-- Review outputs before sharing; redact project/database identifiers if desired.

-- 1) Tables and columns outside PostgreSQL system schemas.
SELECT
  c.table_schema,
  c.table_name,
  c.ordinal_position,
  c.column_name,
  c.data_type,
  c.udt_name,
  c.is_nullable,
  c.column_default
FROM information_schema.columns AS c
WHERE c.table_schema NOT IN ('pg_catalog', 'information_schema')
  AND c.table_schema NOT LIKE 'pg_toast%'
ORDER BY c.table_schema, c.table_name, c.ordinal_position;

-- 2) Primary keys, unique constraints, foreign keys, and check constraints.
SELECT
  ns.nspname AS table_schema,
  tbl.relname AS table_name,
  con.conname AS constraint_name,
  CASE con.contype
    WHEN 'p' THEN 'PRIMARY KEY'
    WHEN 'u' THEN 'UNIQUE'
    WHEN 'f' THEN 'FOREIGN KEY'
    WHEN 'c' THEN 'CHECK'
    WHEN 'x' THEN 'EXCLUSION'
    ELSE con.contype::text
  END AS constraint_type,
  pg_get_constraintdef(con.oid, true) AS definition
FROM pg_constraint AS con
JOIN pg_class AS tbl ON tbl.oid = con.conrelid
JOIN pg_namespace AS ns ON ns.oid = tbl.relnamespace
WHERE ns.nspname NOT IN ('pg_catalog', 'information_schema')
  AND ns.nspname NOT LIKE 'pg_toast%'
ORDER BY ns.nspname, tbl.relname, con.conname;

-- 3) Index definitions for application schemas.
SELECT
  schemaname AS table_schema,
  tablename AS table_name,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
  AND schemaname NOT LIKE 'pg_toast%'
ORDER BY schemaname, tablename, indexname;

-- 4) Detect common migration-history tables without assuming one exists.
SELECT
  candidate.table_name,
  to_regclass(candidate.qualified_name) IS NOT NULL AS exists
FROM (VALUES
  ('supabase_migrations.schema_migrations', 'supabase_migrations.schema_migrations'),
  ('public.__drizzle_migrations', 'public.__drizzle_migrations'),
  ('public._prisma_migrations', 'public._prisma_migrations'),
  ('public.knex_migrations', 'public.knex_migrations'),
  ('public.sequelize_meta', 'public.sequelize_meta')
) AS candidate(table_name, qualified_name)
ORDER BY candidate.table_name;
