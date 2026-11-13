import { existsSync, mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openDb } from '../sqlite/db'
import { detectLogins, managedAccountsRoot, removeAccount } from './manage'
import { insertAccount, listAccounts } from './service'

let home: string
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'nakoda-home-'))
  vi.stubEnv('NAKODA_HOME', join(home, '.nakoda'))
  vi.stubEnv('CLAUDE_CONFIG_DIR', '')
})
afterEach(() => vi.unstubAllEnvs())

describe('detectLogins', () => {
  it('proposes existing claude folders without attaching them (AC-A1)', () => {
    mkdirSync(join(home, '.claude'))
    mkdirSync(join(home, '.claude-sid'))
    mkdirSync(join(home, '.config'))
    const db = openDb(':memory:')
    expect(detectLogins(db, home)).toEqual([
      { agent: 'claude', configDir: join(home, '.claude'), attached: false },
      { agent: 'claude', configDir: join(home, '.claude-sid'), attached: false },
    ])
    expect(listAccounts(db)).toEqual([])
  })
})

describe('removeAccount', () => {
  it('never deletes an attached folder (AC-A4)', async () => {
    const dir = join(home, '.claude-sid')
    mkdirSync(dir)
    const db = openDb(':memory:')
    const a = insertAccount(db, { agent: 'claude', label: 'sid', kind: 'attached', configDir: dir })
    const logout = vi.fn()
    await removeAccount(db, a.id, logout)
    expect(existsSync(dir)).toBe(true)
    expect(logout).not.toHaveBeenCalled()
    expect(listAccounts(db)).toEqual([])
  })

  it('signs out and deletes a managed folder inside nakoda accounts (AC-A4)', async () => {
    const dir = join(managedAccountsRoot(), 'claude', 'x')
    mkdirSync(dir, { recursive: true })
    const db = openDb(':memory:')
    const a = insertAccount(db, { agent: 'claude', label: 'x', kind: 'managed', configDir: dir })
    const logout = vi.fn().mockResolvedValue(undefined)
    await removeAccount(db, a.id, logout)
    expect(logout).toHaveBeenCalledWith(dir)
    expect(existsSync(dir)).toBe(false)
  })

  it('refuses to delete a managed folder outside nakoda accounts', async () => {
    const dir = join(home, 'precious')
    mkdirSync(dir)
    const db = openDb(':memory:')
    const a = insertAccount(db, { agent: 'claude', label: 'x', kind: 'managed', configDir: dir })
    await expect(removeAccount(db, a.id, vi.fn())).rejects.toThrow(/Refusing/)
    expect(existsSync(dir)).toBe(true)
  })
})
