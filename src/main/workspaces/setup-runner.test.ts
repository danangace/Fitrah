import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppEvent } from '../../shared/events'
import { EventBus } from '../events/bus'
import { DEFAULT_SETTINGS, addRepo, saveSettings } from '../settings/store'
import { openDb } from '../sqlite/db'
import { createWorkspace, getWorkspace } from './service'
import { SetupRunner } from './setup-runner'
import { makeRepoWithOrigin } from './testing'

beforeEach(() => vi.stubEnv('FITRAH_HOME', mkdtempSync(join(tmpdir(), 'fitrah-home-'))))
afterEach(() => vi.unstubAllEnvs())

async function workspaceWith(script: string) {
  const db = openDb(':memory:')
  const { repo } = makeRepoWithOrigin()
  saveSettings(db, { ...DEFAULT_SETTINGS, workspacesDir: mkdtempSync(join(tmpdir(), 'fitrah-ws-')) })
  const r = await addRepo(db, { path: repo, featureBase: 'origin/dev/tribe-2', setupScript: script })
  const ws = await createWorkspace(db, { repoId: r.id, name: 'w', base: 'origin/dev/tribe-2' })
  const bus = new EventBus()
  const events: AppEvent[] = []
  bus.subscribe((e) => events.push(e))
  return { db, ws, bus, events }
}

describe('SetupRunner', () => {
  it('streams output lines inside the worktree and marks done (AC-W3)', async () => {
    const { db, ws, bus, events } = await workspaceWith('echo one && pwd')
    const runner = new SetupRunner(db, bus)
    expect(await runner.run(ws.id)).toBe('done')
    const lines = events.flatMap((e) => (e.type === 'workspace.setup' ? [e.line] : []))
    expect(lines).toContain('one')
    expect(lines.some((l) => l.endsWith(join('repo', 'w')))).toBe(true)
    expect(getWorkspace(db, ws.id).setupStatus).toBe('done')
    expect(runner.log(ws.id)).toContain('one')
  })

  it('runs a multi-line script line by line and stops at the first failing line', async () => {
    const { db, ws, bus, events } = await workspaceWith('echo first\nfalse\necho never')
    expect(await new SetupRunner(db, bus).run(ws.id)).toBe('failed')
    const lines = events.flatMap((e) => (e.type === 'workspace.setup' ? [e.line] : []))
    expect(lines).toContain('first')
    expect(lines).not.toContain('never')
  })

  it('marks a failing script failed and keeps the workspace (AC-W3)', async () => {
    const { db, ws, bus, events } = await workspaceWith('echo boom >&2; exit 3')
    expect(await new SetupRunner(db, bus).run(ws.id)).toBe('failed')
    expect(getWorkspace(db, ws.id).setupStatus).toBe('failed')
    expect(events.at(-1)).toMatchObject({ type: 'workspace.setup', done: true, line: 'Setup failed (exit 3).' })
  })
})
