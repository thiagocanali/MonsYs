import { describe, expect, it } from 'vitest'
import { validateAuthInput } from './auth-validation.js'

const valid = { mode: 'sign-up' as const, name: 'Pessoa', email: 'pessoa@example.com', password: 'senha-segura' }

describe('authentication form validation', () => {
  it('accepts valid sign-up and sign-in inputs', () => {
    expect(validateAuthInput(valid)).toBeNull()
    expect(validateAuthInput({ ...valid, mode: 'sign-in', name: '' })).toBeNull()
  })

  it('requires an email and rejects malformed addresses', () => {
    expect(validateAuthInput({ ...valid, email: '   ' })).toBe('Informe seu email.')
    for (const email of ['invalid', 'a@', '@example.com', 'a@example', 'a b@example.com']) {
      expect(validateAuthInput({ ...valid, email })).toBe('Informe um email válido.')
    }
  })

  it('rejects short passwords and empty names for registration', () => {
    expect(validateAuthInput({ ...valid, password: '1234567' })).toBe('A senha precisa ter pelo menos 8 caracteres.')
    expect(validateAuthInput({ ...valid, name: '  ' })).toBe('Informe seu nome.')
  })
})
