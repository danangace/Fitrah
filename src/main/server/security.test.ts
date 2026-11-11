import { mkdtempSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadOrCreateToken, localHosts, tokenMatches } from './security'

describe('security', () => {
  it('creates a 600 token file once and reuses it', () => {
    const home = mkdtempSync(join(tmpdir(), 'fitrah-home-'))
    const first = loadOrCreateToken(home)
    expect(first).toMatch(/^[0-9a-f]{64}$/)
    expect(statSync(join(home, 'token')).mode & 0o777).toBe(0o600)
    expect(loadOrCreateToken(home)).toBe(first)
    expect(readFileSync(join(home, 'token'), 'utf8').trim()).toBe(first)
  })

  it('lists local hosts for runtime and dev ports', () => {
    expect(localHosts(4317, 5173)).toEqual(['127.0.0.1:4317', 'localhost:4317', '127.0.0.1:5173', 'localhost:5173'])
  })

  it('compares tokens safely', () => {
    expect(tokenMatches('abc', 'abc')).toBe(true)
    expect(tokenMatches('abc', 'abd')).toBe(false)
    expect(tokenMatches('abc', 'ab')).toBe(false)
    expect(tokenMatches('abc', undefined)).toBe(false)
  })
})
