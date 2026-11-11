import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { type Workspace, WorkspaceInput, type WorkspaceStatus } from '../../shared/schemas'
import { getWorkflow, resolveValues } from '../workflows/service'
import { UserError } from '../errors'
import { expandHome, nowIso } from '../paths'
import { getRepo, getSettings } from '../settings/store'
import type { Db } from '../sqlite/db'
import { type Git, addWorktree, fetchForBase, git as defaultGit, refExists } from './git'

type WorkspaceRow = {
  id: string
  repo_id: string
  name: string
  workflow_id: string | null
  values_json: string
  branch: string
  base: string
  worktree_path: string
  stage: string
  setup_status: Workspace['setupStatus']
  created_at: string
  archived_at: string | null
}

/** Live status per workspace comes from its chats (T25); stored rows default to idle. */
export type StatusLookup = (workspaceId: string) => WorkspaceStatus

const toWorkspace = (r: WorkspaceRow, status: StatusLookup): Workspace => ({
  id: r.id,
  repoId: r.repo_id,
  name: r.name,
  workflowId: r.workflow_id,
  values: JSON.parse(r.values_json) as Record<string, string>,
  base: r.base,
  branch: r.branch,
  worktreePath: r.worktree_path,
  stage: r.stage,
  setupStatus: r.setup_status,
  status: status(r.id),
  createdAt: r.created_at,
  archivedAt: r.archived_at,
})

const idle: StatusLookup = () => 'idle'

export function listWorkspaces(db: Db, status: StatusLookup = idle): Workspace[] {
  const rows = db.prepare('SELECT * FROM workspaces WHERE archived_at IS NULL ORDER BY created_at').all() as WorkspaceRow[]
  return rows.map((r) => toWorkspace(r, status))
}

export function getWorkspace(db: Db, id: string, status: StatusLookup = idle): Workspace {
  const row = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(id) as WorkspaceRow | undefined
  if (!row) throw new UserError('workspace_not_found', 'Workspace not found', 404)
  return toWorkspace(row, status)
}

export function setSetupStatus(db: Db, id: string, status: Workspace['setupStatus']): void {
  db.prepare('UPDATE workspaces SET setup_status = ? WHERE id = ?').run(status, id)
}

const pad = (n: number) => String(n).padStart(2, '0')

/** `ws-1111-2140` style name; adds a suffix when taken. */
export function autoName(taken: (name: string) => boolean, now = new Date()): string {
  const base = `ws-${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
  if (!taken(base)) return base
  for (let i = 2; ; i++) if (!taken(`${base}-${i}`)) return `${base}-${i}`
}

/**
 * New workspace = a git worktree on a new branch `<project prefix><name>`. Free chat, or a
 * workflow whose values reach Claude every turn (D-15, D-16). The base is, in order: the
 * Advanced override, the workflow's branch field, the project base. The project's main
 * checkout is never touched.
 */
export async function createWorkspace(db: Db, input: unknown, run: Git = defaultGit): Promise<Workspace> {
  const parsed = WorkspaceInput.safeParse(input)
  if (!parsed.success) throw new UserError('invalid_workspace', parsed.error.issues[0]?.message ?? 'Invalid workspace')
  const data = parsed.data
  const repo = getRepo(db, data.repoId)
  const settings = getSettings(db)
  const workflow = data.workflowId ? getWorkflow(db, data.workflowId) : null
  const values = workflow ? resolveValues(workflow, data.values) : {}

  const workspacesDir = join(expandHome(settings.workspacesDir), repo.name)
  const taken = (name: string) =>
    existsSync(join(workspacesDir, name)) || Boolean(db.prepare('SELECT 1 FROM workspaces WHERE repo_id = ? AND name = ?').get(repo.id, name))
  const name = data.name?.trim() || autoName(taken)
  const branch = `${repo.branchPrefix}${name}`
  const worktreePath = join(workspacesDir, name)
  const branchField = workflow?.fields.find((f) => f.type === 'branch')
  const base = data.base?.trim() || (branchField ? values[branchField.key] : '') || repo.featureBase

  if (existsSync(worktreePath)) throw new UserError('path_exists', `Folder already exists: ${worktreePath}`, 409)
  if (await refExists(run, repo.path, `refs/heads/${branch}`)) {
    throw new UserError('branch_exists', `Branch already exists: ${branch}`, 409)
  }
  try {
    await fetchForBase(run, repo.path, base)
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr ?? ''
    if (/couldn't find remote ref|not our ref|invalid refspec/i.test(stderr)) {
      throw new UserError('base_not_found', `Base not found: ${base}`)
    }
    throw new UserError('fetch_failed', `git fetch failed: ${stderr.trim() || (error as Error).message}`)
  }
  if (!(await refExists(run, repo.path, base))) throw new UserError('base_not_found', `Base not found: ${base}`)

  mkdirSync(dirname(worktreePath), { recursive: true })
  try {
    await addWorktree(run, repo.path, branch, worktreePath, base)
  } catch (error) {
    throw new UserError('worktree_failed', `git worktree add failed: ${(error as { stderr?: string }).stderr ?? (error as Error).message}`)
  }

  const id = randomUUID()
  db.prepare(
    `INSERT INTO workspaces (id, repo_id, kind, name, branch, base, worktree_path, setup_status, workflow_id, values_json, created_at)
     VALUES (?, ?, 'feature', ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    repo.id,
    name,
    branch,
    base,
    worktreePath,
    repo.setupScript.trim() ? 'pending' : 'skipped',
    workflow?.id ?? null,
    JSON.stringify(values),
    nowIso(),
  )
  return getWorkspace(db, id)
}
