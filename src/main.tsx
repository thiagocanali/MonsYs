import React from 'react'
import { createRoot } from 'react-dom/client'
import { AuthPanel } from './AuthPanel.js'
import { OrganizationSetup } from './OrganizationSetup.js'
import './styles.css'

interface Session { user: { name: string; email: string } }
interface Organization { id: string; name: string; role: string }
interface Incident { id: string; title: string; status: string; severity: string; device_id: string; created_at: string }
interface IncidentDetails {
  incident: Incident
  timeline: Array<{ id: string; message: string; created_at: string }>
  actions: Array<{ id: string; type: string; status: string }>
  runbooks: Array<{ id: string; name: string }>
  results: Array<{ id: string; success: boolean; output: string }>
}

async function getJSON<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { credentials: 'include', cache: 'no-store', signal })
  if (!response.ok) throw new Error('Não foi possível carregar os dados. Tente novamente.')
  return response.json() as Promise<T>
}

function Dashboard({ session, organizations, onSignOut }: { session: Session; organizations: Organization[]; onSignOut: () => Promise<void> }) {
  const [organizationId, setOrganizationId] = React.useState(organizations[0].id)
  const [incidents, setIncidents] = React.useState<Incident[]>([])
  const [details, setDetails] = React.useState<IncidentDetails | null>(null)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [revision, setRevision] = React.useState(0)
  const [signingOut, setSigningOut] = React.useState(false)

  React.useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    void getJSON<Incident[]>(`/api/operations?organizationId=${encodeURIComponent(organizationId)}&limit=200`, controller.signal)
      .then(items => { if (!controller.signal.aborted) setIncidents(items) })
      .catch(() => { if (!controller.signal.aborted) setError('Não foi possível carregar os incidentes.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [organizationId, revision])

  React.useEffect(() => {
    if (!selectedId) return
    const controller = new AbortController()
    setDetails(null)
    void getJSON<IncidentDetails>(`/api/operations?organizationId=${encodeURIComponent(organizationId)}&incidentId=${encodeURIComponent(selectedId)}`, controller.signal)
      .then(item => { if (!controller.signal.aborted) setDetails(item) })
      .catch(() => { if (!controller.signal.aborted) setError('Não foi possível carregar os detalhes.') })
    return () => controller.abort()
  }, [organizationId, selectedId, revision])

  const selectOrganization = (id: string) => {
    setIncidents([])
    setSelectedId(null)
    setDetails(null)
    setOrganizationId(id)
  }
  const signOut = async () => {
    setSigningOut(true)
    try { await onSignOut() }
    catch { setError('Não foi possível sair. Tente novamente.') }
    finally { setSigningOut(false) }
  }
  const activeCount = incidents.filter(incident => !['RESOLVED', 'CLOSED'].includes(incident.status)).length
  return <div className="app">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">M</span><span>Mons<span>Ys</span></span></div>
      <label className="workspace-selector"><select aria-label="Selecionar organização" value={organizationId} onChange={event => selectOrganization(event.target.value)}>{organizations.map(organization => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label>
      <nav><p className="nav-label">OPERAÇÕES</p><a href="#incidents" className="active">Incidentes</a></nav>
      <div className="sidebar-bottom"><div className="profile"><div className="avatar">{session.user.name.slice(0, 2).toUpperCase()}</div><div><strong>{session.user.name}</strong><small>{organizations.find(organization => organization.id === organizationId)?.role}</small></div><button className="profile-action" disabled={signingOut} onClick={() => void signOut()}>Sair</button></div></div>
    </aside>
    <main>
      <header><div><p className="eyebrow">MONITORAMENTO / INCIDENTES</p><h1>Control room</h1><p className="subtitle">Acompanhe os incidentes da sua organização.</p></div><button className="primary" disabled={loading} onClick={() => setRevision(value => value + 1)}>{loading ? 'Carregando...' : 'Atualizar'}</button></header>
      {error && <p className="form-error" role="alert">{error}</p>}
      <section className="metric-grid"><div className="metric-card"><span>Incidentes carregados (até 200)</span><strong>{loading || error ? '—' : incidents.length}</strong></div><div className="metric-card"><span>Ativos nesta lista</span><strong>{loading || error ? '—' : activeCount}</strong></div></section>
      <div className="content-grid"><section id="incidents" className="events-card" aria-busy={loading}><div className="section-heading"><h2>Incidentes recentes</h2></div>
        {!loading && !error && incidents.length === 0 && <p>Nenhum incidente registrado nesta organização.</p>}
        {incidents.map(incident => <article className="persisted-summary" key={incident.id}><strong>{incident.title}</strong><span>{incident.device_id} · {incident.severity} · {incident.status}</span><time dateTime={incident.created_at}>{new Date(incident.created_at).toLocaleString('pt-BR')}</time><button className="link" onClick={() => { if (selectedId !== incident.id) { setDetails(null); setSelectedId(incident.id) } }}>Ver detalhes →</button></article>)}
      </section><section className="timeline-card"><div className="section-heading"><h2>Detalhes e timeline</h2></div>
        {!selectedId && <p>Selecione um incidente para consultar as evidências.</p>}
        {selectedId && !details && !error && <p role="status">Carregando detalhes...</p>}
        {details && <><h3>{details.incident.title}</h3><p>{details.incident.status} · {details.actions.length} ações · {details.runbooks.length} runbooks</p><ol>{details.timeline.map(entry => <li key={entry.id}>{entry.message} <time dateTime={entry.created_at}>{new Date(entry.created_at).toLocaleString('pt-BR')}</time></li>)}</ol>{details.results.map(result => <p key={result.id}>{result.success ? 'Sucesso' : 'Falha'}: {result.output}</p>)}</>}
      </section></div>
    </main>
  </div>
}

function App() {
  const [session, setSession] = React.useState<Session | null>(null)
  const [organizations, setOrganizations] = React.useState<Organization[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [organizationError, setOrganizationError] = React.useState('')
  const loadSession = React.useCallback(async () => {
    setLoading(true)
    setError('')
    setOrganizationError('')
    try {
      const current = await getJSON<Session | null>('/api/auth/get-session')
      setSession(current)
      if (!current?.user) {
        setOrganizations([])
        return
      }
      try {
        const memberships = await getJSON<Organization[]>('/api/organizations')
        setOrganizations(memberships)
      } catch {
        setOrganizations([])
        setOrganizationError('Sua sessão está ativa, mas não foi possível carregar as organizações. Tente novamente.')
      }
    } catch {
      setError('Não foi possível verificar sua sessão. Tente novamente.')
    } finally { setLoading(false) }
  }, [])
  React.useEffect(() => { void loadSession() }, [loadSession])
  const signOut = async () => {
    const response = await fetch('/api/auth/sign-out', { method: 'POST', credentials: 'include' })
    if (!response.ok) throw new Error('Sign-out failed')
    const remaining = await getJSON<Session | null>('/api/auth/get-session')
    if (remaining?.user) throw new Error('Session is still active')
    setSession(null)
    setOrganizations([])
  }
  if (loading) return <div className="auth-shell"><p role="status">Carregando sessão...</p></div>
  if (error) return <div className="auth-shell"><section className="auth-panel"><p role="alert">{error}</p><button onClick={() => void loadSession()}>Tentar novamente</button></section></div>
  if (!session) return <div className="auth-shell"><AuthPanel onAuthenticated={loadSession} /></div>
  if (organizationError) return <div className="auth-shell"><section className="auth-panel"><p role="alert">{organizationError}</p><button className="primary" onClick={() => void loadSession()}>Tentar novamente</button></section></div>
  if (organizations.length === 0) return <div className="auth-shell"><OrganizationSetup onCreated={loadSession} /></div>
  return <Dashboard session={session} organizations={organizations} onSignOut={signOut} />
}

createRoot(document.getElementById('root')!).render(<App />)
