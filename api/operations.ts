import { createEvent } from '../src/domain/rules.js'
import { validateHeartbeat } from '../src/domain/agent.js'
import { OperationsWorkflow } from '../src/domain/operations.js'
import { getIncidentDetails, listIncidents, saveAction, saveActionResult, saveAgent, saveEventIncident, saveRunbook, appendTimeline } from '../src/server/operations-repository.js'

export default async function handler(request: Request): Promise<Response> {
  if (request.method === 'GET') {
    const searchParams = new URL(request.url).searchParams
    const organizationId = searchParams.get('organizationId')
    const incidentId = searchParams.get('incidentId')
    if (!organizationId) return Response.json({ error: 'organizationId is required' }, { status: 400 })
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
    if (body.type === 'heartbeat') {
      const heartbeat = validateHeartbeat({ ...body, timestamp: new Date(body.timestamp) })
      const agent = { id: `agent-${heartbeat.deviceId}`, deviceId: heartbeat.deviceId, version: heartbeat.agentVersion, connected: true as const }
      await saveAgent(agent, heartbeat.hostname, heartbeat.timestamp)
      return Response.json({ agent, status: heartbeat.status, lastSeenAt: heartbeat.timestamp, metrics: heartbeat.metrics }, { status: 200 })
    }
    const { rule, organizationId, deviceId, sample } = body
    if (!rule || !organizationId || !deviceId || !sample) return Response.json({ error: 'rule, organizationId, deviceId and sample are required' }, { status: 400 })

    const event = createEvent(rule, organizationId, deviceId, { ...sample, timestamp: new Date(sample.timestamp) })
    const workflow = new OperationsWorkflow()
    const incident = workflow.createIncident(event)
    await saveEventIncident(event, incident, workflow.timeline)

    const runbook = body.runbook ?? {
      id: 'RB-CPU-001',
      organizationId,
      name: 'Diagnóstico de CPU',
      steps: [{ id: 'step-top-processes', order: 1, description: 'Coletar processos no topo', type: 'COMMAND' as const }],
    }
    const agent = body.agent ?? { id: `agent-${deviceId}`, deviceId, version: 'unknown', connected: true }
    const actionType = body.actionType ?? 'GET_TOP_PROCESSES'
    const action = workflow.queueAction(incident, actionType, body.requestedBy ?? 'system', runbook.steps[0])
    workflow.attachRunbook(incident, runbook)
    workflow.executeAction(action, agent)
    const result = workflow.recordResult(incident, action, agent, true, body.output ?? 'Diagnóstico executado')

    await saveRunbook(runbook)
    await saveAgent(agent)
    await saveAction(action)
    await saveActionResult(result)
    for (const entry of workflow.timeline.slice(2)) await appendTimeline(entry)
    return Response.json({ event, incident, runbook, action, agent, result, timeline: workflow.timeline }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create event'
    return Response.json({ error: message }, { status: 422 })
  }
}
