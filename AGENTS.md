# AGENTS.md — MonsYs

## Scope and authority
- Work only in this repository. Preserve existing UI and unrelated features unless a task explicitly requires a change.
- Use autonomous development with protection: group 5–10 related tasks per development cycle and prefer one active pull request per workstream.
- Before creating a pull request, search open pull requests and update the matching workstream branch when safe. Do not create one PR per task.
- Keep commits focused and descriptive; run typecheck, tests, dependency audit and build before requesting integration.
- Continue independent, safe tasks if another task is blocked. Never claim tests passed without checking results.

## Pull requests and merges
- Target the protected main branch through pull requests. Never push directly to main, bypass required checks, dismiss reviews to evade protection, or weaken branch protection.
- Do not merge draft, incomplete, failing, security-sensitive or unreviewed changes where review is required.
- Prefer squash merge only after all required checks and reviews succeed. Use auto-merge only when enabled and allowed by repository rules.
- Authentication, authorization, database schema/data, secrets, permissions and production changes require additional validation and explicit review before integration.
- Do not disable tests, skip CI, or treat a Vercel deployment status as a replacement for GitHub CI.

## CI and deployment efficiency
- Prefer local validation and GitHub Actions to repeated preview deployments.
- Avoid intermediate pushes where possible: commit locally, validate, and push a coherent batch. Do not rewrite shared branches without coordination.
- Cancel obsolete CI runs for superseded PR commits; never cancel main branch validation.
- Preserve Vercel free-tier capacity. Do not modify production deployment settings or trigger production releases without explicit approval.
- If an external service, quota or database is unavailable, document the blocker and continue independent tasks. Never suspend or delete unrelated projects to free quota.

## Definition of done
- Relevant tests and typecheck pass; build passes; security audit findings are assessed.
- PR description summarizes scope, risks, tests, and any blocked production verification.
- Required reviews and branch protection are satisfied before merge; no incomplete or draft PR is integrated.
