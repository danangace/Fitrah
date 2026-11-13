import { mkdtempSync, statSync, writeFileSync, chmodSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SecretStore, redactTokens, tokenHint } from './secrets'

const TOKEN = `sidpjm_${'a'.repeat(60)}b1c2`

describe('SecretStore', () => {
  it('stores a token in a 600 file and reads it back', () => {
    const dir = mkdtempSync(join(tmpdir(), 'nakoda-secrets-'))
    const store = new SecretStore(dir)
    expect(store.getToken('c1')).toBeNull()
    store.setToken('c1', TOKEN)
    expect(store.getToken('c1')).toBe(TOKEN)
    expect(statSync(store.file).mode & 0o777).toBe(0o600)
    store.deleteToken('c1')
    expect(store.getToken('c1')).toBeNull()
  })

  it('tightens a file that is readable by others before using it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'nakoda-secrets-'))
    const store = new SecretStore(dir)
    writeFileSync(store.file, JSON.stringify({ connections: { c1: { token: TOKEN } } }))
    chmodSync(store.file, 0o644)
    expect(store.getToken('c1')).toBe(TOKEN)
    expect(statSync(store.file).mode & 0o777).toBe(0o600)
  })

  it('treats a damaged file as empty instead of crashing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'nakoda-secrets-'))
    const store = new SecretStore(dir)
    writeFileSync(store.file, '{not json', { mode: 0o600 })
    expect(store.getToken('c1')).toBeNull()
  })
})

describe('token text helpers', () => {
  it('shows only the last four characters', () => expect(tokenHint(TOKEN)).toBe('sidpjm_…b1c2'))
  it('redacts tokens inside any text', () => expect(redactTokens(`failed with ${TOKEN} twice ${TOKEN}`)).toBe('failed with sidpjm_… twice sidpjm_…'))
})
