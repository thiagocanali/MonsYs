# Dependency security baseline

## Current status

This document records the dependency-security review performed on 2026-11-10.

- The main CI workflow was green after PR #26: typecheck, unit tests and production build passed.
- The project currently pins Vite 8.3.1 in `package-lock.json`.
- GitHub published critical advisory GHSA-p4f5-76q4-ffq7 on 2026-11-10. It affects Vite 8.3.0 through 8.3.6 and is patched in 8.3.7. The issue permits remote code execution when the Vite dev server is explicitly exposed to the network (for example, using `--host`). Vite 8.3.1 is within the affected range.
- Until the lockfile is updated, do not expose this project's Vite development server to untrusted networks. This advisory concerns the development server; it is not evidence that the built production bundle is itself vulnerable.
- Better Auth 1.7.18 is the current installed release line and public vulnerability databases reviewed on 2026-11-10 report no known direct vulnerabilities for that version.
- The CI install has previously reported four npm audit findings (two moderate and two high). The exact dependency/advisory mapping has not yet been captured from an authoritative `npm audit --json` run, so no forced remediation is being applied blindly.

## Remediation policy

1. Prefer the smallest compatible patched release.
2. Regenerate `package-lock.json` with npm rather than hand-editing integrity data.
3. Do not use `npm audit fix --force` without reviewing the resulting major-version changes.
4. Run typecheck, unit tests and production build after every dependency remediation.
5. Treat runtime dependencies and development-only tooling separately when evaluating risk.
6. Keep production deployment status separate from CI status.

## Next dependency-security action

Regenerate the lockfile using npm and upgrade Vite from 8.3.1 to at least the patched 8.3.7 release. Then run a fresh JSON audit to identify the remaining two moderate/two high findings and remediate them individually when compatible.

A narrowly scoped Dependabot update schedule for Vite is being added in PR #28. It supplements, but does not replace, the immediate lockfile remediation.

Until that lockfile regeneration is performed, this repository intentionally does not claim that the dependency audit is clean.

## Database dependency

The PostgreSQL/Better Auth production schema is still awaiting the safe read-only Supabase inventory described in `docs/database-readonly-inspection.sql`. No production database migration or durable PostgreSQL rule-state adapter should be created from assumptions about the live schema.
