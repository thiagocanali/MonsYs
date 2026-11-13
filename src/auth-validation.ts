export type AuthMode = 'sign-in' | 'sign-up'

export function validateAuthInput(input: { mode: AuthMode; email: string; password: string; name: string }): string | null {
  const email = input.email.trim()
  if (!email) return 'Informe seu email.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Informe um email válido.'
  if (input.password.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.'
  if (input.mode === 'sign-up' && !input.name.trim()) return 'Informe seu nome.'
  return null
}
