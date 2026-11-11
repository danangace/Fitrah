import { randomUUID } from 'node:crypto'
import { basename } from 'node:path'
import { Repo, RepoInput, Settings } from '../../shared/schemas'
import { UserError } from '../errors'
import { expandHome, isDirectory, isGitRepo, nowIso } from '../paths'
import type { Db } from '../sqlite/db'

export const DEFAULT_SETTINGS: Settings = {
  docsRoot: null,
  paths: {
    moduleDocs: 'frontend/modules/{iteration}/{module}',
    plans: 'plans/{yyyy-mm}/{iteration}/{feature}/{feature}.md',
    oqFile: 'Open Questions.md',
  },
  workspacesDir: '~/fitrah/workspaces',
  branchPrefix: { feature: 'feat/tribe-2/', defect: 'fix/tribe-2/' },
  models: { claude: { list: ['sonnet', 'opus', 'haiku'], default: 'sonnet' } },
  openIn: { kind: 'default' },
}

const SETTINGS_KEY = 'app'

export function getSettings(db: Db): Settings {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(SETTINGS_KEY) as { value: string } | undefined
  if (!row) return DEFAULT_SETTINGS
  const parsed = Settings.safeParse({ ...DEFAULT_SETTINGS, ...JSON.parse(row.value) })
  return parsed.success ? parsed.data : DEFAULT_SETTINGS
}

/** Validate and save. Nothing is saved when a check fails (AC-S1). */
export function saveSettings(db: Db, input: unknown): Settings {
  const parsed = Settings.safeParse(input)
  if (!parsed.success) throw new UserError('invalid_settings', parsed.error.issues[0]?.message ?? 'Invalid settings')
  const settings = parsed.data
  if (settings.docsRoot !== null && !isDirectory(expandHome(settings.docsRoot))) {
    throw new UserError('docs_root_missing', `Docs root does not exist: ${settings.docsRoot}`)
  }
  for (const [agent, models] of Object.entries(settings.models)) {
    if (!models.list.includes(models.default)) {
      throw new UserError('invalid_default_model', `Default model for ${agent} must be in its list`)
    }
  }
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
  ).run(SETTINGS_KEY, JSON.stringify(settings))
  return settings
}

type RepoRow = {
  id: string
  name: string
  path: string
  setup_script: string
  archive_script: string
  feature_base: string
  shared_dirs: string
  created_at: string
}

const toRepo = (r: RepoRow): Repo => ({
  id: r.id,
  name: r.name,
  path: r.path,
  setupScript: r.setup_script,
  archiveScript: r.archive_script,
  featureBase: r.feature_base,
  sharedDirs: JSON.parse(r.shared_dirs) as string[],
  createdAt: r.created_at,
})

export function listRepos(db: Db): Repo[] {
  return (db.prepare('SELECT * FROM repos ORDER BY name').all() as RepoRow[]).map(toRepo)
}

export function getRepo(db: Db, id: string): Repo {
  const row = db.prepare('SELECT * FROM repos WHERE id = ?').get(id) as RepoRow | undefined
  if (!row) throw new UserError('repo_not_found', 'Repo not found', 404)
  return toRepo(row)
}

/** Repo settings live in Fitrah's DB; nothing is written into the repo itself (OQ-16, AC-S4). */
export async function addRepo(db: Db, input: unknown): Promise<Repo> {
  const parsed = RepoInput.safeParse(input)
  if (!parsed.success) throw new UserError('invalid_repo', parsed.error.issues[0]?.message ?? 'Invalid repo')
  const path = expandHome(parsed.data.path)
  if (!(await isGitRepo(path))) throw new UserError('not_a_git_repo', `Not a git repository: ${path}`)
  if (db.prepare('SELECT 1 FROM repos WHERE path = ?').get(path)) {
    throw new UserError('repo_exists', 'This repo is already added', 409)
  }
  const repo: Repo = { ...parsed.data, path, id: randomUUID(), name: basename(path), createdAt: nowIso() }
  db.prepare(
    `INSERT INTO repos (id, name, path, setup_script, archive_script, feature_base, shared_dirs, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    repo.id,
    repo.name,
    repo.path,
    repo.setupScript,
    repo.archiveScript,
    repo.featureBase,
    JSON.stringify(repo.sharedDirs),
    repo.createdAt,
  )
  return repo
}

export function updateRepo(db: Db, id: string, input: unknown): Repo {
  const current = getRepo(db, id)
  const parsed = RepoInput.safeParse({ ...current, ...(input as object), path: current.path })
  if (!parsed.success) throw new UserError('invalid_repo', parsed.error.issues[0]?.message ?? 'Invalid repo')
  const d = parsed.data
  db.prepare(
    'UPDATE repos SET setup_script = ?, archive_script = ?, feature_base = ?, shared_dirs = ? WHERE id = ?',
  ).run(d.setupScript, d.archiveScript, d.featureBase, JSON.stringify(d.sharedDirs), id)
  return getRepo(db, id)
}

export function removeRepo(db: Db, id: string): void {
  getRepo(db, id)
  const used = db.prepare('SELECT 1 FROM workspaces WHERE repo_id = ? AND archived_at IS NULL').get(id)
  if (used) throw new UserError('repo_in_use', 'Archive its workspaces first', 409)
  db.prepare('DELETE FROM repos WHERE id = ?').run(id)
}
