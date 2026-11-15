import { describe, expect, it } from 'vitest'
import { getAuthError } from './auth-error.js'

describe('authentication error messages', () => {
  it('never mislabels invalid login credentials as duplicate email', () => {
    expect(getAuthError({ code: 'INVALID_EMAIL_OR_PASSWORD' }, 'sign-in', 401)).toBe('Não foi possível entrar. Confira seu email e senha.')
    expect(getAuthError({ message: 'User already exists' }, 'sign-in', 401)).toBe('Não foi possível entrar. Confira seu email e senha.')
  })
  it('recognizes duplicate registration without exposing technical details', () => {
    expect(getAuthError({ code: 'USER_ALREADY_EXISTS' }, 'sign-up', 422)).toContain('já está cadastrado')
    expect(getAuthError(null, 'sign-up', 409)).toContain('já está cadastrado')
  })
  it('distinguishes throttling and service outages from invalid credentials', () => {
    expect(getAuthError(null, 'sign-in', 429)).toContain('Muitas tentativas')
    expect(getAuthError({ message: 'database connection refused' }, 'sign-up', 503)).toContain('indisponível')
  })
  it('returns actionable messages for invalid registration fields', () => {
    expect(getAuthError({ message: 'Password too short' }, 'sign-up', 400)).toContain('8 caracteres')
    expect(getAuthError({ code: 'INVALID_EMAIL' }, 'sign-up', 400)).toContain('email válido')
  })
})
