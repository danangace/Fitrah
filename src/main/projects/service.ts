import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import type { Repo } from '../../shared/schemas'
import { UserError } from '../errors'
import { execFileAsync, expandHome, isDirectory, isGitRepo } from '../paths'
import { addRepo } from '../settings/store'
import type { Db } from '../sqlite/db'

export type DirEntry = { name: string; path: string; isGitRepo: boolean }
export type DirListing = { path: string; parent: string | null; home: string; dirs: DirEntry[] }

/** Folder browser for "Add a project" (a web page cannot use the Mac folder picker). Folders only. */
export function listDirs(path?: string, showHidden = false, home = homedir()): DirListing {
  const dir = expandHome(path?.trim() || home)
  if (!isDirectory(dir)) throw new UserError('folder_missing', `Folder does not exist: ${dir}`, 404)
  let names: string[]
  try {
    names = readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && (showHidden || !e.name.startsWith('.')))
      .map((e) => e.name)
  } catch {
    throw new UserError('folder_unreadable', `Cannot read folder: ${dir}`, 400)
  }
  const dirs = names
    .toSorted((a, b) => a.localeCompare(b))
    .map((name) => ({ name, path: join(dir, name), isGitRepo: existsSync(join(dir, name, '.git')) }))
  return { path: dir, parent: dirname(dir) === dir ? null : dirname(dir), home, dirs }
}

/** Best default base for new workspaces: origin's default branch, else the current branch. */
export async function defaultBase(repoPath: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', ['-C', repoPath, 'symbolic-ref', '--short', 'refs/remotes/origin/HEAD'])
    if (stdout.trim()) return stdout.trim()
  } catch {
    /* no origin HEAD */
  }
  try {
    const { stdout } = await execFileAsync('git', ['-C', repoPath, 'rev-parse', '--abbrev-ref', 'HEAD'])
    if (stdout.trim() && stdout.trim() !== 'HEAD') return stdout.trim()
  } catch {
    /* empty repo */
  }
  return 'main'
}

export type Inspection = { path: string; name: string; isGitRepo: boolean; defaultBase: string | null }

export async function inspectFolder(path: string): Promise<Inspection> {
  const full = expandHome(path)
  if (!isDirectory(full)) throw new UserError('folder_missing', `Folder does not exist: ${full}`, 404)
  const git = await isGitRepo(full)
  return { path: full, name: basename(full), isGitRepo: git, defaultBase: git ? await defaultBase(full) : null }
}

/** Never let git ask for a password in the background: fail fast with a clear error instead. */
const gitEnv = { ...process.env, GIT_TERMINAL_PROMPT: '0' }

export function repoNameFromUrl(url: string): string {
  const name = basename(url.trim().replace(/\/+$/, '')).replace(/\.git$/, '')
  if (!/^[\w.-]+$/.test(name)) throw new UserError('invalid_url', 'Cannot read a folder name from that URL')
  return name
}

/** Clone from URL into `<parent>/<name>`, then add it as a project (AC-P2). */
export async function cloneProject(db: Db, input: { url: string; parentDir: string; name?: string }): Promise<Repo> {
  const parent = expandHome(input.parentDir)
  if (!isDirectory(parent)) throw new UserError('folder_missing', `Folder does not exist: ${parent}`, 404)
  const name = input.name?.trim() || repoNameFromUrl(input.url)
  const target = join(parent, name)
  if (existsSync(target)) throw new UserError('path_exists', `Folder already exists: ${target}`, 409)
  try {
    await execFileAsync('git', ['clone', input.url.trim(), target], { env: gitEnv, timeout: 15 * 60_000, maxBuffer: 10 * 1024 * 1024 })
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr?.trim()
    throw new UserError('clone_failed', `git clone failed: ${stderr || (error as Error).message}`)
  }
  return addRepo(db, { path: target, featureBase: await defaultBase(target) })
}

/** Empty folder + `git init` + a first commit (worktrees need one), then add it as a project (AC-P3). */
export async function createProject(db: Db, input: { parentDir: string; name: string }): Promise<Repo> {
  const parent = expandHome(input.parentDir)
  if (!isDirectory(parent)) throw new UserError('folder_missing', `Folder does not exist: ${parent}`, 404)
  const name = input.name.trim()
  if (!/^[\w.-]+$/.test(name)) throw new UserError('invalid_name', 'Use letters, numbers, dots, dashes or underscores')
  const target = join(parent, name)
  if (existsSync(target)) throw new UserError('path_exists', `Folder already exists: ${target}`, 409)
  mkdirSync(target)
  try {
    await execFileAsync('git', ['init', '-q', '-b', 'main', target])
    await execFileAsync('git', ['-C', target, 'commit', '-q', '--allow-empty', '-m', 'Initial commit'])
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr?.trim()
    throw new UserError('init_failed', `git init failed: ${stderr || (error as Error).message}`)
  }
  return addRepo(db, { path: target, featureBase: 'main' })
}
