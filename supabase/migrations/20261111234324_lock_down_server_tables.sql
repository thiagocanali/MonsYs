-- Backend-only tables: no browser Data API policies are intentionally granted.
-- Preserve the existing Better Auth data and server/table-owner access.
ALTER TABLE public."user" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."user", public.session, public.account, public.verification,   public.organizations, public.organization_members FROM PUBLIC;
DO $$
DECLARE browser_role text;
BEGIN
  FOR browser_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated') LOOP
    EXECUTE format('REVOKE ALL ON public."user", public.session, public.account, public.verification,   public.organizations, public.organization_members FROM %I', browser_role);
  END LOOP;
END $$;
