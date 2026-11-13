import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, addRepo, saveSettings } from '../settings/store'
import { openDb } from '../sqlite/db'
import { createWorkspace } from '../workspaces/service'
import { makeRepoWithOrigin } from '../workspaces/testing'
import { assignTask, createTask, deleteTask, getTask, listTasks, moveTask, unassignTask, updateTask } from './service'

async function setup() {
  const db = openDb(':memory:')
  saveSettings(db, { ...DEFAULT_SETTINGS, workspacesDir: mkdtempSync(join(tmpdir(), 'nakoda-ws-')) })
  const repo = await addRepo(db, { path: makeRepoWithOrigin().repo, featureBase: 'origin/dev/tribe-2', branchPrefix: 'feat/tribe-2/' })
  const other = await addRepo(db, { path: makeRepoWithOrigin().repo, featureBase: 'origin/dev/tribe-2', branchPrefix: 'feat/tribe-2/' })
  const ws = await createWorkspace(db, { repoId: repo.id, name: 'one' })
  const ready = (title: string, extra: Record<string, unknown> = {}) =>
    createTask(db, { title, description: 'Do it', repoId: repo.id, ...extra })
  return { db, repo, other, ws, ready }
}

describe('tasks', () => {
  it('creates a ticket at the bottom of Backlog with defaults', async () => {
    const { db, ready } = await setup()
    const a = ready('A')
    const b = ready('B')
    expect(a).toMatchObject({ column: 'backlog', kind: 'task', source: 'manual', workspaceId: null, values: {} })
    expect(b.position).toBeGreaterThan(a.position)
    expect(listTasks(db).map((t) => t.title)).toEqual(['A', 'B'])
  })

  it('rejects an empty title, an unknown project and an unknown workflow', async () => {
    const { db } = await setup()
    expect(() => createTask(db, { title: '  ' })).toThrow(/title/)
    expect(() => createTask(db, { title: 'x', repoId: 'nope' })).toThrow(/project/)
    expect(() => createTask(db, { title: 'x', workflowId: 'nope' })).toThrow(/Workflow/)
  })

  it('changes only the fields that were sent', async () => {
    const { db, ready } = await setup()
    const t = ready('A', { priority: 'high', values: { prd: 'https://p' } })
    const edited = updateTask(db, t.id, { title: 'A2' })
    expect(edited).toMatchObject({ title: 'A2', description: 'Do it', priority: 'high', values: { prd: 'https://p' } })
  })

  it('moves a ticket to the bottom of another column, never writing back to a source', async () => {
    const { db, ready } = await setup()
    const a = ready('A')
    const b = ready('B')
    moveTask(db, b.id, 'review')
    expect(moveTask(db, a.id, 'review')).toMatchObject({ column: 'review' })
    expect(listTasks(db).filter((t) => t.column === 'review').map((t) => t.title)).toEqual(['B', 'A'])
    expect(updateTask(db, a.id, { column: 'done' }).column).toBe('done')
  })

  it('copies an outside ticket only once', async () => {
    const { db } = await setup()
    createTask(db, { title: 'From Helix' }, { source: 'helix', externalId: 'T2-1', externalUrl: 'https://h.test/tickets/T2-1' })
    expect(() => createTask(db, { title: 'Again' }, { source: 'helix', externalId: 'T2-1' })).toThrow()
    expect(listTasks(db)[0]).toMatchObject({ source: 'helix', externalId: 'T2-1', externalUrl: 'https://h.test/tickets/T2-1' })
  })

  it('deletes a ticket', async () => {
    const { db, ready } = await setup()
    const t = ready('A')
    deleteTask(db, t.id)
    expect(() => getTask(db, t.id)).toThrow(/not found/)
  })
})

describe('assign', () => {
  it('assigns a ready ticket to a workspace and moves it to In progress', async () => {
    const { db, ready, ws } = await setup()
    const t = ready('A')
    expect(assignTask(db, t.id, ws.id)).toMatchObject({ workspaceId: ws.id, column: 'in_progress' })
  })

  it('refuses a ticket that is not ready and says what is missing', async () => {
    const { db, ws } = await setup()
    const bare = createTask(db, { title: 'Bare' })
    expect(() => assignTask(db, bare.id, ws.id)).toThrow(/missing Description, Project/)
    const planning = createTask(db, { title: 'P', description: 'd', repoId: ws.repoId, workflowId: 'planning', values: { prd: 'https://p' } })
    expect(() => assignTask(db, planning.id, ws.id)).toThrow(/Figma, Iteration, Module/)
  })

  it('refuses a workspace of a different project', async () => {
    const { db, other, ws } = await setup()
    const t = createTask(db, { title: 'A', description: 'd', repoId: other.id })
    expect(() => assignTask(db, t.id, ws.id)).toThrow(/different project/)
  })

  it('allows one active ticket per workspace: a second waits until the first is in Review or Done', async () => {
    const { db, ready, ws } = await setup()
    const first = ready('First')
    const second = ready('Second')
    assignTask(db, first.id, ws.id)
    expect(() => assignTask(db, second.id, ws.id)).toThrow(/still on "First" \(In progress\)/)
    moveTask(db, first.id, 'review')
    expect(assignTask(db, second.id, ws.id).workspaceId).toBe(ws.id)
    // Both tickets now point at the same workspace (one to many over time).
    expect(listTasks(db).filter((t) => t.workspaceId === ws.id)).toHaveLength(2)
  })

  it('does not let a ticket have two workspaces, until it is unassigned', async () => {
    const { db, ready, ws } = await setup()
    const second = await createWorkspace(db, { repoId: ws.repoId, name: 'two' })
    const t = ready('A')
    assignTask(db, t.id, ws.id)
    expect(() => assignTask(db, t.id, second.id)).toThrow(/already has a workspace/)
    expect(unassignTask(db, t.id).workspaceId).toBeNull()
    expect(assignTask(db, t.id, second.id).workspaceId).toBe(second.id)
  })

  it('refuses an unknown workspace', async () => {
    const { db, ready } = await setup()
    expect(() => assignTask(db, ready('A').id, 'nope')).toThrow(/does not exist/)
  })

  it('will not change the project of an assigned ticket', async () => {
    const { db, ready, ws, other } = await setup()
    const t = ready('A')
    assignTask(db, t.id, ws.id)
    expect(() => updateTask(db, t.id, { repoId: other.id })).toThrow(/Unassign/)
  })
})
