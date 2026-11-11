import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, addRepo, saveSettings } from '../settings/store'
import { openDb } from '../sqlite/db'
import { createWorkspace, listWorkspaces } from './service'
import { gitOut, makeRepoWithOrigin } from './testing'

async function setup(setupScript = '') {
  const db = openDb(':memory:')
  const { repo, origin } = makeRepoWithOrigin()
  const workspacesDir = mkdtempSync(join(tmpdir(), 'fitrah-ws-'))
  saveSettings(db, { ...DEFAULT_SETTINGS, workspacesDir })
  const r = await addRepo(db, { path: repo, featureBase: 'origin/dev/tribe-2', setupScript })
  return { db, repo, origin, repoId: r.id, workspacesDir }
}

describe('createWorkspace', () => {
  it('creates a feature worktree from the fetched remote base (AC-W1)', async () => {
    const { db, repo, origin, repoId, workspacesDir } = await setup()
    // A new commit lands on origin after the clone: the workspace must start from it.
    const other = join(mkdtempSync(join(tmpdir(), 'fitrah-other-')), 'c')
    execFileSync('git', ['clone', '-q', '-b', 'dev/tribe-2', origin, other], { stdio: 'pipe' })
    writeFileSync(join(other, 'new.txt'), 'x')
    execFileSync('git', ['-c', 'user.email=t@e', '-c', 'user.name=T', 'commit', '-q', '-am', 'x', '--allow-empty'], { cwd: other })
    execFileSync('git', ['add', '.'], { cwd: other })
    execFileSync('git', ['-c', 'user.email=t@e', '-c', 'user.name=T', 'commit', '-q', '-m', 'new'], { cwd: other })
    execFileSync('git', ['push', '-q', 'origin', 'dev/tribe-2'], { cwd: other, stdio: 'pipe' })

    const ws = await createWorkspace(db, { repoId, kind: 'feature', name: 'kelola-xyz', base: 'origin/dev/tribe-2' })
    expect(ws.branch).toBe('feat/tribe-2/kelola-xyz')
    expect(ws.worktreePath).toBe(join(workspacesDir, 'repo', 'kelola-xyz'))
    expect(existsSync(join(ws.worktreePath, 'new.txt'))).toBe(true)
    expect(gitOut(ws.worktreePath, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe('feat/tribe-2/kelola-xyz')
    // The main checkout is untouched (AC-W6).
    expect(gitOut(repo, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe('main')
    expect(gitOut(repo, 'status', '--porcelain')).toBe('')
    expect(ws.setupStatus).toBe('skipped')
  })

  it('creates a defect worktree only from an explicit base (AC-W2)', async () => {
    const { db, repoId } = await setup('echo hi')
    await expect(createWorkspace(db, { repoId, kind: 'defect', name: 'invoice-null' })).rejects.toThrow()
    const ws = await createWorkspace(db, { repoId, kind: 'defect', name: 'invoice-null', base: 'origin/main' })
    expect(ws.branch).toBe('fix/tribe-2/invoice-null')
    expect(ws.setupStatus).toBe('pending')
  })

  it('rejects a duplicate name and an unknown base', async () => {
    const { db, repoId } = await setup()
    await createWorkspace(db, { repoId, kind: 'feature', name: 'a', base: 'origin/dev/tribe-2' })
    await expect(createWorkspace(db, { repoId, kind: 'feature', name: 'a', base: 'origin/dev/tribe-2' })).rejects.toThrow(/exists/)
    await expect(createWorkspace(db, { repoId, kind: 'feature', name: 'b', base: 'origin/nope' })).rejects.toThrow(/Base not found/)
    expect(listWorkspaces(db)).toHaveLength(1)
  })
})
