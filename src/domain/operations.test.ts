import { describe, expect, it } from 'vitest'
import { createEvent, type Rule } from './rules.js'
import { OperationsWorkflow, type Agent, type Runbook } from './operations.js'

const rule: Rule = { id: 'rule-1', name: 'CPU alta', metric: 'cpu_usage', operator: '>', threshold: 90, duration: 0, severity: 'CRITICAL' }
const event = createEvent(rule, 'org-1', 'device-1', { metric: 'cpu_usage', value: 95, timestamp: new Date('2026-01-01T10:00:00Z') }, 'event-1')
const agent: Agent = { id: 'agent-1', deviceId: 'device-1', version: '1.0.0', connected: true }
const runbook: Runbook = { id: 'rb-1', organizationId: 'org-1', name: 'Diagnóstico CPU', steps: [{ id: 'step-1', order: 1, description: 'Coletar processos', type: 'COMMAND' }] }

describe('Event → Incident → Runbook → Action → Agent → Result → Timeline', () => {
  it('executa o fluxo completo e resolve o incidente', () => {
    const workflow = new OperationsWorkflow()
    const incident = workflow.createIncident(event, 'incident-1')
    workflow.attachRunbook(incident, runbook)
    const action = workflow.queueAction(incident, 'GET_TOP_PROCESSES', 'operator-1', runbook.steps[0])
    workflow.executeAction(action, agent)
    const result = workflow.recordResult(incident, action, agent, true, 'java.exe: 92%', new Date('2026-01-01T10:01:00Z'))
    expect(result.success).toBe(true)
    expect(incident.status).toBe('RESOLVED')
    expect(workflow.timeline.map(entry => entry.type)).toEqual(['EVENT', 'INCIDENT', 'RUNBOOK', 'ACTION', 'AGENT', 'RESULT', 'INCIDENT'])
  })

  it('bloqueia comando arbitrário sem aprovação explícita', () => {
    const workflow = new OperationsWorkflow()
    const incident = workflow.createIncident(event)
    expect(() => workflow.queueAction(incident, 'RUN_COMMAND', 'operator-1')).toThrow('explicit approval')
  })

  it('exige aprovação antes de executar ações sensíveis', () => {
    const workflow = new OperationsWorkflow()
    const incident = workflow.createIncident(event)
    const step = { id: 'step-command', order: 1, description: 'Executar comando', type: 'COMMAND' as const, approvalRequired: true }
    const action = workflow.queueAction(incident, 'RUN_COMMAND', 'operator-1', step)

    expect(action.approved).toBe(false)
    expect(() => workflow.executeAction(action, agent)).toThrow('explicit approval')

    workflow.approveAction(action, 'admin-1')
    expect(action.approved).toBe(true)
    expect(action.approvedBy).toBe('admin-1')
    expect(() => workflow.executeAction(action, agent)).not.toThrow()
  })

  it('exige um aprovador válido', () => {
    const workflow = new OperationsWorkflow()
    const incident = workflow.createIncident(event)
    const step = { id: 'step-command', order: 1, description: 'Executar comando', type: 'COMMAND' as const, approvalRequired: true }
    const action = workflow.queueAction(incident, 'RUN_COMMAND', 'operator-1', step)

    expect(() => workflow.approveAction(action, '')).toThrow('Approver is required')
  })

  it('não executa ação em agent desconectado', () => {
    const workflow = new OperationsWorkflow()
    const incident = workflow.createIncident(event)
    const action = workflow.queueAction(incident, 'GET_TOP_PROCESSES', 'operator-1')
    expect(() => workflow.executeAction(action, { ...agent, connected: false })).toThrow('not connected')
  })

  it('não aceita resultado antes do agent executar a ação', () => {
    const workflow = new OperationsWorkflow()
    const incident = workflow.createIncident(event)
    const action = workflow.queueAction(incident, 'GET_TOP_PROCESSES', 'operator-1')

    expect(() => workflow.recordResult(incident, action, agent, true, 'resultado')).toThrow('must be running')
  })

  it('mantém incidente em investigação quando a ação falha', () => {
    const workflow = new OperationsWorkflow()
    const incident = workflow.createIncident(event)
    const action = workflow.queueAction(incident, 'GET_TOP_PROCESSES', 'operator-1')
    workflow.executeAction(action, agent)
    const finishedAt = new Date('2026-01-01T10:02:00Z')

    const result = workflow.recordResult(incident, action, agent, false, 'service unavailable', finishedAt)

    expect(result.success).toBe(false)
    expect(action.status).toBe('FAILED')
    expect(incident.status).toBe('IN_PROGRESS')
    expect(incident.updatedAt).toBe(finishedAt)
    expect(workflow.timeline.at(-1)?.message).toBe('Incidente permanece em investigação')
  })
})
