import { describe, expect, it } from 'vitest'
import { openDb } from '../sqlite/db'
import { deleteAccountRow, insertAccount, listAccounts, refreshAccount, setDefaultAccount } from './service'

const add = (db: ReturnType<typeof openDb>, dir: string) =>
  insertAccount(db, { agent: 'claude', label: dir, kind: 'attached', configDir: dir })

describe('accounts', () => {
  it('keeps exactly one default per agent (AC-A5)', () => {
    const db = openDb(':memory:')
    const a = add(db, '/a')
    const b = add(db, '/b')
    expect(a.isDefault).toBe(true)
    expect(b.isDefault).toBe(false)
    setDefaultAccount(db, b.id)
    expect(listAccounts(db).filter((x) => x.isDefault).map((x) => x.id)).toEqual([b.id])
  })

  it('moves the default when the default account is removed', () => {
    const db = openDb(':memory:')
    const a = add(db, '/a')
    const b = add(db, '/b')
    deleteAccountRow(db, a.id)
    expect(listAccounts(db)).toEqual([expect.objectContaining({ id: b.id, isDefault: true })])
  })

  it('stores what the provider reports', async () => {
    const db = openDb(':memory:')
    const a = add(db, '/a')
    const provider = {
      status: async () => ({ loginStatus: 'logged_in' as const, email: 'me@x.com', loginExpiresAt: null, warning: null }),
    }
    expect(await refreshAccount(db, a.id, provider)).toMatchObject({ loginStatus: 'logged_in', email: 'me@x.com' })
  })

  it('rejects attaching the same folder twice', () => {
    const db = openDb(':memory:')
    add(db, '/a')
    expect(() => add(db, '/a')).toThrow(/already attached/)
  })
})
