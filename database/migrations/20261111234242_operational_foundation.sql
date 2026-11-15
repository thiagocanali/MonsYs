-- Additive baseline, reconciled against the live auth_foundation migration.
-- Better Auth owns human identity; these tables are accessed through server APIs.
CREATE TABLE public.agents (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES public.organizations(id),
  device_id text NOT NULL,
  version text NOT NULL,
  connected boolean NOT NULL DEFAULT false,
  hostname text NOT NULL,
  last_seen_at timestamptz NOT NULL,
  UNIQUE (organization_id, device_id),
  UNIQUE (organization_id, id)
);
CREATE TABLE public.agent_credentials (
  id text PRIMARY KEY,
  agent_id text NOT NULL,
  organization_id text NOT NULL REFERENCES public.organizations(id),
  token_hash text NOT NULL UNIQUE CHECK (length(token_hash) = 64),
  revoked_at timestamptz,
  expires_at timestamptz,
  FOREIGN KEY (organization_id, agent_id) REFERENCES public.agents(organization_id, id)
);
CREATE INDEX agent_credentials_agent_idx ON public.agent_credentials(organization_id, agent_id);
CREATE TABLE public.telemetry_samples (
  id text NOT NULL,
  organization_id text NOT NULL REFERENCES public.organizations(id),
  device_id text NOT NULL,
  metric text NOT NULL,
  value double precision NOT NULL CHECK (value > '-Infinity'::float8 AND value < 'Infinity'::float8),
  recorded_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, id)
);
CREATE INDEX telemetry_device_time_idx ON public.telemetry_samples(organization_id, device_id, recorded_at DESC);
CREATE TABLE public.events (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES public.organizations(id),
  device_id text NOT NULL,
  rule_id text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('INFO','WARNING','CRITICAL')),
  status text NOT NULL CHECK (status IN ('OPEN','RESOLVED')),
  title text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  resolved_at timestamptz
);
CREATE INDEX events_org_time_idx ON public.events(organization_id, created_at DESC);
CREATE TABLE public.incidents (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES public.organizations(id),
  event_ids jsonb NOT NULL CHECK (jsonb_typeof(event_ids) = 'array'),
  device_id text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('INFO','WARNING','CRITICAL')),
  status text NOT NULL CHECK (status IN ('OPEN','ACKNOWLEDGED','IN_PROGRESS','RESOLVED','CLOSED')),
  title text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
CREATE INDEX incidents_org_time_idx ON public.incidents(organization_id, created_at DESC, id DESC);
CREATE TABLE public.timeline_entries (
  id text PRIMARY KEY,
  incident_id text NOT NULL REFERENCES public.incidents(id),
  type text NOT NULL CHECK (type IN ('EVENT','INCIDENT','RUNBOOK','ACTION','AGENT','RESULT')),
  message text NOT NULL,
  actor_id text,
  created_at timestamptz NOT NULL
);
CREATE INDEX timeline_incident_time_idx ON public.timeline_entries(incident_id, created_at);
CREATE TABLE public.runbooks (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES public.organizations(id),
  name text NOT NULL,
  steps jsonb NOT NULL CHECK (jsonb_typeof(steps) = 'array')
);
CREATE INDEX runbooks_org_idx ON public.runbooks(organization_id);
CREATE TABLE public.actions (
  id text PRIMARY KEY,
  incident_id text NOT NULL REFERENCES public.incidents(id),
  runbook_step_id text,
  type text NOT NULL CHECK (type IN ('GET_TOP_PROCESSES','RESTART_SERVICE','RUN_COMMAND')),
  requested_by text NOT NULL,
  requires_approval boolean NOT NULL,
  approved boolean NOT NULL,
  approved_by text,
  status text NOT NULL CHECK (status IN ('QUEUED','RUNNING','SUCCEEDED','FAILED'))
);
CREATE INDEX actions_incident_idx ON public.actions(incident_id);
CREATE TABLE public.action_results (
  id text PRIMARY KEY,
  action_id text NOT NULL REFERENCES public.actions(id),
  agent_id text NOT NULL REFERENCES public.agents(id),
  success boolean NOT NULL,
  output text NOT NULL,
  finished_at timestamptz NOT NULL
);
CREATE INDEX action_results_action_idx ON public.action_results(action_id, finished_at);
CREATE INDEX action_results_agent_idx ON public.action_results(agent_id);
CREATE TABLE public.audit_logs (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES public.organizations(id),
  actor_id text NOT NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_org_time_idx ON public.audit_logs(organization_id, created_at DESC);

-- Deny direct browser access: Better Auth cookies are not Supabase Auth JWTs.
-- The server connection must use the table owner or an explicitly reviewed role.
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telemetry_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timeline_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.runbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.agents, public.agent_credentials, public.telemetry_samples,   public.events, public.incidents, public.timeline_entries, public.runbooks,   public.actions, public.action_results, public.audit_logs FROM PUBLIC;
DO $$
DECLARE browser_role text;
BEGIN
  FOR browser_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated') LOOP
    EXECUTE format('REVOKE ALL ON public.agents, public.agent_credentials, public.telemetry_samples,   public.events, public.incidents, public.timeline_entries, public.runbooks,   public.actions, public.action_results, public.audit_logs FROM %I', browser_role);
  END LOOP;
END $$;
