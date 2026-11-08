# MonsYs — PostgreSQL schema contract (source-derived)

**Status:** inventory only; not a migration. Reviewed against application SQL on 2026-11-08.

This document records the tables and columns the current server code reads or writes. It does not assert that these objects exist in the live Supabase project. Do not execute this document as SQL.

## Authentication tables

Better Auth is configured with the PostgreSQL adapter in `src/server/auth.ts`. The application expects Better Auth's standard tables:
- `user`
- `session`
- `account`
- `verification`

Generate their exact schema from the installed Better Auth version and current configuration. Do not hand-author or infer their column names/types from this inventory.

## Application tables and observed columns

| Table | Columns observed in application SQL | Important notes |
|---|---|---|
| `organizations` | `id`, `name`, `slug` | `id` is returned by organization creation; `slug` must be unique. |
| `organization_members` | `organization_id`, `user_id`, `role` | Membership lookup is by organization and Better Auth user ID; unique pair required. Roles: ADMIN, OPERATOR, VIEWER. |
| `agents` | `id`, `device_id`, `version`, `connected`, `hostname`, `last_seen_at` | Agent ID is server-generated UUID string; device ID is not a global primary key. |
| `agent_credentials` | `id`, `agent_id`, `organization_id`, `token_hash`, `revoked_at`, `expires_at` | Token hash only; credential is tenant/device bound through agent join. |
| `telemetry_samples` | `id`, `organization_id`, `device_id`, `metric`, `value`, `recorded_at`, `created_at` | Idempotency uses primary/unique `id`; list queries filter by organization and device. |
| `events` | `id`, `organization_id`, `device_id`, `rule_id`, `severity`, `status`, `title`, `message`, `created_at`, `updated_at`, `resolved_at` | Severity: INFO, WARNING, CRITICAL. |
| `incidents` | `id`, `organization_id`, `event_ids`, `device_id`, `severity`, `status`, `title`, `created_at`, `updated_at` | `event_ids` is JSONB. Status includes OPEN, ACKNOWLEDGED, IN_PROGRESS, RESOLVED, CLOSED. |
| `timeline_entries` | `id`, `incident_id`, `type`, `message`, `actor_id`, `created_at` | Incident relationship; type is constrained by domain model. |
| `runbooks` | `id`, `organization_id`, `name`, `steps` | `steps` is JSONB. |
| `actions` | `id`, `incident_id`, `runbook_step_id`, `type`, `requested_by`, `requires_approval`, `approved`, `approved_by`, `status` | Incident relationship; action execution remains deliberately non-simulated. |
| `action_results` | `id`, `action_id`, `agent_id`, `success`, `output`, `finished_at` | References action and agent. |
| `audit_logs` | `id`, `organization_id`, `actor_id`, `action`, `resource_type`, `resource_id`, `metadata`, `created_at` | `metadata` is JSONB. |

## Constraints and indexes required by observed behavior

These are design requirements to validate during migration design, not a claim about the live database:
- Primary/unique keys for each `id` used by `ON CONFLICT (id)`.
- Unique `organizations.slug`.
- Unique `organization_members(organization_id, user_id)`.
- Foreign key `organization_members.user_id` to the generated Better Auth user table using its actual ID type.
- Foreign key `agent_credentials.agent_id` to `agents.id`.
- Index `agent_credentials(token_hash)`; token hash lookup is authentication-critical and should be unique.
- Index `organization_members(user_id)` and `organization_members(organization_id, user_id)`.
- Index tenant/time access patterns for telemetry, events, incidents, runbooks, and audit logs.
- Tenant-aware foreign keys for operational relationships where practical; avoid relying only on application convention.

## Known gaps to resolve before writing migrations

1. Better Auth schema must be generated from the exact installed version; its user ID type must determine membership FK type.
2. `organizations` and `organization_members` are currently custom tables, not a configured Better Auth organization plugin schema.
3. `agent_credentials` is required by current runtime SQL but absent from the historical migration.
4. Historical migration references `auth.users` (Supabase Auth), incompatible with the current Better Auth authentication flow.
5. Historical migration creates `agents` without an organization relationship and predates credential-bound identities.
6. Current operations SQL does not yet enforce all tenant relationships at the database constraint level.
7. Current schema/data/migration history in the live Supabase project has not been inspected.

## Next safe database milestone

- Generate Better Auth schema with the installed package version and configuration.
- Obtain a read-only schema inventory and migration history from the target database without sharing secrets.
- Compare actual schema with this contract.
- Draft additive, idempotent migrations and a legacy-agent reconciliation plan.
- Run migration tests against a disposable PostgreSQL database before considering the live project.
