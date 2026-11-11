import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { type Workspace, WorkspaceInput, type WorkspaceStatus } from '../../shared/schemas'
import { UserError } from '../errors'
import { expandHome, nowIso } from '../paths'
import { getRepo, getSettings } from '../settings/store'
import type { Db } from '../sqlite/db'
import { type Git, addWorktree, fetchForBase, git as defaultGit, refExists } from './git'

type WorkspaceRow = {
  id: string
  repo_id: string
  kind: Workspace['kind']
  name: string
  iteration: string | null
  module: string | null
  prd_url: string | null
  figma_url: string | null
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
  kind: r.kind,
  name: r.name,
  base: r.base,
  iteration: r.iteration ?? undefined,
  module: r.module ?? undefined,
  prdUrl: r.prd_url ?? undefined,
  figmaUrl: r.figma_url ?? undefined,
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

/**
 * New workspace = a git worktree on a new branch from the base the user chose. Fitrah never
 * guesses the base (OQ-13) and never touches the repo's main checkout (AC-W6).
 */
export async function createWorkspace(db: Db, input: unknown, run: Git = defaultGit): Promise<Workspace> {
  const parsed = WorkspaceInput.safeParse(input)
  if (!parsed.success) throw new UserError('invalid_workspace', parsed.error.issues[0]?.message ?? 'Invalid workspace')
  const data = parsed.data
  const repo = getRepo(db, data.repoId)
  const settings = getSettings(db)
  const branch = `${settings.branchPrefix[data.kind]}${data.name}`
  const worktreePath = join(expandHome(settings.workspacesDir), repo.name, data.name)

  if (existsSync(worktreePath)) throw new UserError('path_exists', `Folder already exists: ${worktreePath}`, 409)
  if (await refExists(run, repo.path, `refs/heads/${branch}`)) {
    throw new UserError('branch_exists', `Branch already exists: ${branch}`, 409)
  }
  try {
    await fetchForBase(run, repo.path, data.base)
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr ?? ''
    if (/couldn't find remote ref|not our ref|invalid refspec/i.test(stderr)) {
      throw new UserError('base_not_found', `Base not found: ${data.base}`)
    }
    throw new UserError('fetch_failed', `git fetch failed: ${stderr.trim() || (error as Error).message}`)
  }
  if (!(await refExists(run, repo.path, data.base))) throw new UserError('base_not_found', `Base not found: ${data.base}`)

  mkdirSync(dirname(worktreePath), { recursive: true })
  try {
    await addWorktree(run, repo.path, branch, worktreePath, data.base)
  } catch (error) {
    throw new UserError('worktree_failed', `git worktree add failed: ${(error as { stderr?: string }).stderr ?? (error as Error).message}`)
  }

  const id = randomUUID()
  db.prepare(
    `INSERT INTO workspaces (id, repo_id, kind, name, iteration, module, prd_url, figma_url, branch, base, worktree_path, setup_status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    repo.id,
    data.kind,
    data.name,
    data.iteration ?? null,
    data.module ?? null,
    data.prdUrl ?? null,
    data.figmaUrl ?? null,
    branch,
    data.base,
    worktreePath,
    repo.setupScript.trim() ? 'pending' : 'skipped',
    nowIso(),
  )
  return getWorkspace(db, id)
}
