import type { Pool, PoolClient } from 'pg'
import { databasePool } from './database.js'
import type { RuleEvaluationState, RuleEvaluationStateMutation, RuleEvaluationStateStore } from '../domain/rules.js'

type StoredState = {
  activeSince?: string | null
  lastSampleAt?: string | null
  triggered: boolean
}

function decodeState(value: unknown): RuleEvaluationState | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'string') {
    try { value = JSON.parse(value) as unknown }
    catch { throw new Error('Persisted rule evaluation state is invalid JSON') }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Persisted rule evaluation state must be an object')
  }
  const state = value as Partial<StoredState>
  if (typeof state.triggered !== 'boolean') throw new Error('Persisted rule evaluation state has no valid triggered flag')
  const parseDate = (input: string | null | undefined, field: string): Date | undefined => {
    if (input == null) return undefined
    if (typeof input !== 'string') throw new Error(`Persisted rule evaluation ${field} must be a string`)
    const date = new Date(input)
    if (Number.isNaN(date.getTime())) throw new Error(`Persisted rule evaluation ${field} is invalid`)
    return date
  }
  return {
    activeSince: parseDate(state.activeSince, 'activeSince'),
    lastSampleAt: parseDate(state.lastSampleAt, 'lastSampleAt'),
    triggered: state.triggered,
  }
}

function encodeState(state: RuleEvaluationState): StoredState {
  return {
    activeSince: state.activeSince?.toISOString() ?? null,
    lastSampleAt: state.lastSampleAt?.toISOString() ?? null,
    triggered: state.triggered,
  }
}

/**
 * PostgreSQL-backed state store. A transaction-scoped advisory lock serializes
 * each scope across separate function instances; the table primary key remains
 * the durable uniqueness boundary.
 */
export class PostgresRuleEvaluationStateStore implements RuleEvaluationStateStore {
  constructor(private readonly pool: Pick<Pool, 'connect'> = databasePool) {}

  async transact<T>(
    scopeKey: string,
    operation: (current: RuleEvaluationState | undefined) => RuleEvaluationStateMutation<T>,
  ): Promise<T> {
    return this.withScopeLock(scopeKey, async client => {
      const selected = await client.query<{ state: unknown }>(
        'SELECT state FROM public.rule_evaluation_states WHERE scope_key = $1 FOR UPDATE',
        [scopeKey],
      )
      const mutation = operation(decodeState(selected.rows[0]?.state))
      if (mutation.state) {
        await client.query(
          'INSERT INTO public.rule_evaluation_states (scope_key, state, updated_at) VALUES ($1, $2::jsonb, now()) ON CONFLICT (scope_key) DO UPDATE SET state = EXCLUDED.state, updated_at = EXCLUDED.updated_at',
          [scopeKey, JSON.stringify(encodeState(mutation.state))],
        )
      } else {
        await client.query('DELETE FROM public.rule_evaluation_states WHERE scope_key = $1', [scopeKey])
      }
      return mutation.result
    })
  }

  async clear(scopeKey: string): Promise<void> {
    await this.withScopeLock(scopeKey, async client => {
      await client.query('DELETE FROM public.rule_evaluation_states WHERE scope_key = $1', [scopeKey])
    })
  }

  private async withScopeLock<T>(scopeKey: string, operation: (client: PoolClient) => Promise<T>): Promise<T> {
    if (typeof scopeKey !== 'string' || !scopeKey.trim() || scopeKey.length > 1024) {
      throw new Error('Rule evaluation scope key must contain between 1 and 1024 characters')
    }
    const client = await this.pool.connect()
    let discardConnection: Error | undefined
    try {
      await client.query('BEGIN')
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [scopeKey])
      const result = await operation(client)
      await client.query('COMMIT')
      return result
    } catch (error) {
      try { await client.query('ROLLBACK') }
      catch (rollbackError) {
        discardConnection = rollbackError instanceof Error
          ? rollbackError
          : new Error('Unable to roll back rule evaluation transaction')
      }
      throw error
    } finally {
      client.release(discardConnection)
    }
  }
}
