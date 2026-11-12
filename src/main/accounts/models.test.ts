import { describe, expect, it } from 'vitest'
import type { ModelOption } from '../../shared/schemas'
import { openDb } from '../sqlite/db'
import { ModelCatalogs } from './models'
import { insertAccount } from './service'

const opus: ModelOption = { value: 'opus', displayName: 'Opus 5.5', description: 'Complex work', resolvedModel: 'claude-opus-5-5', efforts: ['low', 'high'] }
const fable: ModelOption = { value: 'fable', displayName: 'Fable 5.2', description: 'Toughest', resolvedModel: 'claude-fable-5-2', efforts: [] }

function setup(answers: (ModelOption[] | Error)[]) {
  const db = openDb(':memory:')
  const account = insertAccount(db, { agent: 'claude', label: '.claude-sid', kind: 'attached', configDir: '/Users/x/.claude-sid' })
  const asked: string[] = []
  const catalogs = new ModelCatalogs(db, {
    claude: async (configDir) => {
      asked.push(configDir)
      const answer = answers.shift() ?? []
      if (answer instanceof Error) throw answer
      return answer
    },
  })
  return { db, account, asked, catalogs }
}

describe('ModelCatalogs', () => {
  it('asks the account once, then serves the saved list (also after a restart)', async () => {
    const { db, account, asked, catalogs } = setup([[opus, fable]])
    expect((await catalogs.get(account.id)).models.map((m) => m.value)).toEqual(['opus', 'fable'])
    expect((await catalogs.get(account.id)).models).toHaveLength(2)
    // A new instance (runtime restart) reads the DB, no new ask.
    expect((await new ModelCatalogs(db, {}).get(account.id)).models).toHaveLength(2)
    expect(asked).toEqual(['/Users/x/.claude-sid'])
  })

  it('refresh asks again; concurrent asks share one call', async () => {
    const { account, asked, catalogs } = setup([[opus], [opus, fable]])
    await catalogs.get(account.id)
    const [a, b] = await Promise.all([catalogs.get(account.id, true), catalogs.get(account.id, true)])
    expect(a.models).toHaveLength(2)
    expect(b).toBe(a)
    expect(asked).toHaveLength(2)
  })

  it('reports a logged-out account clearly and keeps nothing', async () => {
    const { account, catalogs } = setup([new Error('Not logged in · Please run /login')])
    await expect(catalogs.get(account.id)).rejects.toThrow('This account is not logged in.')
    expect(catalogs.cached(account.id)).toBeNull()
  })

  it('forgets a removed account', async () => {
    const { account, catalogs } = setup([[opus]])
    await catalogs.get(account.id)
    catalogs.forget(account.id)
    expect(catalogs.cached(account.id)).toBeNull()
  })
})
