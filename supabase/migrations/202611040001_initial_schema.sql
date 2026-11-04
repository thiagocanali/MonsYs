-- MonsYs initial PostgreSQL schema
-- Target: a NEW, empty Supabase project.
-- Do not run against an existing database without reviewing its current schema first.
-- IDs are TEXT initially because current API accepts externally supplied IDs.
-- Authentication and RLS policies are intentionally deferred until API token
-- validation and tenant authorization are implemented together.

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS organization_members (
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'OPERATOR', 'VIEWER')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON organization_members(user_id);

CREATE TABLE IF NOT EXISTS telemetry_samples (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  device_id TEXT NOT NULL,
  metric TEXT NOT NULL,
  value DOUBLE PRECISION NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_telemetry_org_device_recorded
  ON telemetry_samples(organization_id, device_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  device_id TEXT NOT NULL,
  rule_id TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
  status TEXT NOT NULL CHECK (status IN ('OPEN', 'RESOLVED')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_events_org_created ON events(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_org_status_severity ON events(organization_id, status, severity);

CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  event_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  device_id TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
  status TEXT NOT NULL CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_incidents_org_created ON incidents(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_org_status_severity ON incidents(organization_id, status, severity);

CREATE TABLE IF NOT EXISTS timeline_entries (
  id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('EVENT', 'INCIDENT', 'RUNBOOK', 'ACTION', 'AGENT', 'RESULT')),
  message TEXT NOT NULL,
  actor_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_timeline_incident_created ON timeline_entries(incident_id, created_at);

CREATE TABLE IF NOT EXISTS runbooks (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_runbooks_organization ON runbooks(organization_id);

CREATE TABLE IF NOT EXISTS actions (
  id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  runbook_step_id TEXT,
  type TEXT NOT NULL CHECK (type IN ('GET_TOP_PROCESSES', 'RESTART_SERVICE', 'RUN_COMMAND')),
  requested_by TEXT NOT NULL,
  requires_approval BOOLEAN NOT NULL DEFAULT false,
  approved BOOLEAN NOT NULL DEFAULT false,
  approved_by TEXT,
  status TEXT NOT NULL CHECK (status IN ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED'))
);
CREATE INDEX IF NOT EXISTS idx_actions_incident ON actions(incident_id);

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  version TEXT NOT NULL,
  connected BOOLEAN NOT NULL DEFAULT false,
  hostname TEXT NOT NULL DEFAULT 'unknown',
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agents_device ON agents(device_id);
CREATE INDEX IF NOT EXISTS idx_agents_last_seen ON agents(last_seen_at DESC);

CREATE TABLE IF NOT EXISTS action_results (
  id TEXT PRIMARY KEY,
  action_id TEXT NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  success BOOLEAN NOT NULL,
  output TEXT NOT NULL,
  finished_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_action_results_action_finished ON action_results(action_id, finished_at);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_org_created ON audit_logs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_org_resource ON audit_logs(organization_id, resource_id);

-- IMPORTANT:
-- The current API still trusts organizationId supplied by the request.
-- This schema does not make the API safe by itself. Do not expose the API
-- publicly with real customer data until authentication, tenant-scoped queries,
-- and appropriate RLS/service-role boundaries are implemented and tested.
