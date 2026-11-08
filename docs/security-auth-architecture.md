# MonsYs — Authentication, tenant security and database readiness

## Current implementation status

Reviewed against `main` after PRs #15 and #16 (2026-11-08).

Implemented in application code:
- Better Auth email/password authentication backed by PostgreSQL through `DATABASE_URL`.
- Session resolution through the shared `getSession` helper.
- Organization membership and role checks through `requireOrganizationAccess`.
- Organization creation and ADMIN membership assignment in one transaction.
- Agent credentials are high-entropy tokens; only SHA-256 hashes are persisted.
- Agent credentials are bound to organization and device identity; heartbeat persistence uses the authenticated agent ID.
- Agent registration and credential insertion are atomic.
- CI runs backend typecheck, Vitest, and Vite production build.

Not yet proven or production-ready:
- The live PostgreSQL schema has not been inspected.
- Better Auth schema has not been generated/applied against the actual database in this workflow.
- No reproducible current migration baseline exists on `main`.
- Cross-tenant database constraints and RLS are not implemented/verified.
- The Vercel deployment preview may be rate-limited independently of CI.
- The Windows Go agent and end-to-end heartbeat-to-event flow are not implemented.

## Human identity and authorization

1. The browser authenticates using Better Auth email/password endpoints.
2. Better Auth persists users, sessions, accounts, and verification records in PostgreSQL.
3. APIs resolve the session from request headers using `getSession`.
4. The API resolves organization membership and role server-side.
5. The client-supplied `organizationId` is a resource selector only; it does not grant access.
6. Read operations require membership. Operational writes require ADMIN or OPERATOR; agent provisioning requires ADMIN.

Role policy:
- ADMIN: organization administration and agent provisioning.
- OPERATOR: operational writes.
- VIEWER: read-only access.

Keep policy checks centralized and covered by tests. The current role helper tests policy decisions; API-level integration tests against PostgreSQL are still needed.

## Agent identity

- Human sessions and agent credentials are separate.
- Agent tokens are generated with high entropy and only token hashes are stored.
- Credential records bind `agent_id`, `organization_id`, and device identity through the associated agent row.
- Authentication validates token hash, tenant, device, revocation and expiry.
- Heartbeats must not be able to override the credential-bound identity.
- Provisioning inserts the agent and credential in one transaction; a credential failure rolls back the agent insert.

Existing agent rows and credentials in any deployed database still need a reviewed migration/rotation plan. Do not assume the historical deterministic agent IDs are safe to retain.

## Tenant isolation

The API currently checks membership before listing incidents, telemetry samples, audit records, or incident details. Nested incident data is loaded only after the incident itself is found under the requested organization.

Remaining hardening:
- Add organization-aware composite foreign keys where practical.
- Ensure every operational table has an unambiguous tenant relationship.
- Scope runbooks, actions, results, timeline entries, and audit logs consistently.
- Add API integration tests for cross-tenant reads and writes, VIEWER write denial, and foreign-tenant nested resources.
- Evaluate RLS only after identifying the actual database role used by the application. RLS must be tested using that role and connection mode; API authorization remains mandatory.

## Database status and migration safety

The application currently issues SQL against these tables:
- Better Auth: `user`, `session`, `account`, `verification`.
- Organization: `organizations`, `organization_members`.
- Operations: `telemetry_samples`, `events`, `incidents`, `timeline_entries`, `runbooks`, `actions`, `agents`, `agent_credentials`, `action_results`, `audit_logs`.

The old migration in PR #7 is not a valid current baseline:
- It references Supabase's `auth.users`, while the current application uses Better Auth.
- It predates `agent_credentials` and the current credential-bound identity model.
- Its organization and agent relationships do not fully express current tenant boundaries.
- It was intended for a new, empty Supabase project and must not be replayed blindly.

The current live database schema and data state are unknown. No live database inspection or SQL migration has been performed. Before creating or applying a migration:
1. Generate the Better Auth schema from the exact installed Better Auth version and current configuration.
2. Inspect the live database schema and migration history using a secure database connection; never paste credentials into chat or Git.
3. Compare the live schema with the generated auth schema and application SQL contract.
4. Design additive migrations with explicit handling for existing rows and legacy agent credentials.
5. Test migrations against a disposable PostgreSQL database before any production application.

## Server environment

- `DATABASE_URL`: server-only PostgreSQL connection.
- `BETTER_AUTH_URL`: canonical public application URL.
- Vercel origin variables are used for trusted-origin configuration.

Never expose database credentials or service-role keys in browser variables, source control, logs, or chat.

## Validation

CI currently validates TypeScript backend sources, unit tests, and production build. This is not equivalent to live database validation, migration testing, RLS verification, or production deployment verification.
