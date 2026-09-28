import { Pool, type PoolClient } from 'pg'
import type { Event } from '../domain/rules.js'
import type { Action, ActionResult, Agent, Incident, Runbook, TimelineEntry } from '../domain/operations.js'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

function eventRow(event: Event) {
  return [event.id, event.organizationId, event.deviceId, event.ruleId, event.severity, event.status, event.title, event.message, event.createdAt, event.updatedAt, event.resolvedAt ?? null]
}

function incidentRow(incident: Incident) {
  return [incident.id, incident.organizationId, JSON.stringify(incident.eventIds), incident.deviceId, incident.severity, incident.status, incident.title, incident.createdAt, incident.updatedAt]
}

export interface TelemetrySampleRecord {
  id: string
  organizationId: string
  deviceId: string
  metric: string
  value: number
  recordedAt: Date
}

export async function saveTelemetrySample(sample: TelemetrySampleRecord) {
  await pool.query(
    'INSERT INTO telemetry_samples (id, organization_id, device_id, metric, value, recorded_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING',
    [sample.id, sample.organizationId, sample.deviceId, sample.metric, sample.value, sample.recordedAt],
  )
}

export async function listTelemetrySamples(organizationId: string, deviceId: string, metric?: string) {
  const result = await pool.query(
    'SELECT id, organization_id, device_id, metric, value, recorded_at, created_at FROM telemetry_samples WHERE organization_id = $1 AND device_id = $2 AND ($3::text IS NULL OR metric = $3) ORDER BY recorded_at DESC LIMIT 500',
    [organizationId, deviceId, metric ?? null],
  )
  return result.rows
}

export async function saveEventIncident(event: Event, incident: Incident, timeline: TimelineEntry[]) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await insertEvent(client, event)
    await insertIncident(client, incident)
    for (const entry of timeline) await insertTimeline(client, entry)
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function listIncidents(organizationId: string) {
  const result = await pool.query(
    'SELECT id, organization_id, event_ids, device_id, severity, status, title, created_at, updated_at FROM incidents WHERE organization_id = $1 ORDER BY created_at DESC',
    [organizationId],
  )
  return result.rows
}

export async function getIncidentDetails(organizationId: string, incidentId: string) {
  const incidentResult = await pool.query(
    'SELECT id, organization_id, event_ids, device_id, severity, status, title, created_at, updated_at FROM incidents WHERE organization_id = $1 AND id = $2',
    [organizationId, incidentId],
  )
  const incident = incidentResult.rows[0]
  if (!incident) return null

  const [actions, timeline, runbooks, results] = await Promise.all([
    pool.query(
      'SELECT id, incident_id, runbook_step_id, type, requested_by, requires_approval, approved, approved_by, status FROM actions WHERE incident_id = $1 ORDER BY id',
      [incidentId],
    ),
    pool.query(
      'SELECT id, incident_id, type, message, actor_id, created_at FROM timeline_entries WHERE incident_id = $1 ORDER BY created_at ASC',
      [incidentId],
    ),
    pool.query(
      'SELECT DISTINCT r.id, r.organization_id, r.name, r.steps FROM runbooks r JOIN actions a ON EXISTS (SELECT 1 FROM jsonb_array_elements(r.steps) AS step WHERE step->>\'id\' = a.runbook_step_id) WHERE a.incident_id = $1',
      [incidentId],
    ).catch(() => ({ rows: [] })),
    pool.query(
      'SELECT ar.id, ar.action_id, ar.agent_id, ar.success, ar.output, ar.finished_at FROM action_results ar JOIN actions a ON a.id = ar.action_id WHERE a.incident_id = $1 ORDER BY ar.finished_at ASC',
      [incidentId],
    ),
  ])

  return { incident, actions: actions.rows, runbooks: runbooks.rows, results: results.rows, timeline: timeline.rows }
}

async function insertEvent(client: PoolClient, event: Event) {
  await client.query(
    'INSERT INTO events (id, organization_id, device_id, rule_id, severity, status, title, message, created_at, updated_at, resolved_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, updated_at = EXCLUDED.updated_at, resolved_at = EXCLUDED.resolved_at',
    eventRow(event),
  )
}

async function insertIncident(client: PoolClient, incident: Incident) {
  await client.query(
    'INSERT INTO incidents (id, organization_id, event_ids, device_id, severity, status, title, created_at, updated_at) VALUES ($1,$2,$3::jsonb,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, updated_at = EXCLUDED.updated_at',
    incidentRow(incident),
  )
}

type Queryable = Pick<PoolClient, 'query'>

async function insertTimeline(client: Queryable, entry: TimelineEntry) {
  await client.query(
    'INSERT INTO timeline_entries (id, incident_id, type, message, actor_id, created_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING',
    [entry.id, entry.incidentId, entry.type, entry.message, entry.actorId ?? null, entry.createdAt],
  )
}

export async function saveRunbook(runbook: Runbook) {
  await pool.query(
    'INSERT INTO runbooks (id, organization_id, name, steps) VALUES ($1,$2,$3,$4::jsonb) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, steps = EXCLUDED.steps',
    [runbook.id, runbook.organizationId, runbook.name, JSON.stringify(runbook.steps)],
  )
}

export async function saveAction(action: Action) {
  await pool.query(
    'INSERT INTO actions (id, incident_id, runbook_step_id, type, requested_by, requires_approval, approved, approved_by, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO UPDATE SET runbook_step_id = EXCLUDED.runbook_step_id, requested_by = EXCLUDED.requested_by, requires_approval = EXCLUDED.requires_approval, approved = EXCLUDED.approved, approved_by = EXCLUDED.approved_by, status = EXCLUDED.status',
    [action.id, action.incidentId, action.runbookStepId ?? null, action.type, action.requestedBy, action.requiresApproval, action.approved, action.approvedBy ?? null, action.status],
  )
}

export async function saveAgent(agent: Agent, hostname = 'unknown', lastSeenAt = new Date()) {
  await pool.query(
    'INSERT INTO agents (id, device_id, version, connected, hostname, last_seen_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO UPDATE SET version = EXCLUDED.version, connected = EXCLUDED.connected, hostname = EXCLUDED.hostname, last_seen_at = EXCLUDED.last_seen_at',
    [agent.id, agent.deviceId, agent.version, agent.connected, hostname, lastSeenAt],
  )
}

export async function saveActionResult(result: ActionResult) {
  await pool.query(
    'INSERT INTO action_results (id, action_id, agent_id, success, output, finished_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING',
    [result.id, result.actionId, result.agentId, result.success, result.output, result.finishedAt],
  )
}

export async function appendTimeline(entry: TimelineEntry) {
  await insertTimeline(pool, entry)
}

export async function closePool() {
  await pool.end()
}
