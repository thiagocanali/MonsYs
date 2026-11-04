# MonsYs — Authentication and tenant security architecture

## Status

Architecture proposal based on the repository source reviewed on 2026-11-04.
This document does not enable authentication, change the database, or claim production readiness.

## Current security gaps

- `GET /api/operations` accepts a caller-supplied `organizationId`.
- `POST /api/operations` accepts caller-supplied organization IDs for telemetry and incident creation.
- The heartbeat flow accepts device identity and metrics without authenticating the agent.
- The frontend has no login/session flow and currently uses the demo tenant `acme`.
- `agents` are not organization-scoped in the initial schema.
- Related records such as actions, action results, and timeline entries are loaded by incident ID; their access must be anchored to an authorized incident and tenant.
- The health endpoint is public; it should expose only non-sensitive liveness/readiness information.

## Recommended identity model

### Human users

1. The browser signs in with Supabase Auth.
2. The browser sends the Supabase access token as a Bearer token to the MonsYs API.
3. The API validates the token with Supabase Auth using the server-side Supabase URL and publishable/anon key. Never trust decoded JWT claims without signature and issuer validation.
4. The API obtains the authenticated user ID from the verified identity.
5. The API resolves organization membership from `organization_members` on the server.
6. The organization context and role are derived server-side. A client-provided `organizationId` must never grant access.
7. Every operation checks the minimum required role.

Suggested permissions:
- ADMIN: manage organization, membership, users, rules, runbooks, and operational resources.
- OPERATOR: read operational data, acknowledge/resolve incidents, and request permitted actions.
- VIEWER: read-only operational access.

The exact permission matrix should be implemented as centralized policy functions and covered by tests, rather than scattered role checks.

### Agents

Agents must not reuse human access tokens.

1. Provision each agent against one organization and device.
2. Issue a high-entropy agent credential once; store only a cryptographic hash in PostgreSQL.
3. Authenticate heartbeat and telemetry requests with that credential.
4. Resolve the agent, device, and organization from the credential record on the server.
5. Reject payloads that attempt to override the credential's device or organization.
6. Support credential rotation and revocation; never log credentials.

The schema must add an organization-scoped agent identity and credential storage before enabling this flow. Existing agent rows need a reviewed migration strategy.

## Tenant isolation and database access

- Every tenant-owned resource must have a trustworthy organization relationship.
- Reads and writes must include tenant scope, including joins and nested resources.
- Actions, action results, and timeline entries must be reached through an incident that belongs to the authorized organization.
- Agents and agent credentials must be scoped to an organization.
- Audit records must use the authenticated actor or authenticated agent identity, not a caller-supplied actor ID.
- Add database constraints that prevent cross-tenant relationships where practical (for example composite keys/foreign keys involving `organization_id`).

### RLS recommendation

Use PostgreSQL Row Level Security as defense in depth, but do not assume it protects data automatically.

Before enabling policies:
- Confirm which PostgreSQL role the deployed `DATABASE_URL` uses.
- Do not connect the application with a table-owner or privileged role that bypasses RLS unless the design explicitly accounts for that bypass.
- Define a transaction-scoped tenant context only after API authentication and membership checks.
- Ensure every database transaction sets and clears that context safely (for example with `SET LOCAL` inside a transaction).
- Test policies using the same database role and connection mode used by the deployed application.

RLS is not a substitute for API authorization. The API must reject unauthenticated and unauthorized requests before accessing tenant data.

## API implementation sequence

1. Add a shared server-side authentication module for human Bearer tokens.
2. Add centralized membership and role resolution.
3. Add protected route helpers and remove caller authority from `organizationId`.
4. Add the browser login/session flow and authenticated API client.
5. Add agent credential provisioning, hashing, validation, rotation, and revocation.
6. Scope all repository methods and relationships by organization.
7. Add RLS policies and verify the actual database role/connection behavior.
8. Add integration tests and CI before production deployment.

## Required security tests

- No token: protected human endpoint returns 401.
- Invalid, expired, or wrong-project token: 401.
- Authenticated user without membership: 403.
- VIEWER attempts a write: 403.
- OPERATOR attempts an ADMIN-only operation: 403.
- User from organization A requests data belonging to organization B: no data disclosure or mutation.
- Changing `organizationId` in query/body does not change the authenticated tenant.
- Agent without credential, revoked credential, or invalid credential: 401.
- Agent credential for device A cannot submit data for device B or another organization.
- Nested actions/results/timeline cannot be accessed through a foreign-tenant incident.
- Health endpoint returns no secrets, connection strings, or sensitive infrastructure details.

## Deployment configuration (server only)

Expected configuration will be documented when implementation begins:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` (or current publishable key name supported by the project)
- `DATABASE_URL`

No Supabase service-role key should be placed in the browser. No secret should be committed to Git or pasted into chat.

## Database and deployment safety

The Supabase project `uffirxavkewwetniuctc` has not been inspected through a database connection in this review. Its schema and data state are unknown.

Do not run migrations against it until its current schema and data have been checked. The existing initial migration is explicitly intended for a new, empty project. The demo tenant `acme` is development scaffolding, not a production onboarding mechanism.

## Validation status

This is a source-based architecture review. No runtime build, tests, live Supabase inspection, SQL migration, or production security validation has been performed as part of this document.
