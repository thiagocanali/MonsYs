import { describe, expect, it } from 'vitest'
import { readFile, readdir } from 'node:fs/promises'

describe('portable PostgreSQL migrations', () => {
  it('remain byte-identical to the legacy migration history until it is retired', async () => {
    const portable = new URL('../../database/migrations/', import.meta.url)
    const legacy = new URL('../../supabase/migrations/', import.meta.url)
    const portableFiles = (await readdir(portable)).filter(name => name.endsWith('.sql')).sort()
    const legacyFiles = (await readdir(legacy)).filter(name => name.endsWith('.sql')).sort()
    expect(portableFiles).toEqual(legacyFiles)
    for (const file of portableFiles) {
      expect(await readFile(new URL(file, portable), 'utf8')).toBe(await readFile(new URL(file, legacy), 'utf8'))
    }
  })
})
