-- Durable rule evaluation state shared by all serverless instances.
-- State is backend-only: Better Auth authorizes human access at the API boundary.
CREATE TABLE public.rule_evaluation_states (
  scope_key text PRIMARY KEY CHECK (length(scope_key) BETWEEN 1 AND 1024),
  state jsonb NOT NULL CHECK (
    jsonb_typeof(state) = 'object'
    AND jsonb_typeof(state->'triggered') = 'boolean'
    AND (NOT (state ? 'activeSince') OR jsonb_typeof(state->'activeSince') IN ('string', 'null'))
    AND (NOT (state ? 'lastSampleAt') OR jsonb_typeof(state->'lastSampleAt') IN ('string', 'null'))
  ),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rule_evaluation_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rule_evaluation_states FROM PUBLIC;
DO $$
DECLARE browser_role text;
BEGIN
  FOR browser_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated') LOOP
    EXECUTE format('REVOKE ALL ON public.rule_evaluation_states FROM %I', browser_role);
  END LOOP;
END $$;
