import React from 'react'
import { createRoot } from 'react-dom/client'
import { createEvent, type Event, type MetricSample, type Rule } from './domain/rules.js'
import { OperationsWorkflow, type Incident, type ActionResult, type Agent } from './domain/operations.js'
import './styles.css'

const stages = [
  ['01', 'Event', 'CPU acima de 90%'], ['02', 'Incident', 'INC-2048 aberto'], ['03', 'Runbook', 'RB-CPU-001 associado'], ['04', 'Action', 'Diagnóstico enfileirado'], ['05', 'Agent', 'agent-prod-07 conectado'], ['06', 'Result', 'Aguardando evidência'], ['07', 'Timeline', 'Tudo auditado']
]
const events = [
  { severity: 'CRITICAL', title: 'CPU acima de 90% por 10 minutos', device: 'prod-web-07', time: 'agora', color: 'critical' },
  { severity: 'WARNING', title: 'Latência elevada no gateway', device: 'edge-eu-02', time: 'há 4 min', color: 'warning' },
  { severity: 'INFO', title: 'Backup concluído com sucesso', device: 'db-primary-01', time: 'há 12 min', color: 'info' }
]
const demoRule: Rule = { id: 'rule-cpu-90', name: 'CPU acima de 90% por 10 minutos', metric: 'cpu', operator: '>', threshold: 90, duration: 600, severity: 'CRITICAL', runbookId: 'RB-CPU-001' }
const demoAgent: Agent = { id: 'agent-prod-07', deviceId: 'prod-web-07', version: '1.4.2', connected: true }

function App() {
  const [active, setActive] = React.useState(0)
  const [workflowState, setWorkflowState] = React.useState({ incident: 'INC-2048', result: 'Aguardando evidência', status: 'OPEN' })
  const [incidents, setIncidents] = React.useState<Incident[]>([])
  const [loadingIncidents, setLoadingIncidents] = React.useState(false)
  const loadIncidents = async () => {
    setLoadingIncidents(true)
    try {
      const response = await fetch('/api/operations?organizationId=acme')
      if (!response.ok) throw new Error('Não foi possível carregar incidentes')
      setIncidents(await response.json() as Incident[])
    } finally {
      setLoadingIncidents(false)
    }
  }
  const runWorkflow = async () => {
    const sample: MetricSample = { metric: 'cpu', value: 94, timestamp: new Date() }
    try {
      const response = await fetch('/api/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rule: demoRule, organizationId: 'acme', deviceId: demoAgent.deviceId, sample }),
      })
      if (!response.ok) throw new Error('API indisponível')
      const payload = await response.json() as { incident: Incident }
      setWorkflowState({ incident: payload.incident.id, result: 'Evento persistido', status: payload.incident.status })
      setActive(6)
    } catch {
      const workflow = new OperationsWorkflow()
      const event: Event = createEvent(demoRule, 'acme', demoAgent.deviceId, sample, 'EVT-2048')
      const incident: Incident = workflow.createIncident(event, 'INC-2048')
      const action = workflow.queueAction(incident, 'GET_TOP_PROCESSES', 'Thiago Canali')
      workflow.executeAction(action, demoAgent)
      const result: ActionResult = workflow.recordResult(incident, action, demoAgent, true, 'Top processes coletados')
      setWorkflowState({ incident: incident.id, result: result.output, status: incident.status })
      setActive(6)
    }
  }
  return <div className="app">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">M</span><span>Mons<span>Ys</span></span></div>
      <div className="workspace"><span className="workspace-dot" /> Acme Operations <span className="chevron">⌄</span></div>
      <nav><p className="nav-label">MONITORAMENTO</p><a className="active">Overview <b>3</b></a><a>Dispositivos <span>24</span></a><a>Eventos</a><a>Regras</a><p className="nav-label">OPERAÇÕES</p><a>Incidentes <b>2</b></a><a>Runbooks</a><a>Timeline</a></nav>
      <div className="sidebar-bottom"><div className="status"><i /> Todos os sistemas operacionais</div><div className="profile"><div className="avatar">TC</div><div><strong>Thiago Canali</strong><small>Administrador</small></div><span>···</span></div></div>
    </aside>
    <main>
      <header><div><p className="eyebrow">MONITORAMENTO / OVERVIEW</p><h1>Control room</h1><p className="subtitle">Transforme sinais técnicos em ações operacionais.</p></div><div className="header-actions"><button className="icon-button">⌘ K</button><button className="ghost" onClick={loadIncidents}>{loadingIncidents ? 'Carregando...' : 'Atualizar incidentes'}</button><button className="primary" onClick={runWorkflow}>Executar fluxo</button></div></header>
      <section className="metric-grid"><div className="metric-card"><span>Eventos nas últimas 24h</span><strong>128</strong><em className="up">↑ 18.4%</em><div className="sparkline"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div></div><div className="metric-card"><span>Incidentes ativos</span><strong>03</strong><em className="down">↓ 12.0%</em><div className="bars"><i/><i/><i/><i/><i/><i/><i/><i/></div></div><div className="metric-card"><span>Tempo médio de resolução</span><strong>14<span>m</span> 32<span>s</span></strong><em className="up">↓ 22.8%</em><div className="line-chart">╱╲╱╲╱╲╱╲╱</div></div><div className="metric-card"><span>Agents conectados</span><strong>24<span>/24</span></strong><em className="stable">● estável</em><div className="connection"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div></div></section>
      <section className="flow-card"><div className="section-heading"><div><p className="eyebrow">OPERATIONAL FLOW</p><h2>Event to resolution</h2></div><span className="live"><i/> LIVE</span></div><div className="flow">{stages.map(([number, label, desc], i) => <button key={label} className={`stage ${i === active ? 'selected' : ''}`} onClick={() => setActive(i)}><span className="stage-number">{number}</span><strong>{label}</strong><small>{desc}</small>{i < stages.length - 1 && <span className="arrow">→</span>}</button>)}</div></section>
      <div className="content-grid"><section className="events-card"><div className="section-heading"><div><p className="eyebrow">INCOMING SIGNALS</p><h2>Eventos recentes</h2></div><button className="link">Ver todos →</button></div><div className="table-head"><span>SEVERIDADE / EVENTO</span><span>DISPOSITIVO</span><span>RECEBIDO</span><span>STATUS</span></div>{events.map(e => <div className="event-row" key={e.title}><span className={`severity ${e.color}`}><i/>{e.severity}</span><strong>{e.title}</strong><span className="muted">{e.device}</span><span className="muted">{e.time}</span><span className={`pill ${e.color}`}>{e.color === 'critical' ? 'Incidente criado' : e.color === 'warning' ? 'Avaliando' : 'Resolvido'}</span></div>)}{incidents.length > 0 && <div className="persisted-summary"><strong>{incidents.length} incidente(s) persistido(s)</strong><span>{incidents[0].title} · {incidents[0].status}</span></div>}</section><section className="timeline-card"><div className="section-heading"><div><p className="eyebrow">ACTIVITY LOG</p><h2>Timeline</h2></div><button className="link">Abrir →</button></div><div className="timeline"><div><i className="dot critical"/><p><b>Incidente criado</b><small>{workflowState.incident} · há 2 min</small></p></div><div><i className="dot blue"/><p><b>Runbook associado</b><small>RB-CPU-001 · há 2 min</small></p></div><div><i className="dot purple"/><p><b>Ação enfileirada</b><small>GET_TOP_PROCESSES · {workflowState.status === 'OPEN' ? 'há 1 min' : 'concluída agora'}</small></p></div><div><i className="dot green"/><p><b>Agent conectado</b><small>agent-prod-07 · {workflowState.result}</small></p></div></div></section></div>
    </main>
  </div>
}

createRoot(document.getElementById('root')!).render(<App />)
