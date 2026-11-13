import type { AuthMode } from './auth-validation.js'

export type AuthErrorPayload = { message?: string; error?: string; code?: string }

export function getAuthError(payload: AuthErrorPayload | null, mode: AuthMode, status?: number): string {
  if (status === 429) return 'Muitas tentativas. Aguarde um momento antes de tentar novamente.'
  if (status !== undefined && status >= 500) return 'Serviço de autenticação indisponível. Tente novamente em instantes.'

  const message = [payload?.code, payload?.message, payload?.error].filter(Boolean).join(' ').toLowerCase()
  if (mode === 'sign-in') {
    if (message.includes('invalid_email') || message.includes('invalid email format')) return 'Informe um email válido.'
    return 'Não foi possível entrar. Confira seu email e senha.'
  }
  if (message.includes('already') || message.includes('exist') || message.includes('duplicate') || status === 409) {
    return 'Este email já está cadastrado. Entre com sua senha ou use outro email.'
  }
  if (message.includes('password') || message.includes('senha')) return 'A senha precisa ter pelo menos 8 caracteres.'
  if (message.includes('email')) return 'Informe um email válido.'
  return 'Não foi possível criar a conta. Confira os dados informados.'
}
