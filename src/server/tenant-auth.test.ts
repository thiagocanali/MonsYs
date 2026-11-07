import { describe, expect, it } from 'vitest'
import { roleAllows } from './tenant-auth.js'

describe('tenant authorization policy', () => {
  it('denies requests without a membership role', () => {
    expect(roleAllows(undefined)).toBe(false)
  })

  it('allows viewers to read when no mutation role is required', () => {
    expect(roleAllows('VIEWER')).toBe(true)
  })

  it('allows operators to mutate operational resources', () => {
    expect(roleAllows('OPERATOR', ['ADMIN', 'OPERATOR'])).toBe(true)
  })

  it('denies viewers from mutating operational resources', () => {
    expect(roleAllows('VIEWER', ['ADMIN', 'OPERATOR'])).toBe(false)
  })

  it('denies roles outside the requested policy', () => {
    expect(roleAllows('ADMIN', ['VIEWER'])).toBe(false)
  })
})
