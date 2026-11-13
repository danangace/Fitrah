import { join } from 'node:path'
import { resolveDocPath } from '../../shared/doc-paths'
import type { Repo, Settings, Workflow, Workspace } from '../../shared/schemas'
import { expandHome } from '../paths'
import { fillInstructions } from '../workflows/service'

/**
 * The facts every chat in a workspace should know, appended to Claude Code's own system prompt on
 * every turn. Free chat: project + branch only. Workflow: also its instructions (with {fields}
 * filled) and every value, so the user never pastes the PRD / Figma again (D-16).
 */
export function workspaceContext(ws: Workspace, repo: Repo, settings: Settings, workflow: Workflow | null): string {
  const docsRoot = settings.docsRoot ? expandHome(settings.docsRoot) : null
  const lines = [
    '# Nakoda workspace context',
    `- Project: ${repo.name} (${repo.path})`,
    `- Worktree (your working directory): ${ws.worktreePath}`,
    `- Branch: ${ws.branch} (created from ${ws.base})`,
  ]
  if (docsRoot) lines.push(`- Docs root (vault; write docs here, not in the repo): ${docsRoot}`)

  // The user's own doc locations (Settings → General → Doc paths), filled for this workspace.
  if (docsRoot && settings.docPaths.length > 0) {
    const resolved = settings.docPaths.map((p) => resolveDocPath(p, ws, workflow))
    lines.push('', '## Doc locations (from Settings; use these, do not invent other places)')
    for (const p of resolved) {
      const note = p.missing.length ? `   (not set: ${p.missing.map((m) => `{${m}}`).join(', ')}; ask the user if you need it)` : ''
      lines.push(`- ${p.label}: ${join(docsRoot, p.path)}${note}`)
    }
  }

  if (!workflow) {
    lines.push('', 'This is a free chat: no task template. The user will say what to do.')
    return lines.join('\n')
  }

  lines.push('', `## Workflow: ${workflow.name}`)
  if (workflow.description) lines.push(workflow.description)
  lines.push('', 'Values the user entered for this task (treat them as the task source):')
  for (const field of workflow.fields) {
    const value = ws.values[field.key] ?? ''
    const shown =
      field.type === 'docsFolder' && value && docsRoot ? `${value} (${join(docsRoot, value)})` : value || 'not set'
    lines.push(`- ${field.label}: ${shown}`)
  }
  if (workflow.instructions.trim()) {
    lines.push('', '### Instructions', fillInstructions(workflow, ws.values))
  }
  lines.push('', 'If a value says "not set" and you need it, ask the user instead of searching for it.')
  return lines.join('\n')
}
