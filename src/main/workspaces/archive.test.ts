import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, addRepo, saveSettings } from '../settings/store'
import { openDb } from '../sqlite/db'
import { archiveWorkspace } from './archive'
import { createWorkspace, listWorkspaces } from './service'
import { gitOut, makeRepoWithOrigin } from './testing'

async function setup() {
  const db = openDb(':memory:')
  const { repo } = makeRepoWithOrigin()
  saveSettings(db, { ...DEFAULT_SETTINGS, workspacesDir: mkdtempSync(join(tmpdir(), 'fitrah-ws-')) })
  const r = await addRepo(db, { path: repo, featureBase: 'origin/dev/tribe-2' })
  const ws = await createWorkspace(db, { repoId: r.id, kind: 'feature', name: 'w', base: 'origin/dev/tribe-2' })
  const branches = () => gitOut(repo, 'branch', '--list', ws.branch)
  return { db, repo, ws, branches }
}

describe('archiveWorkspace', () => {
  it('removes the worktree and keeps the branch unless confirmed (AC-W5)', async () => {
    const { db, ws, branches } = await setup()
    await archiveWorkspace(db, ws.id, {})
    expect(existsSync(ws.worktreePath)).toBe(false)
    expect(branches()).toContain(ws.branch)
    expect(listWorkspaces(db)).toEqual([])
  })

  it('deletes the branch when confirmed (AC-W5)', async () => {
    const { db, ws, branches } = await setup()
    await archiveWorkspace(db, ws.id, { deleteBranch: true })
    expect(branches()).toBe('')
  })

  it('refuses a dirty worktree unless forced', async () => {
    const { db, ws } = await setup()
    writeFileSync(join(ws.worktreePath, 'wip.txt'), 'x')
    await expect(archiveWorkspace(db, ws.id, {})).rejects.toThrow(/uncommitted/)
    expect(existsSync(ws.worktreePath)).toBe(true)
    await archiveWorkspace(db, ws.id, { force: true })
    expect(existsSync(ws.worktreePath)).toBe(false)
  })
})
