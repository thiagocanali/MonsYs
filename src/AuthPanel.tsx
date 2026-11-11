import React from 'react'

interface AuthPanelProps {
  onAuthenticated: () => Promise<void>
}

export function AuthPanel({ onAuthenticated }: AuthPanelProps) {
  const [mode, setMode] = React.useState<'sign-in' | 'sign-up'>('sign-in')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [name, setName] = React.useState('')
  const [error, setError] = React.useState('')
  const [pending, setPending] = React.useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      const endpoint = mode === 'sign-in' ? 'sign-in/email' : 'sign-up/email'
      const response = await fetch(`/api/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(mode === 'sign-in' ? { email, password } : { email, password, name }),
      })
      if (!response.ok) throw new Error('Não foi possível autenticar')
      await onAuthenticated()
    } catch {
      setError('Credenciais inválidas ou serviço indisponível.')
    } finally {
      setPending(false)
    }
  }

  return <section className="auth-panel" aria-labelledby="auth-title">
    <p className="eyebrow">MONSYS CONTROL ROOM</p>
    <h1 id="auth-title">{mode === 'sign-in' ? 'Entrar no workspace' : 'Criar acesso operacional'}</h1>
    <p className="auth-copy">Acesse incidentes, agents e ações da sua organização.</p>
    <form onSubmit={submit}>
      {mode === 'sign-up' && <label>Nome<input value={name} onChange={event => setName(event.target.value)} autoComplete="name" required /></label>}
      <label>Email<input value={email} onChange={event => setEmail(event.target.value)} type="email" autoComplete="email" required /></label>
      <label>Senha<input value={password} onChange={event => setPassword(event.target.value)} type="password" autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} minLength={8} required /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary auth-submit" disabled={pending}>{pending ? 'Validando...' : mode === 'sign-in' ? 'Entrar' : 'Criar conta'}</button>
    </form>
    <button className="link auth-switch" onClick={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}>
      {mode === 'sign-in' ? 'Ainda não tenho acesso' : 'Já tenho uma conta'}
    </button>
  </section>
}
