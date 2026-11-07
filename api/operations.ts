import { createEvent, RuleEngine, type Rule } from '../src/domain/rules.js'
import { validateHeartbeat } from '../src/domain/agent.js'
import { OperationsWorkflow } from '../src/domain/operations.js'
import { requireOrganizationAccess } from '../src/server/tenant-auth.js'
import {
  getIncidentDetails,
  listAuditLogs,
  listIncidents,
  listTelemetrySamples,
  saveAgent,
  saveEventIncident,
  saveTelemetrySample,
} from '../src/server/operations-repository.js'

const ruleEngine = new RuleEngine()

export default async function handler(request: Request): Promise<Response> {
  if (request.method === 'GET') {
    try {
      const searchParams = new URL(request.url).searchParams
      const organizationId = searchParams.get('organizationId')?.trim()
      const incidentId = searchParams.get('incidentId')?.trim()
      const deviceId = searchParams.get('deviceId')?.trim()
      const resourceId = searchParams.get('resourceId')?.trim()
      const metric = searchParams.get('metric')?.trim() || undefined
      const requestedLimit = Number.parseInt(searchParams.get('limit') ?? '100', 10)
      const requestedOffset = Number.parseInt(searchParams.get('offset') ?? '0', 10)
      const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 200) : 100
      const offset = Number.isInteger(requestedOffset) ? Math.max(requestedOffset, 0) : 0

      if (!organizationId) return Response.json({ error: 'organizationId is required' }, { status: 400 })
      const access = await requireOrganizationAccess(request, organizationId)
      if ('response' in access) return access.response
      if (searchParams.get('audit') === 'true') {
        return Response.json(await listAuditLogs(organizationId, resourceId, limit, offset))
      }
      if (deviceId) return Response.json(await listTelemetrySamples(organizationId, deviceId, metric))
      if (incidentId) {
        const details = await getIncidentDetails(organizationId, incidentId)
        if (!details) return Response.json({ error: 'Incident not found' }, { status: 404 })
        return Response.json(details)
      }
      return Response.json(await listIncidents(organizationId))
    } catch {
      return Response.json({ error: 'Unable to load operations data' }, { status: 500 })
    }
  }

  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  try {
    const body: unknown = await request.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return Response.json({ error: 'Request body must be a JSON object' }, { status: 400 })
    }

    const payload = body as Record<string, unknown>

    if (payload.type === 'telemetry') {
      const { organizationId, deviceId, metric, value, timestamp, id } = payload
      const normalizedOrganizationId = typeof organizationId === 'string' ? organizationId.trim() : ''
      const normalizedDeviceId = typeof deviceId === 'string' ? deviceId.trim() : ''
      const normalizedMetric = typeof metric === 'string' ? metric.trim() : ''

      if (
        !normalizedOrganizationId ||
        !normalizedDeviceId ||
        !normalizedMetric ||
        normalizedMetric.length > 100 ||
        normalizedOrganizationId.length > 200 ||
        normalizedDeviceId.length > 200 ||
        typeof value !== 'number' ||
        !Number.isFinite(value)
      ) {
        return Response.json(
          { error: 'organizationId, deviceId, metric and a finite numeric value are required' },
          { status: 400 },
        )
      }

      const access = await requireOrganizationAccess(request, normalizedOrganizationId, ['ADMIN', 'OPERATOR'])
      if ('response' in access) return access.response

      const recordedAt = new Date(typeof timestamp === 'string' || typeof timestamp === 'number' ? timestamp : Date.now())
      if (Number.isNaN(recordedAt.getTime())) {
        return Response.json({ error: 'timestamp must be a valid date' }, { status: 400 })
      }

      const sampleId = typeof id === 'string' && id.trim() ? id.trim() : crypto.randomUUID()
      if (sampleId.length > 200) return Response.json({ error: 'id must contain at most 200 characters' }, { status: 400 })

      const sample = {
        id: sampleId,
        organizationId: normalizedOrganizationId,
        deviceId: normalizedDeviceId,
        metric: normalizedMetric,
        value,
        recordedAt,
      }
      const inserted = await saveTelemetrySample(sample)
      if (!inserted) return Response.json({ sample, duplicate: true }, { status: 200 })

      if (payload.rule) {
        const rule = payload.rule as Rule
        const evaluation = ruleEngine.evaluate(
          rule,
          { metric: normalizedMetric, value, timestamp: recordedAt },
          recordedAt,
          `${normalizedOrganizationId}:${normalizedDeviceId}:${rule.id}`,
        )

        if (evaluation.matched) {
          const event = createEvent(rule, normalizedOrganizationId, normalizedDeviceId, {
            metric: normalizedMetric,
            value,
            timestamp: recordedAt,
          })
          const workflow = new OperationsWorkflow()
          const incident = workflow.createIncident(event)
          await saveEventIncident(event, incident, workflow.timeline)
          return Response.json({ sample, evaluation, event, incident, timeline: workflow.timeline }, { status: 201 })
        }

        return Response.json({ sample, evaluation }, { status: 201 })
      }

      return Response.json({ sample }, { status: 201 })
    }

    if (payload.type === 'heartbeat') {
      const heartbeat = validateHeartbeat({
        deviceId: String(payload.deviceId ?? ''),
        hostname: String(payload.hostname ?? ''),
        agentVersion: String(payload.agentVersion ?? ''),
        timestamp: new Date(
          typeof payload.timestamp === 'string' || typeof payload.timestamp === 'number'
            ? payload.timestamp
            : Date.now(),
        ),
        metrics: payload.metrics as { cpu: number; memory: number; disk: number },
      })
      const agent = {
        id: `agent-${heartbeat.deviceId}`,
        deviceId: heartbeat.deviceId,
        version: heartbeat.agentVersion,
        connected: true as const,
      }
      await saveAgent(agent, heartbeat.hostname, heartbeat.timestamp)
      return Response.json(
        { agent, status: heartbeat.status, lastSeenAt: heartbeat.timestamp, metrics: heartbeat.metrics },
        { status: 200 },
      )
    }

    const { rule, organizationId, deviceId, sample } = payload
    const normalizedOrganizationId = typeof organizationId === 'string' ? organizationId.trim() : ''
    const normalizedDeviceId = typeof deviceId === 'string' ? deviceId.trim() : ''

    if (
      !rule ||
      !normalizedOrganizationId ||
      !normalizedDeviceId ||
      !sample ||
      typeof sample !== 'object' ||
      Array.isArray(sample) ||
      typeof (sample as Record<string, unknown>).metric !== 'string' ||
      typeof (sample as Record<string, unknown>).value !== 'number' ||
      !Number.isFinite((sample as Record<string, unknown>).value)
    ) {
      return Response.json(
        { error: 'rule, organizationId, deviceId and a valid sample are required' },
        { status: 400 },
      )
    }

    const access = await requireOrganizationAccess(request, normalizedOrganizationId, ['ADMIN', 'OPERATOR'])
    if ('response' in access) return access.response

    const samplePayload = sample as { metric: string; value: number; timestamp?: string | number | Date }
    const sampleTimestamp = new Date(samplePayload.timestamp ?? Date.now())
    if (Number.isNaN(sampleTimestamp.getTime())) {
      return Response.json({ error: 'sample.timestamp must be a valid date' }, { status: 400 })
    }

    const event = createEvent(
      rule as Rule,
      normalizedOrganizationId,
      normalizedDeviceId,
      { ...samplePayload, metric: samplePayload.metric.trim(), timestamp: sampleTimestamp },
    )
    const workflow = new OperationsWorkflow()
    const incident = workflow.createIncident(event)
    await saveEventIncident(event, incident, workflow.timeline)

    return Response.json(
      {
        event,
        incident,
        timeline: workflow.timeline,
        automation: {
          executed: false,
          reason: 'No real agent execution is configured. The incident was persisted without fabricating a successful action.',
        },
      },
      { status: 201 },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create operation'
    return Response.json({ error: message }, { status: 422 })
  }
}
