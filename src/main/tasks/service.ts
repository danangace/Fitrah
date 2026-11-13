import { randomUUID } from 'node:crypto'
import { checkReady } from '../../shared/readiness'
import { type BoardColumn, COLUMN_LABELS, type Task, TaskInput, TaskUpdate } from '../../shared/tasks'
import { UserError } from '../errors'
import { nowIso } from '../paths'
import type { Db } from '../sqlite/db'
import { getWorkflow } from '../workflows/service'

type Row = {
  id: string
  title: string
  description: string
  kind: Task['kind']
  board_column: BoardColumn
  position: number
  priority: string
  repo_id: string | null
  workflow_id: string | null
  values_json: string
  source: string
  external_id: string | null
  external_url: string | null
  workspace_id: string | null
  created_at: string
  updated_at: string
}

const toTask = (r: Row): Task => ({
  id: r.id,
  title: r.title,
  description: r.description,
  kind: r.kind,
  column: r.board_column,
  position: r.position,
  priority: r.priority,
  repoId: r.repo_id,
  workflowId: r.workflow_id,
  values: JSON.parse(r.values_json) as Record<string, string>,
  source: r.source,
  externalId: r.external_id,
  externalUrl: r.external_url,
  workspaceId: r.workspace_id,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

export function listTasks(db: Db): Task[] {
  return (db.prepare('SELECT * FROM tasks ORDER BY board_column, position, created_at').all() as Row[]).map(toTask)
}

export function getTask(db: Db, id: string): Task {
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Row | undefined
  if (!row) throw new UserError('task_not_found', 'Ticket not found', 404)
  return toTask(row)
}

function checkRefs(db: Db, repoId: string | null, workflowId: string | null): void {
  if (repoId && !db.prepare('SELECT 1 FROM repos WHERE id = ?').get(repoId)) throw new UserError('repo_not_found', 'That project does not exist', 404)
  if (workflowId) getWorkflow(db, workflowId)
}

/** Put the ticket at the bottom of its column. */
const nextPosition = (db: Db, column: BoardColumn): number =>
  ((db.prepare('SELECT MAX(position) AS p FROM tasks WHERE board_column = ?').get(column) as { p: number | null }).p ?? -1) + 1

export function createTask(db: Db, raw: unknown, extra: { source?: string; externalId?: string; externalUrl?: string } = {}): Task {
  const parsed = TaskInput.safeParse(raw)
  if (!parsed.success) throw new UserError('invalid_task', parsed.error.issues[0]?.message ?? 'Invalid ticket')
  const input = parsed.data
  checkRefs(db, input.repoId, input.workflowId)
  const id = randomUUID()
  const now = nowIso()
  db.prepare(
    `INSERT INTO tasks (id, title, description, kind, board_column, position, priority, repo_id, workflow_id, values_json, source, external_id, external_url, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'backlog', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, input.title, input.description, input.kind, nextPosition(db, 'backlog'), input.priority, input.repoId, input.workflowId, JSON.stringify(input.values), extra.source ?? 'manual', extra.externalId ?? null, extra.externalUrl ?? null, now, now)
  return getTask(db, id)
}

export function updateTask(db: Db, id: string, raw: unknown): Task {
  const current = getTask(db, id)
  const parsed = TaskUpdate.safeParse(raw)
  if (!parsed.success) throw new UserError('invalid_task', parsed.error.issues[0]?.message ?? 'Invalid ticket')
  const { column, ...patch } = parsed.data
  // Only the fields that were sent change; the zod defaults of TaskInput must not wipe the rest.
  const sent = raw as Record<string, unknown>
  const next = { ...current, ...Object.fromEntries(Object.entries(patch).filter(([k]) => k in sent)) }
  checkRefs(db, next.repoId, next.workflowId)
  if (next.workspaceId && next.repoId !== current.repoId) throw new UserError('task_assigned', 'Unassign the ticket before changing its project')
  db.prepare(
    'UPDATE tasks SET title = ?, description = ?, kind = ?, priority = ?, repo_id = ?, workflow_id = ?, values_json = ?, updated_at = ? WHERE id = ?',
  ).run(next.title, next.description, next.kind, next.priority, next.repoId, next.workflowId, JSON.stringify(next.values), nowIso(), id)
  return column && column !== current.column ? moveTask(db, id, column) : getTask(db, id)
}

/** The ticket goes to the bottom of the chosen column. We never write the status back to a source. */
export function moveTask(db: Db, id: string, column: BoardColumn): Task {
  const current = getTask(db, id)
  if (current.column === column) return current
  db.prepare('UPDATE tasks SET board_column = ?, position = ?, updated_at = ? WHERE id = ?').run(column, nextPosition(db, column), nowIso(), id)
  return getTask(db, id)
}

export function deleteTask(db: Db, id: string): void {
  getTask(db, id)
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id)
}

/**
 * A ticket goes to exactly one workspace. A workspace takes one active ticket at a time: another
 * ticket there that is not yet in Review or Done blocks it. Moving the earlier one on frees the workspace.
 */
export function assignTask(db: Db, id: string, workspaceId: string): Task {
  const task = getTask(db, id)
  if (task.workspaceId) throw new UserError('task_assigned', 'This ticket already has a workspace. Unassign it first.', 409)
  const ws = db.prepare('SELECT repo_id, archived_at FROM workspaces WHERE id = ?').get(workspaceId) as { repo_id: string; archived_at: string | null } | undefined
  if (!ws || ws.archived_at) throw new UserError('workspace_not_found', 'That workspace does not exist or is archived', 404)
  const fields = task.workflowId ? getWorkflow(db, task.workflowId).fields : []
  const missing = checkReady(task, fields)
  if (missing.length) throw new UserError('task_not_ready', `Not ready: missing ${missing.join(', ')}`, 409)
  if (ws.repo_id !== task.repoId) throw new UserError('repo_mismatch', "This workspace belongs to a different project than the ticket's", 409)
  const blocking = db
    .prepare("SELECT title, board_column FROM tasks WHERE workspace_id = ? AND id != ? AND board_column NOT IN ('review', 'done') LIMIT 1")
    .get(workspaceId, id) as { title: string; board_column: BoardColumn } | undefined
  if (blocking) {
    throw new UserError('workspace_busy', `This workspace is still on "${blocking.title}" (${COLUMN_LABELS[blocking.board_column]}). Move it to Review or Done first.`, 409)
  }
  db.prepare('UPDATE tasks SET workspace_id = ?, updated_at = ? WHERE id = ?').run(workspaceId, nowIso(), id)
  return moveTask(db, id, 'in_progress')
}

export function unassignTask(db: Db, id: string): Task {
  getTask(db, id)
  db.prepare('UPDATE tasks SET workspace_id = NULL, updated_at = ? WHERE id = ?').run(nowIso(), id)
  return getTask(db, id)
}
