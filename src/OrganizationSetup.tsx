import React from 'react'

export function OrganizationSetup({ onCreated }: { onCreated: () => Promise<void> }) {
  const [name, setName] = React.useState('')
  const [slug, setSlug] = React.useState('')
  const [error, setError] = React.useState('')
  const [pending, setPending] = React.useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      const response = await fetch('/api/organizations', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, slug }) })
      if (!response.ok) throw new Error()
      await onCreated()
    } catch {
      setError('Não foi possível criar a organização. Verifique se o slug está disponível.')
    } finally {
      setPending(false)
    }
  }

  return <section className="auth-panel" aria-labelledby="organization-title">
    <p className="eyebrow">PRIMEIRO ACESSO</p>
    <h1 id="organization-title">Crie sua organização</h1>
    <p className="auth-copy">O workspace separa seus incidentes, agents e regras com segurança.</p>
    <form onSubmit={submit}>
      <label>Nome da organização<input value={name} onChange={event => setName(event.target.value)} required /></label>
      <label>Slug<input value={slug} onChange={event => setSlug(event.target.value)} pattern="[a-z0-9-]{3,60}" placeholder="acme-ops" required /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary auth-submit" disabled={pending}>{pending ? 'Criando...' : 'Criar workspace'}</button>
    </form>
  </section>
}
