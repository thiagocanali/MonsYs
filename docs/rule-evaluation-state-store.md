# Rule evaluation state store

**Status:** PostgreSQL adapter implemented on branch `feat/postgres-rule-evaluation-state`; CI and integration validation are pending.

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

## PostgreSQL implementation

The migration `20261115190000_rule_evaluation_state.sql` creates a backend-only table with a primary key on scope_key and a JSONB state containing active_since, last_sample_at and triggered values.

The PostgreSQL adapter:
1. Opens a database transaction.
2. Acquires a transaction-scoped advisory lock derived from the exact scope key.
3. Reads the latest state.
4. Executes the domain state transition.
5. Upserts the returned state or deletes the row when the transition resets.
6. Commits before returning the evaluation result.

Hash collisions can cause extra waiting, but the table primary key remains the correctness boundary. The adapter does not use process-local mutexes as its cross-instance concurrency mechanism. If rollback fails, the connection is discarded instead of returned to the pool in an uncertain state.

The operations API now uses the PostgreSQL adapter by default. Unit tests can continue using the in-memory adapter explicitly.

## Validation and limitations

The integration test applies the ordered migrations to a disposable local PostgreSQL database and verifies:
- persistence across independently constructed engine/store instances;
- serialization of concurrent evaluations so only one alert is triggered;
- recovery of the triggered latch after constructing a new engine instance;
- state reset through clear().

This implementation makes rule evaluation state durable and cross-instance serialized. It does **not yet** make telemetry insertion, rule-state transition, event creation and incident creation one atomic transaction. That remains a separate reliability task: an error after the telemetry insert can still leave a sample without its corresponding event/incident, and idempotent retry handling must be designed before claiming end-to-end transactional ingestion.

Do not apply the new migration to a live or existing database until its schema and migration history have been reconciled. The Neon project created for development is not automatically the database used by the Vercel production runtime.
