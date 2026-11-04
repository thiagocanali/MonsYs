# Supabase database setup

MonsYs currently expects PostgreSQL through the `DATABASE_URL` environment variable.

## New project setup

1. Create a new Supabase project.
2. Open the SQL Editor.
3. Review and run the migration in `supabase/migrations/202611040001_initial_schema.sql`.
4. Configure the server-side `DATABASE_URL` using the connection string from Supabase. Prefer the provider-recommended connection mode for the deployment runtime.
5. Never expose the database connection string, service-role key, or other secrets in frontend variables or Git.

The migration bootstraps the demo tenant `acme` / `Acme Operations`, because the current UI sends `organizationId=acme`. This is only a development bootstrap value; replace it with a real tenant onboarding flow before multi-tenant production use.

## Important security status

This migration creates the initial tables and organization membership structure. It does not complete application authentication, tenant authorization, or Row Level Security. The current API still accepts caller-provided organization identifiers. Do not use this deployment with real customer data until API authentication, membership checks, tenant-scoped access, and security tests are implemented.

This migration is intended only for a new, empty Supabase project. Inspect existing databases before applying it.
