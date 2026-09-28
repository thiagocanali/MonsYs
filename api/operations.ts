import { createEvent, RuleEngine, type Rule } from '../src/domain/rules.js'
import { validateHeartbeat } from '../src/domain/agent.js'
import { OperationsWorkflow } from '../src/domain/operations.js'
import { getIncidentDetails, listIncidents, listTelemetrySamples, saveAction, saveActionResult, saveAgent, saveEventIncident, saveIncident, saveRunbook, appendTimeline, saveTelemetrySample } from '../src/server/operations-repository.js'

const ruleEngine = new RuleEngine()

export default async function handler(request: Request): Promise<Response> {
  if (request.method === 'GET') {
    const searchParams = new URL(request.url).searchParams
    const organizationId = searchParams.get('organizationId')
    const incidentId = searchParams.get('incidentId')
    const deviceId = searchParams.get('deviceId')
    const metric = searchParams.get('metric') ?? undefined
    if (!organizationId) return Response.json({ error: 'organizationId is required' }, { status: 400 })
    if (deviceId) return Response.json(await listTelemetrySamples(organizationId, deviceId, metric))
    if (incidentId) {
      const details = await getIncidentDetails(organizationId, incidentId)
      if (!details) return Response.json({ error: 'Incident not found' }, { status: 404 })
      return Response.json(details)
    }
    return Response.json(await listIncidents(organizationId))
  }

  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 })

  try {
    const body = await request.json()
    if (body.type === 'telemetry') {
      const { organizationId, deviceId, metric, value, timestamp } = body
      const normalizedOrganizationId = typeof organizationId === 'string' ? organizationId.trim() : ''
      const normalizedDeviceId = typeof deviceId === 'string' ? deviceId.trim() : ''
      const normalizedMetric = typeof metric === 'string' ? metric.trim() : ''
      if (!normalizedOrganizationId || !normalizedDeviceId || !normalizedMetric || normalizedMetric.length > 100 || normalizedOrganizationId.length > 200 || normalizedDeviceId.length > 200 || !Number.isFinite(value)) {
        return Response.json({ error: 'organizationId, deviceId and a valid metric/value are required' }, { status: 400 })
      }
      const recordedAt = new Date(timestamp ?? Date.now())
      if (Number.isNaN(recordedAt.getTime())) return Response.json({ error: 'timestamp must be a valid date' }, { status: 400 })
      const sampleId = typeof body.id === 'string' && body.id.trim() ? body.id.trim() : crypto.randomUUID()
      if (sampleId.length > 200) return Response.json({ error: 'id must contain at most 200 characters' }, { status: 400 })
      const sample = { id: sampleId, organizationId: normalizedOrganizationId, deviceId: normalizedDeviceId, metric: normalizedMetric, value, recordedAt }
      const inserted = await saveTelemetrySample(sample)
      if (!inserted) return Response.json({ sample, duplicate: true }, { status: 200 })

      if (body.rule) {
        const evaluation = ruleEngine.evaluate(body.rule as Rule, { metric: normalizedMetric, value, timestamp: recordedAt }, recordedAt, `${normalizedOrganizationId}:${normalizedDeviceId}:${body.rule.id}`)
        if (evaluation.matched) {
          const event = createEvent(body.rule as Rule, normalizedOrganizationId, normalizedDeviceId, { metric: normalizedMetric, value, timestamp: recordedAt })
          const workflow = new OperationsWorkflow()
          const incident = workflow.createIncident(event)
          await saveEventIncident(event, incident, workflow.timeline)
          return Response.json({ sample, evaluation, event, incident, timeline: workflow.timeline }, { status: 201 })
        }
        return Response.json({ sample, evaluation }, { status: 201 })
      }

      return Response.json({ sample }, { status: 201 })
    }
    if (body.type === 'heartbeat') {
      const heartbeat = validateHeartbeat({ ...body, timestamp: new Date(body.timestamp ?? Date.now()) })
      const agent = { id: `agent-${heartbeat.deviceId}`, deviceId: heartbeat.deviceId, version: heartbeat.agentVersion, connected: true as const }
      await saveAgent(agent, heartbeat.hostname, heartbeat.timestamp)
      return Response.json({ agent, status: heartbeat.status, lastSeenAt: heartbeat.timestamp, metrics: heartbeat.metrics }, { status: 200 })
    }
    const { rule, organizationId, deviceId, sample } = body
    const normalizedOrganizationId = typeof organizationId === 'string' ? organizationId.trim() : ''
    const normalizedDeviceId = typeof deviceId === 'string' ? deviceId.trim() : ''
    if (!rule || !normalizedOrganizationId || !normalizedDeviceId || !sample || typeof sample.metric !== 'string' || !Number.isFinite(sample.value)) {
      return Response.json({ error: 'rule, organizationId, deviceId and a valid sample are required' }, { status: 400 })
    }
    const sampleTimestamp = new Date(sample.timestamp ?? Date.now())
    if (Number.isNaN(sampleTimestamp.getTime())) return Response.json({ error: 'sample.timestamp must be a valid date' }, { status: 400 })

    const event = createEvent(rule, normalizedOrganizationId, normalizedDeviceId, { ...sample, metric: sample.metric.trim(), timestamp: sampleTimestamp })
    const workflow = new OperationsWorkflow()
    const incident = workflow.createIncident(event)
    await saveEventIncident(event, incident, workflow.timeline)

    const runbook = body.runbook ?? {
      id: 'RB-CPU-001',
      organizationId: normalizedOrganizationId,
      name: 'Diagnóstico de CPU',
      steps: [{ id: 'step-top-processes', order: 1, description: 'Coletar processos no topo', type: 'COMMAND' as const }],
    }
    const agent = body.agent ?? { id: `agent-${normalizedDeviceId}`, deviceId: normalizedDeviceId, version: 'unknown', connected: true }
    const actionType = body.actionType ?? 'GET_TOP_PROCESSES'
    const action = workflow.queueAction(incident, actionType, body.requestedBy ?? 'system', runbook.steps[0])
    workflow.attachRunbook(incident, runbook)
    workflow.executeAction(action, agent)
    const result = workflow.recordResult(incident, action, agent, true, body.output ?? 'Diagnóstico executado')

    await saveRunbook(runbook)
    await saveAgent(agent)
    await saveIncident(incident)
    await saveAction(action)
    await saveActionResult(result)
    for (const entry of workflow.timeline.slice(2)) await appendTimeline(entry)
    return Response.json({ event, incident, runbook, action, agent, result, timeline: workflow.timeline }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create event'
    return Response.json({ error: message }, { status: 422 })
  }
}
