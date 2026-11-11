import type { WorkflowField } from '../../shared/schemas'

/** A stable storage key from a label: "Target docs" → "target_docs" (unique among `taken`). */
export function keyFromLabel(label: string, taken: string[]): string {
  const base =
    label
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'field'
  if (!taken.includes(base)) return base
  for (let i = 2; ; i++) if (!taken.includes(`${base}_${i}`)) return `${base}_${i}`
}

export const FIELD_TYPE_LABEL: Record<WorkflowField['type'], string> = {
  text: 'Text',
  link: 'Link',
  docsFolder: 'Docs folder',
  branch: 'Branch',
  choice: 'Choice',
}

/** "dev, staging ,prod" → ["dev", "staging", "prod"] */
export const parseOptions = (text: string): string[] =>
  text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
