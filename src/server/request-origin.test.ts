import { describe, expect, it } from 'vitest'
import { rejectForeignOrigin } from './request-origin.js'

describe('cookie mutation origin boundary', () => {
  it('rejects foreign and opaque browser origins', () => {
    for (const origin of ['https://attacker.example', 'null']) {
      expect(rejectForeignOrigin(new Request('https://monsys.example/api/organizations', { method: 'POST', headers: { origin } }))?.status).toBe(403)
    }
  })
  it('accepts same-origin mutations and non-browser requests', () => {
    for (const headers of [{ origin: 'https://monsys.example' }, undefined]) {
      expect(rejectForeignOrigin(new Request('https://monsys.example/api/organizations', { method: 'POST', headers }))).toBeUndefined()
    }
  })
})
