import { execFileAsync } from '../paths'

export type GitResult = { stdout: string; stderr: string }
export type Git = (repo: string, args: string[]) => Promise<GitResult>

export const git: Git = (repo, args) => execFileAsync('git', ['-C', repo, ...args], { maxBuffer: 10 * 1024 * 1024 })

export async function refExists(run: Git, repo: string, ref: string): Promise<boolean> {
  try {
    await run(repo, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`])
    return true
  } catch {
    return false
  }
}

/** Remote bases are fetched first, so a worktree never starts from a stale local ref. */
export async function fetchForBase(run: Git, repo: string, base: string): Promise<void> {
  const match = base.match(/^([^/]+)\/(.+)$/)
  if (!match) return
  const [, remote, branch] = match
  const { stdout } = await run(repo, ['remote'])
  if (!stdout.split('\n').includes(remote ?? '')) return
  await run(repo, ['fetch', remote ?? '', branch ?? ''])
}

export async function addWorktree(run: Git, repo: string, branch: string, path: string, base: string): Promise<void> {
  await run(repo, ['worktree', 'add', '--no-track', '-b', branch, path, base])
}

export async function isDirty(run: Git, worktree: string): Promise<boolean> {
  const { stdout } = await run(worktree, ['status', '--porcelain'])
  return stdout.trim().length > 0
}

export async function removeWorktree(run: Git, repo: string, path: string, force: boolean): Promise<void> {
  await run(repo, ['worktree', 'remove', ...(force ? ['--force'] : []), path])
}

export async function deleteBranch(run: Git, repo: string, branch: string): Promise<void> {
  await run(repo, ['branch', '-D', branch])
}
