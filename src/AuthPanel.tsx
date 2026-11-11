import React from 'react'

interface AuthPanelProps {
  onAuthenticated: () => Promise<void>
}

type AuthErrorPayload = {
  message?: string
  error?: string
}

function getAuthError(payload: AuthErrorPayload | null, mode: 'sign-in' | 'sign-up') {
  const message = payload?.message ?? payload?.error
  if (!message) return mode === 'sign-in'
    ? 'Não foi possível entrar. Confira seu email e senha.'
    : 'Não foi possível criar a conta. Confira os dados informados.'

  const normalized = message.toLowerCase()
  if (normalized.includes('already') || normalized.includes('exist') || normalized.includes('duplicate')) {
    return 'Este email já está cadastrado. Entre com sua senha ou use outro email.'
  }
  if (normalized.includes('password') || normalized.includes('senha')) {
    return 'A senha precisa ter pelo menos 8 caracteres.'
  }
  if (normalized.includes('email')) {
    return 'Informe um email válido.'
  }
  return mode === 'sign-in'
    ? 'Não foi possível entrar. Confira seu email e senha.'
    : 'Não foi possível criar a conta. Confira os dados informados.'
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

    const normalizedEmail = email.trim().toLowerCase()
    const normalizedName = name.trim()

    if (!normalizedEmail) {
      setError('Informe seu email.')
      setPending(false)
      return
    }
    if (password.length < 8) {
      setError('A senha precisa ter pelo menos 8 caracteres.')
      setPending(false)
      return
    }
    if (mode === 'sign-up' && !normalizedName) {
      setError('Informe seu nome.')
      setPending(false)
      return
    }

    try {
      const endpoint = mode === 'sign-in' ? 'sign-in/email' : 'sign-up/email'
      const response = await fetch(`/api/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'include',
        body: JSON.stringify(
          mode === 'sign-in'
            ? { email: normalizedEmail, password }
            : { email: normalizedEmail, password, name: normalizedName },
        ),
      })

      const payload = await response.json().catch(() => null) as AuthErrorPayload | null
      if (!response.ok) {
        setError(getAuthError(payload, mode))
        return
      }

      await onAuthenticated()
    } catch {
      setError('Não foi possível conectar ao serviço de autenticação.')
    } finally {
      setPending(false)
    }
  }

  return <section className="auth-panel" aria-labelledby="auth-title">
    <p className="eyebrow">MONSYS CONTROL ROOM</p>
    <h1 id="auth-title">{mode === 'sign-in' ? 'Entrar no workspace' : 'Criar acesso operacional'}</h1>
    <p className="auth-copy">Acesse incidentes, agents e ações da sua organização.</p>
    <form onSubmit={submit} noValidate>
      {mode === 'sign-up' && <label>Nome<input value={name} onChange={event => setName(event.target.value)} autoComplete="name" required /></label>}
      <label>Email<input value={email} onChange={event => setEmail(event.target.value)} type="email" autoComplete="email" required /></label>
      <label>Senha<input value={password} onChange={event => setPassword(event.target.value)} type="password" autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} minLength={8} required /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary auth-submit" disabled={pending}>{pending ? 'Validando...' : mode === 'sign-in' ? 'Entrar' : 'Criar conta'}</button>
    </form>
    <button type="button" className="link auth-switch" onClick={() => { setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in'); setError('') }}>
      {mode === 'sign-in' ? 'Ainda não tenho acesso' : 'Já tenho uma conta'}
    </button>
  </section>
}
