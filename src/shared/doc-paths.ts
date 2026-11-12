import type { DocPath, Workflow, Workspace } from './schemas'

/** Placeholders every doc path can use, whatever the workflow. Shown as help in Settings. */
export const BUILTIN_PLACEHOLDERS = ['{yyyy-mm}', '{yyyy-mm-dd}', '{yyyy}', '{workspace}', '{branch}'] as const

export type ResolvedDocPath = DocPath & {
  /** Template with every known placeholder filled; unknown or empty ones stay as `{name}`. */
  path: string
  /** Placeholders left unfilled (without braces). */
  missing: string[]
}

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Fill a doc path template from the workspace: built-ins (`{yyyy-mm}`, `{workspace}`, `{branch}`…)
 * and workflow fields matched by label or key, case-insensitive (the same rule as workflow
 * instructions). Empty values count as missing so Claude asks instead of guessing.
 */
export function resolveDocPath(
  docPath: DocPath,
  ws: Pick<Workspace, 'name' | 'branch' | 'values'>,
  workflow: Pick<Workflow, 'fields'> | null,
  now: Date = new Date(),
): ResolvedDocPath {
  const known = new Map<string, string>([
    ['yyyy', String(now.getFullYear())],
    ['yyyy-mm', `${now.getFullYear()}-${pad(now.getMonth() + 1)}`],
    ['yyyy-mm-dd', `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`],
    ['workspace', ws.name],
    ['branch', ws.branch],
  ])
  for (const field of workflow?.fields ?? []) {
    const value = ws.values[field.key]?.trim() ?? ''
    known.set(field.key.toLowerCase(), value)
    known.set(field.label.trim().toLowerCase(), value)
  }
  const missing: string[] = []
  const path = docPath.template.replace(/\{([^{}]+)\}/g, (whole, name: string) => {
    const value = known.get(name.trim().toLowerCase())
    if (value) return value
    if (!missing.includes(name.trim())) missing.push(name.trim())
    return whole
  })
  return { ...docPath, path, missing }
}
