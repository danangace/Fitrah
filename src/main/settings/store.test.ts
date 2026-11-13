import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { openDb } from '../sqlite/db'
import { DEFAULT_SETTINGS, addRepo, getSettings, listRepos, removeRepo, saveSettings, updateRepo } from './store'

const tmp = (p: string) => mkdtempSync(join(tmpdir(), p))
const gitRepo = () => {
  const dir = tmp('nakoda-repo-')
  execFileSync('git', ['init', '-q', dir])
  return dir
}

describe('settings', () => {
  it('returns defaults before anything is saved', () => {
    expect(getSettings(openDb(':memory:'))).toEqual(DEFAULT_SETTINGS)
  })

  it('rejects a docs root that does not exist and saves nothing (AC-S1)', () => {
    const db = openDb(':memory:')
    expect(() => saveSettings(db, { ...DEFAULT_SETTINGS, docsRoot: '/no/such/dir' })).toThrow(/does not exist/)
    expect(getSettings(db).docsRoot).toBeNull()
  })

  it('saves a valid docs root and a model list (AC-S3)', () => {
    const db = openDb(':memory:')
    const docsRoot = tmp('nakoda-docs-')
    const models = { claude: { list: ['opus', 'haiku'], default: 'opus' } }
    saveSettings(db, { ...DEFAULT_SETTINGS, docsRoot, models })
    expect(getSettings(db)).toMatchObject({ docsRoot, models })
  })

  it('requires the default model to be in the list', () => {
    const db = openDb(':memory:')
    const models = { claude: { list: ['opus'], default: 'haiku' } }
    expect(() => saveSettings(db, { ...DEFAULT_SETTINGS, models })).toThrow(/must be in its list/)
  })

  it('saves your own doc paths and rejects two with the same name', () => {
    const db = openDb(':memory:')
    const docPaths = [{ label: 'BE Proposal', template: 'frontend/modules/{iteration}/{module}/BE Proposal.md' }]
    saveSettings(db, { ...DEFAULT_SETTINGS, docPaths })
    expect(getSettings(db).docPaths).toEqual(docPaths)
    expect(() => saveSettings(db, { ...DEFAULT_SETTINGS, docPaths: [...docPaths, { label: 'be proposal', template: 'x' }] })).toThrow(
      /both named/,
    )
    expect(() => saveSettings(db, { ...DEFAULT_SETTINGS, docPaths: [{ label: '', template: 'x' }] })).toThrow(/needs a name/)
  })

  it('turns the old three fixed paths into the doc paths list', () => {
    const db = openDb(':memory:')
    const old = { ...DEFAULT_SETTINGS, docPaths: undefined, paths: { moduleDocs: 'mods/{module}/', plans: 'p/{feature}.md', oqFile: 'OQ.md' } }
    db.prepare("INSERT INTO settings (key, value) VALUES ('app', ?)").run(JSON.stringify(old))
    expect(getSettings(db).docPaths).toEqual([
      { label: 'Module docs', template: 'mods/{module}/' },
      { label: 'Open Questions', template: 'mods/{module}/OQ.md' },
      { label: 'Plan', template: 'p/{feature}.md' },
    ])
  })
})

describe('repos', () => {
  it('adds a git repo with its settings, without touching the repo (AC-S2, AC-S4)', async () => {
    const db = openDb(':memory:')
    const path = gitRepo()
    const before = readdirSync(path)
    const repo = await addRepo(db, {
      path,
      setupScript: 'pnpm install && pnpm setup:env',
      featureBase: 'origin/dev/tribe-2',
    })
    expect(repo).toMatchObject({ path, setupScript: 'pnpm install && pnpm setup:env', featureBase: 'origin/dev/tribe-2' })
    expect(listRepos(db)).toHaveLength(1)
    expect(readdirSync(path)).toEqual(before)
  })

  it('rejects a folder that is not a git repo and a duplicate', async () => {
    const db = openDb(':memory:')
    await expect(addRepo(db, { path: tmp('nakoda-plain-'), featureBase: 'main' })).rejects.toThrow(/Not a git repository/)
    const path = gitRepo()
    await addRepo(db, { path, featureBase: 'main' })
    await expect(addRepo(db, { path, featureBase: 'main' })).rejects.toThrow(/already added/)
  })

  it('updates and removes a repo', async () => {
    const db = openDb(':memory:')
    const repo = await addRepo(db, { path: gitRepo(), featureBase: 'main' })
    expect(updateRepo(db, repo.id, { featureBase: 'origin/main' }).featureBase).toBe('origin/main')
    removeRepo(db, repo.id)
    expect(listRepos(db)).toEqual([])
  })
})
