import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { z } from 'zod/v4'
import { UserError } from '../errors'
import { nowIso } from '../paths'
import { getRepo } from '../settings/store'
import type { Db } from '../sqlite/db'
import { type Git, git as defaultGit, deleteBranch, isDirty, removeWorktree } from './git'
import { getWorkspace } from './service'

export const ArchiveOptions = z.object({
  /** Only true when the user confirmed it (AC-W5). */
  deleteBranch: z.boolean().default(false),
  /** Remove the worktree even with uncommitted changes. */
  force: z.boolean().default(false),
})

/** Archive = run the archive script, remove the worktree, optionally delete the branch. */
export async function archiveWorkspace(db: Db, id: string, input: unknown, run: Git = defaultGit): Promise<void> {
  const options = ArchiveOptions.safeParse(input ?? {})
  if (!options.success) throw new UserError('invalid_archive', 'Invalid archive options')
  const ws = getWorkspace(db, id)
  if (ws.archivedAt) throw new UserError('already_archived', 'Workspace is already archived', 409)
  const repo = getRepo(db, ws.repoId)

  if (existsSync(ws.worktreePath)) {
    if (!options.data.force && (await isDirty(run, ws.worktreePath))) {
      throw new UserError('worktree_dirty', 'The worktree has uncommitted changes', 409)
    }
    if (repo.archiveScript.trim()) {
      spawnSync('sh', ['-c', repo.archiveScript], { cwd: ws.worktreePath, stdio: 'ignore', timeout: 120_000 })
    }
    await removeWorktree(run, repo.path, ws.worktreePath, options.data.force)
  }
  if (options.data.deleteBranch) await deleteBranch(run, repo.path, ws.branch)
  db.prepare('UPDATE workspaces SET archived_at = ? WHERE id = ?').run(nowIso(), id)
}
