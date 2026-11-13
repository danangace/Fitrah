import type { WorkflowField } from './schemas'

/** The parts of a ticket that readiness looks at. */
export type Readiness = {
  title: string
  description: string
  repoId: string | null
  values: Record<string, string>
}

/**
 * What is still missing before a ticket can be assigned to a workspace: title, description and
 * project always, then the required fields of its workflow. Computed on the fly, never stored.
 */
export function checkReady(task: Readiness, fields: readonly WorkflowField[] = []): string[] {
  const missing: string[] = []
  if (!task.title.trim()) missing.push('Title')
  if (!task.description.trim()) missing.push('Description')
  if (!task.repoId) missing.push('Project')
  for (const f of fields) {
    if (f.required && !(task.values[f.key] ?? f.default ?? '').trim()) missing.push(f.label)
  }
  return missing
}
