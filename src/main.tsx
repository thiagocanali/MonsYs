import React from 'react'
import { createRoot } from 'react-dom/client'
import { AuthPanel } from './AuthPanel.js'
import { OrganizationSetup } from './OrganizationSetup.js'
import type { MetricSample, Rule } from './domain/rules.js'
import type { Incident } from './domain/operations.js'
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

function App() {
  const [session, setSession] = React.useState<{ user: { name: string; email: string } } | null>(null)
  const [authLoading, setAuthLoading] = React.useState(true)
  const [active, setActive] = React.useState(0)
  const [workflowState, setWorkflowState] = React.useState({ incident: 'INC-2048', result: 'Aguardando evidência', status: 'OPEN' })
  const [incidents, setIncidents] = React.useState<Incident[]>([])
  const [selectedIncident, setSelectedIncident] = React.useState<any>(null)
  const [loadingIncidents, setLoadingIncidents] = React.useState(false)
  const [loadingDetails, setLoadingDetails] = React.useState(false)
  const [organizationId, setOrganizationId] = React.useState<string | null>(null)
  const [organizations, setOrganizations] = React.useState<Array<{ id: string; name: string; role: string }>>([])

  const loadSession = React.useCallback(async () => {
    try {
      const response = await fetch('/api/auth/get-session', { credentials: 'include' })
      const payload = response.ok ? await response.json() : null
      setSession(payload)
      if (payload?.user) {
        const memberships = await fetch('/api/organizations', { credentials: 'include' }).then(result => result.json())
        setOrganizations(memberships)
        setOrganizationId(memberships[0]?.id ?? null)
      }
    } finally {
      setAuthLoading(false)
    }
  }, [])

  React.useEffect(() => { void loadSession() }, [loadSession])

  if (authLoading) return <div className="auth-shell"><p>Carregando sessão...</p></div>
  if (!session) return <div className="auth-shell"><AuthPanel onAuthenticated={loadSession} /></div>
  if (!organizationId) return <div className="auth-shell"><OrganizationSetup onCreated={loadSession} /></div>

  const signOut = async () => {
    await fetch('/api/auth/sign-out', { method: 'POST', credentials: 'include' })
    setSession(null)
    setOrganizations([])
    setOrganizationId(null)
  }

  const loadIncidents = async () => {
    setLoadingIncidents(true)
    try {
      const response = await fetch(`/api/operations?organizationId=${encodeURIComponent(organizationId ?? '')}`)
      if (!response.ok) throw new Error('Não foi possível carregar incidentes')
      setIncidents(await response.json() as Incident[])
    } finally {
      setLoadingIncidents(false)
    }
  }
  const loadIncidentDetails = async (incidentId: string) => {
    setLoadingDetails(true)
    try {
      const response = await fetch(`/api/operations?organizationId=${encodeURIComponent(organizationId ?? '')}&incidentId=${encodeURIComponent(incidentId)}`)
      if (!response.ok) throw new Error('Não foi possível carregar o incidente')
      setSelectedIncident(await response.json())
    } finally {
      setLoadingDetails(false)
    }
  }
  const runWorkflow = async () => {
    const sample: MetricSample = { metric: 'cpu', value: 94, timestamp: new Date() }
    try {
      const response = await fetch('/api/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rule: demoRule, organizationId, deviceId: demoAgent.deviceId, sample }),
      })
      if (!response.ok) throw new Error('API indisponível')
      const payload = await response.json() as { incident: Incident }
      setWorkflowState({ incident: payload.incident.id, result: 'Evento persistido', status: payload.incident.status })
      setActive(6)
    } catch {
      setWorkflowState({
        incident: 'Não criado',
        result: 'Falha ao conectar à API. Nenhuma ação foi executada.',
        status: 'ERROR',
      })
      setActive(6)
    }
  }
  return <div className="app">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">M</span><span>Mons<span>Ys</span></span></div>
      <label className="workspace-selector"><span className="workspace-dot" /><select aria-label="Selecionar organização" value={organizationId} onChange={event => setOrganizationId(event.target.value)}>{organizations.map(organization => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select><span className="chevron">⌄</span></label>
      <nav><p className="nav-label">MONITORAMENTO</p><a className="active">Overview <b>3</b></a><a>Dispositivos <span>24</span></a><a>Eventos</a><a>Regras</a><p className="nav-label">OPERAÇÕES</p><a>Incidentes <b>2</b></a><a>Runbooks</a><a>Timeline</a></nav>
      <div className="sidebar-bottom"><div className="status"><i /> Todos os sistemas operacionais</div><div className="profile"><div className="avatar">{session.user.name.slice(0, 2).toUpperCase()}</div><div><strong>{session.user.name}</strong><small>{organizations.find(organization => organization.id === organizationId)?.role ?? 'Membro'}</small></div><button className="profile-action" onClick={signOut} aria-label="Sair">Sair</button></div></div>
    </aside>
    <main>
      <header><div><p className="eyebrow">MONITORAMENTO / OVERVIEW</p><h1>Control room</h1><p className="subtitle">Transforme sinais técnicos em ações operacionais.</p></div><div className="header-actions"><button className="icon-button">⌘ K</button><button className="ghost" onClick={loadIncidents}>{loadingIncidents ? 'Carregando...' : 'Atualizar incidentes'}</button><button className="primary" onClick={runWorkflow}>Executar fluxo</button></div></header>
      <section className="metric-grid"><div className="metric-card"><span>Eventos nas últimas 24h</span><strong>128</strong><em className="up">↑ 18.4%</em><div className="sparkline"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div></div><div className="metric-card"><span>Incidentes ativos</span><strong>03</strong><em className="down">↓ 12.0%</em><div className="bars"><i/><i/><i/><i/><i/><i/><i/><i/></div></div><div className="metric-card"><span>Tempo médio de resolução</span><strong>14<span>m</span> 32<span>s</span></strong><em className="up">↓ 22.8%</em><div className="line-chart">╱╲╱╲╱╲╱╲╱</div></div><div className="metric-card"><span>Agents conectados</span><strong>24<span>/24</span></strong><em className="stable">● estável</em><div className="connection"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div></div></section>
      <section className="flow-card"><div className="section-heading"><div><p className="eyebrow">OPERATIONAL FLOW</p><h2>Event to resolution</h2></div><span className="live"><i/> LIVE</span></div><div className="flow">{stages.map(([number, label, desc], i) => <button key={label} className={`stage ${i === active ? 'selected' : ''}`} onClick={() => setActive(i)}><span className="stage-number">{number}</span><strong>{label}</strong><small>{desc}</small>{i < stages.length - 1 && <span className="arrow">→</span>}</button>)}</div></section>
      <div className="content-grid"><section className="events-card"><div className="section-heading"><div><p className="eyebrow">INCOMING SIGNALS</p><h2>Eventos recentes</h2></div><button className="link">Ver todos →</button></div><div className="table-head"><span>SEVERIDADE / EVENTO</span><span>DISPOSITIVO</span><span>RECEBIDO</span><span>STATUS</span></div>{events.map(e => <div className="event-row" key={e.title}><span className={`severity ${e.color}`}><i/>{e.severity}</span><strong>{e.title}</strong><span className="muted">{e.device}</span><span className="muted">{e.time}</span><span className={`pill ${e.color}`}>{e.color === 'critical' ? 'Incidente criado' : e.color === 'warning' ? 'Avaliando' : 'Resolvido'}</span></div>)}{incidents.length > 0 && <div className="persisted-summary"><strong>{incidents.length} incidente(s) persistido(s)</strong><span>{incidents[0].title} · {incidents[0].status}</span><button className="link" onClick={() => loadIncidentDetails(incidents[0].id)}>{loadingDetails ? 'Carregando...' : 'Ver detalhes →'}</button></div>}{selectedIncident && <div className="incident-detail" role="status"><div><span className={`pill ${selectedIncident.incident.status === 'RESOLVED' ? 'info' : 'critical'}`}>{selectedIncident.incident.status}</span><strong>{selectedIncident.incident.title}</strong></div><span>{selectedIncident.runbooks?.length ?? 0} runbook(s) · {selectedIncident.actions?.length ?? 0} ação(ões) · {selectedIncident.timeline?.length ?? 0} eventos na timeline</span></div>}</section><section className="timeline-card"><div className="section-heading"><div><p className="eyebrow">ACTIVITY LOG</p><h2>Timeline</h2></div><button className="link">Abrir →</button></div><div className="timeline"><div><i className="dot critical"/><p><b>Incidente criado</b><small>{workflowState.incident} · há 2 min</small></p></div><div><i className="dot blue"/><p><b>Runbook associado</b><small>RB-CPU-001 · há 2 min</small></p></div><div><i className="dot purple"/><p><b>Ação enfileirada</b><small>GET_TOP_PROCESSES · {workflowState.status === 'OPEN' ? 'há 1 min' : 'concluída agora'}</small></p></div><div><i className="dot green"/><p><b>Agent conectado</b><small>agent-prod-07 · {workflowState.result}</small></p></div></div></section></div>
    </main>
  </div>
}

createRoot(document.getElementById('root')!).render(<App />)
