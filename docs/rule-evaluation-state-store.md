# Rule evaluation state store contract

**Status:** PostgreSQL adapter and additive migration are versioned, but no hosted migration or production cutover has been performed. The runtime remains in-memory by default. Enable `RULE_EVALUATION_PERSISTENCE=postgres` only after applying and verifying the migration on the target database.

## Why this contract exists

A rule evaluation reads prior state, checks the duration window and alert latch, then writes the next state. A plain read followed by a separate write is not atomic: concurrent requests can both observe an untriggered state and both emit an event.

The RuleEvaluationStateStore transact(scopeKey, operation) contract requires the read, decision and write to behave as one serialized operation for a given scope key. Different scope keys may proceed independently.

## Required semantics

- Serialize operations with the same scopeKey.
- Provide the latest committed state to the operation.
- Persist the returned state before resolving the transaction promise.
- Treat an undefined state as deleting/resetting the scope.
- Preserve timestamps as timestamps, not locale-formatted strings.
- Release locks on both success and failure.
- Do not hold one global lock for all organizations/devices/rules.

The in-memory adapter serializes by key and is suitable for deterministic tests and single-process development only. It is not durable and does not coordinate separate serverless instances.

## PostgreSQL adapter implemented in the repository

The versioned PostgreSQL adapter uses a dedicated table with a primary key on scope_key and a JSONB or typed-column representation of active_since, last_sample_at, and triggered.

Within one database transaction, it must:
1. Acquire a transaction-scoped advisory lock derived from the exact scope key. Hash collisions may cause extra waiting, but the primary key remains the correctness boundary.
2. Read the current row.
3. Execute the state transition.
4. Upsert the returned state or delete the row when the transition resets it.
5. Commit before returning the evaluation result.

A unique primary key on scope_key is mandatory. The adapter must not use process-local mutexes as its cross-instance concurrency mechanism.

## Deployment gate

The adapter already exists in `src/server/rule-evaluation-state-store.ts` and its migration is `database/migrations/20261115190000_rule_evaluation_state.sql`. Do not enable it merely because these files were merged. Verify the target database and application connection role first; the runtime still selects memory unless `RULE_EVALUATION_PERSISTENCE=postgres` is explicitly configured.

As inspected on 2026-11-21, the dedicated MonsYs Neon database has the first 16 tables but lacks `rule_evaluation_states`. Apply only the pending migration in isolated staging, then inject `DATABASE_CHECK_URL` and run `npm run db:check`. Exit 0 confirms the inspected schema/access prerequisites, not a full application or production approval. Test the authenticated ingestion and concurrent evaluation flow before changing the runtime flag.

State persistence is transactional per scope; telemetry insertion and incident persistence are still separate transactions in the API. This adapter alone does not guarantee atomic ingestion or retry recovery. See [the current resumption report](./project-resumption-2026-11-21.md).
