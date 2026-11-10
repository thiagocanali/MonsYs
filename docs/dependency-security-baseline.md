# Dependency security baseline

## Current status

This document records the dependency-security review performed on 2026-11-10.

- The main CI workflow is green after PR #26: typecheck, unit tests and production build passed.
- The project currently pins Vite 8.3.1 in `package-lock.json`.
- Vite 8.3.1 is affected by known security advisories, while Vite 8.3.7 is the current 8.3 release reported as not affected by the known Vite advisories. The Vite security advisory published on 2026-11-10 identifies a critical remote-code-execution issue in affected Vite releases.
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

Regenerate the lockfile using the current npm registry and upgrade Vite from 8.3.1 to the latest patched 8.3 release. Then run a fresh JSON audit to identify the remaining two moderate/two high findings and remediate them individually when compatible.

Until that lockfile regeneration is performed, this repository intentionally does not claim that the dependency audit is clean.

## Database dependency

The PostgreSQL/Better Auth production schema is still awaiting the safe read-only Supabase inventory described in `docs/database-readonly-inspection.sql`. No production database migration or durable PostgreSQL rule-state adapter should be created from assumptions about the live schema.

