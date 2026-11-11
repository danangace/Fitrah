import type { Repo } from '../../shared/schemas'

export type RepoForm = { setupScript: string; archiveScript: string; featureBase: string; branchPrefix: string }

export const formFromRepo = (repo: Repo): RepoForm => ({
  setupScript: repo.setupScript,
  archiveScript: repo.archiveScript,
  featureBase: repo.featureBase,
  branchPrefix: repo.branchPrefix,
})

/** True when the form differs from what is saved (ignores trailing whitespace). */
export function isDirty(form: RepoForm, repo: Repo): boolean {
  const saved = formFromRepo(repo)
  return (Object.keys(saved) as (keyof RepoForm)[]).some((k) => form[k].trim() !== saved[k].trim())
}

export type SetupState = { label: string; tone: 'ok' | 'warn' }

/** What the repo row badge says: is this repo ready for new workspaces? */
export function setupState(repo: Repo): SetupState {
  if (!repo.featureBase.trim()) return { label: 'No feature base', tone: 'warn' }
  if (!repo.setupScript.trim()) return { label: 'Ready · no setup script', tone: 'ok' }
  return { label: 'Ready · setup script', tone: 'ok' }
}
