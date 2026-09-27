import type { Event, Severity } from './rules.js'

export type IncidentStatus = 'OPEN' | 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
export type ActionType = 'GET_TOP_PROCESSES' | 'RESTART_SERVICE' | 'RUN_COMMAND'
export type TimelineType = 'EVENT' | 'INCIDENT' | 'RUNBOOK' | 'ACTION' | 'AGENT' | 'RESULT'

export interface Incident { id: string; organizationId: string; eventIds: string[]; deviceId: string; severity: Severity; status: IncidentStatus; title: string; createdAt: Date; updatedAt: Date }
export interface Runbook { id: string; organizationId: string; name: string; steps: RunbookStep[] }
export interface RunbookStep { id: string; order: number; description: string; type: 'MANUAL' | 'COMMAND' | 'HTTP' | 'CONDITION' | 'NOTIFICATION'; command?: string; approvalRequired?: boolean }
export interface Action { id: string; incidentId: string; runbookStepId?: string; type: ActionType; requestedBy: string; requiresApproval: boolean; status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' }
export interface Agent { id: string; deviceId: string; version: string; connected: boolean }
export interface ActionResult { id: string; actionId: string; agentId: string; success: boolean; output: string; finishedAt: Date }
export interface TimelineEntry { id: string; incidentId: string; type: TimelineType; message: string; actorId?: string; createdAt: Date }

export class OperationsWorkflow {
  readonly timeline: TimelineEntry[] = []
  createIncident(event: Event, id: string = crypto.randomUUID()): Incident {
    const now = event.createdAt
    const incident = { id, organizationId: event.organizationId, eventIds: [event.id], deviceId: event.deviceId, severity: event.severity, status: 'OPEN' as const, title: event.title, createdAt: now, updatedAt: now }
    this.addTimeline(incident.id, 'EVENT', `Evento detectado: ${event.title}`)
    this.addTimeline(incident.id, 'INCIDENT', 'Incidente criado')
    return incident
  }
  attachRunbook(incident: Incident, runbook: Runbook): Runbook { this.addTimeline(incident.id, 'RUNBOOK', `Runbook associado: ${runbook.name}`); return runbook }
  queueAction(incident: Incident, type: ActionType, requestedBy: string, step?: RunbookStep): Action {
    if (type === 'RUN_COMMAND' && !step?.approvalRequired) throw new Error('Arbitrary commands require explicit approval')
    const action = { id: crypto.randomUUID(), incidentId: incident.id, runbookStepId: step?.id, type, requestedBy, requiresApproval: Boolean(step?.approvalRequired), status: 'QUEUED' as const }
    incident.status = 'IN_PROGRESS'; incident.updatedAt = new Date(); this.addTimeline(incident.id, 'ACTION', `Ação enfileirada: ${type}`, requestedBy); return action
  }
  executeAction(action: Action, agent: Agent): void { if (!agent.connected) throw new Error('Agent is not connected'); action.status = 'RUNNING'; this.addTimeline(action.incidentId, 'AGENT', `Ação enviada ao agent ${agent.id}`) }
  recordResult(incident: Incident, action: Action, agent: Agent, success: boolean, output: string, finishedAt = new Date()): ActionResult {
    action.status = success ? 'SUCCEEDED' : 'FAILED'
    const result = { id: crypto.randomUUID(), actionId: action.id, agentId: agent.id, success, output, finishedAt }
    this.addTimeline(incident.id, 'RESULT', success ? 'Ação concluída com sucesso' : 'Ação falhou', agent.id)
    if (success) { incident.status = 'RESOLVED'; incident.updatedAt = finishedAt; this.addTimeline(incident.id, 'INCIDENT', 'Incidente resolvido', agent.id) }
    return result
  }
  addTimeline(incidentId: string, type: TimelineType, message: string, actorId?: string): TimelineEntry { const entry = { id: crypto.randomUUID(), incidentId, type, message, actorId, createdAt: new Date() }; this.timeline.push(entry); return entry }
}
