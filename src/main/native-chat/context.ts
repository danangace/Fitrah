import type { Repo, Settings, Workspace } from '../../shared/schemas'
import { expandHome } from '../paths'

/** Fill `{iteration}` / `{module}` in a docs path pattern; null when a value is missing. */
export function fillPattern(pattern: string, ws: Pick<Workspace, 'iteration' | 'module'>): string | null {
  let missing = false
  const out = pattern.replace(/\{(iteration|module)\}/g, (_m, key: 'iteration' | 'module') => {
    const value = ws[key]
    if (!value) missing = true
    return value ?? ''
  })
  return missing ? null : out
}

/**
 * The workspace facts every chat in it should know (PRD, Figma, iteration, module, branch…).
 * Appended to Claude Code's own system prompt on every turn, so the agent never has to guess
 * where the task comes from.
 */
export function workspaceContext(ws: Workspace, repo: Repo, settings: Settings): string {
  const docsRoot = settings.docsRoot ? expandHome(settings.docsRoot) : null
  const moduleDocs = docsRoot ? fillPattern(settings.paths.moduleDocs, ws) : null
  const lines = [
    '# Fitrah workspace context',
    'You are working inside a Fitrah workspace. These are the facts the user entered for this task; treat them as the task source.',
    '',
    `- Kind: ${ws.kind === 'defect' ? 'defect (bug fix)' : 'feature'}`,
    `- Repo: ${repo.name} (${repo.path})`,
    `- Worktree (your working directory): ${ws.worktreePath}`,
    `- Branch: ${ws.branch} (created from ${ws.base})`,
    `- Iteration: ${ws.iteration ?? 'not set'}`,
    `- Module: ${ws.module ?? 'not set'}`,
    `- PRD: ${ws.prdUrl ?? 'not set'}`,
    `- Figma: ${ws.figmaUrl ?? 'not set'}`,
  ]
  if (docsRoot) lines.push(`- Docs root (vault, read and write docs here, not in the repo): ${docsRoot}`)
  if (docsRoot && moduleDocs) lines.push(`- Module docs folder (by the configured pattern): ${docsRoot}/${moduleDocs}`)
  lines.push('', 'If a field says "not set", ask the user for it instead of searching for it.')
  return lines.join('\n')
}
