import { createEvent } from '../src/domain/rules.js'
import { OperationsWorkflow } from '../src/domain/operations.js'
import { listIncidents, saveEventIncident } from '../src/server/operations-repository.js'

export default async function handler(request: Request): Promise<Response> {
  if (request.method === 'GET') {
    const organizationId = new URL(request.url).searchParams.get('organizationId')
    if (!organizationId) return Response.json({ error: 'organizationId is required' }, { status: 400 })
    return Response.json(await listIncidents(organizationId))
  }

  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 })

  try {
    const body = await request.json()
    const { rule, organizationId, deviceId, sample } = body
    if (!rule || !organizationId || !deviceId || !sample) return Response.json({ error: 'rule, organizationId, deviceId and sample are required' }, { status: 400 })

    const event = createEvent(rule, organizationId, deviceId, { ...sample, timestamp: new Date(sample.timestamp) })
    const workflow = new OperationsWorkflow()
    const incident = workflow.createIncident(event)
    await saveEventIncident(event, incident, workflow.timeline)
    return Response.json({ event, incident, timeline: workflow.timeline }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create event'
    return Response.json({ error: message }, { status: 422 })
  }
}
