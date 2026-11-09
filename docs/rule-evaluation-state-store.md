# Rule evaluation state store contract

**Status:** application-level atomicity contract; no PostgreSQL migration or live database change has been made.

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

## PostgreSQL adapter requirements (future implementation)

A production adapter should use a dedicated table with a primary key on scope_key and a JSONB or typed-column representation of active_since, last_sample_at, and triggered.

Within one database transaction, it must:
1. Acquire a transaction-scoped advisory lock derived from the exact scope key. Hash collisions may cause extra waiting, but the primary key remains the correctness boundary.
2. Read the current row.
3. Execute the state transition.
4. Upsert the returned state or delete the row when the transition resets it.
5. Commit before returning the evaluation result.

A unique primary key on scope_key is mandatory. The adapter must not use process-local mutexes as its cross-instance concurrency mechanism.

## Deployment gate

Do not implement or apply the production adapter until the live database inventory is reviewed and an additive migration has been tested against a disposable PostgreSQL database. The default RuleEngine remains in-memory until that work is completed; therefore cross-instance durability is not yet available.
