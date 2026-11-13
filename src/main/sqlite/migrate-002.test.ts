import { copyFileSync, mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import { migrate } from './db'

const MIGRATIONS = join(import.meta.dirname, 'migrations')

describe('migration 002 (projects + workflows)', () => {
  it('keeps an existing workspace and moves its task info into Planning values (AC-M1)', () => {
    // A v0.1 database: only migration 001, with a repo, settings and a workspace like Danang's.
    const v1Dir = mkdtempSync(join(tmpdir(), 'nakoda-mig-'))
    mkdirSync(v1Dir, { recursive: true })
    copyFileSync(join(MIGRATIONS, '001_init.sql'), join(v1Dir, '001_init.sql'))
    const db = new DatabaseSync(':memory:')
    db.exec('PRAGMA foreign_keys = ON')
    migrate(db, v1Dir)
    db.prepare("INSERT INTO settings (key, value) VALUES ('app', ?)").run(JSON.stringify({ branchPrefix: { feature: 'feat/tribe-2/', defect: 'fix/tribe-2/' } }))
    db.prepare("INSERT INTO repos (id, name, path, feature_base, created_at) VALUES ('r', 'website-cf-monorepo', '/repo', 'origin/dev/tribe-2', 't')").run()
    db.prepare(
      `INSERT INTO workspaces (id, repo_id, kind, name, iteration, module, prd_url, figma_url, branch, base, worktree_path, created_at)
       VALUES ('w', 'r', 'defect', 'flow-aktivasi-subscription', 'i-15', 'Detail Subscription', 'https://prd', 'https://figma', 'fix/tribe-2/flow-aktivasi-subscription', 'origin/dev/tribe-2', '/ws/flow', 't')`,
    ).run()
    db.prepare(
      `INSERT INTO workspaces (id, repo_id, kind, name, branch, base, worktree_path, created_at)
       VALUES ('free', 'r', 'feature', 'plain', 'feat/tribe-2/plain', 'origin/dev/tribe-2', '/ws/plain', 't')`,
    ).run()

    expect(migrate(db)).toContain(2)

    expect(db.prepare("SELECT branch_prefix FROM repos WHERE id = 'r'").get()).toEqual({ branch_prefix: 'feat/tribe-2/' })
    const w = db.prepare("SELECT name, branch, workflow_id, values_json FROM workspaces WHERE id = 'w'").get() as Record<string, string>
    expect(w).toMatchObject({ name: 'flow-aktivasi-subscription', branch: 'fix/tribe-2/flow-aktivasi-subscription', workflow_id: 'planning' })
    expect(JSON.parse(w.values_json ?? '{}')).toEqual({
      prd: 'https://prd',
      figma: 'https://figma',
      iteration: 'i-15',
      module: 'Detail Subscription',
      target_docs: '',
      base: 'origin/dev/tribe-2',
    })
    expect(db.prepare("SELECT workflow_id, values_json FROM workspaces WHERE id = 'free'").get()).toEqual({ workflow_id: null, values_json: '{}' })
    expect(db.prepare("SELECT name FROM workflows").all()).toEqual([{ name: 'Planning' }])
  })
})
