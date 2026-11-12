import { randomUUID } from 'node:crypto'
import { type Workflow, WorkflowField, WorkflowInput } from '../../shared/schemas'
import { UserError } from '../errors'
import { nowIso } from '../paths'
import type { Db } from '../sqlite/db'

type Row = {
  id: string
  name: string
  description: string
  fields_json: string
  instructions: string
  created_at: string
  updated_at: string
}

const toWorkflow = (r: Row): Workflow => ({
  id: r.id,
  name: r.name,
  description: r.description,
  fields: WorkflowField.array().parse(JSON.parse(r.fields_json)),
  instructions: r.instructions,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

export function listWorkflows(db: Db): Workflow[] {
  return (db.prepare('SELECT * FROM workflows ORDER BY name').all() as Row[]).map(toWorkflow)
}

export function getWorkflow(db: Db, id: string): Workflow {
  const row = db.prepare('SELECT * FROM workflows WHERE id = ?').get(id) as Row | undefined
  if (!row) throw new UserError('workflow_not_found', 'Workflow not found', 404)
  return toWorkflow(row)
}

function parse(input: unknown) {
  const parsed = WorkflowInput.safeParse(input)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    throw new UserError('invalid_workflow', `${issue?.path.join('.') ?? ''} ${issue?.message ?? 'Invalid workflow'}`.trim())
  }
  const data = parsed.data
  const keys = new Set<string>()
  for (const f of data.fields) {
    if (keys.has(f.key)) throw new UserError('duplicate_field', `Two fields use the key "${f.key}"`)
    keys.add(f.key)
    if (f.type === 'choice' && !(f.options && f.options.length > 0)) {
      throw new UserError('choice_needs_options', `Field "${f.label}" needs at least one choice`)
    }
  }
  return data
}

export function createWorkflow(db: Db, input: unknown): Workflow {
  const data = parse(input)
  if (db.prepare('SELECT 1 FROM workflows WHERE name = ?').get(data.name)) {
    throw new UserError('workflow_exists', `A workflow named "${data.name}" already exists`, 409)
  }
  const id = randomUUID()
  const now = nowIso()
  db.prepare(
    'INSERT INTO workflows (id, name, description, fields_json, instructions, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(id, data.name, data.description, JSON.stringify(data.fields), data.instructions, now, now)
  return getWorkflow(db, id)
}

export function updateWorkflow(db: Db, id: string, input: unknown): Workflow {
  getWorkflow(db, id)
  const data = parse(input)
  const clash = db.prepare('SELECT id FROM workflows WHERE name = ? AND id != ?').get(data.name, id)
  if (clash) throw new UserError('workflow_exists', `A workflow named "${data.name}" already exists`, 409)
  db.prepare('UPDATE workflows SET name = ?, description = ?, fields_json = ?, instructions = ?, updated_at = ? WHERE id = ?').run(
    data.name,
    data.description,
    JSON.stringify(data.fields),
    data.instructions,
    nowIso(),
    id,
  )
  return getWorkflow(db, id)
}

export function removeWorkflow(db: Db, id: string): void {
  getWorkflow(db, id)
  if (db.prepare('SELECT 1 FROM workspaces WHERE workflow_id = ? AND archived_at IS NULL').get(id)) {
    throw new UserError('workflow_in_use', 'Archive the workspaces that use this workflow first', 409)
  }
  db.prepare('UPDATE workspaces SET workflow_id = NULL WHERE workflow_id = ?').run(id)
  db.prepare('DELETE FROM workflows WHERE id = ?').run(id)
}

/** Defaults applied, values trimmed, unknown keys dropped; required fields must be filled. */
/**
 * Field values for a workflow: defaults filled, choices checked. `requireAll: false` (editing an
 * existing workspace) lets required fields stay empty, so you can fill what you know now.
 */
export function resolveValues(workflow: Workflow, values: Record<string, string>, { requireAll = true } = {}): Record<string, string> {
  const out: Record<string, string> = {}
  const missing: string[] = []
  for (const f of workflow.fields) {
    const value = (values[f.key] ?? f.default ?? '').trim()
    if (requireAll && f.required && !value) missing.push(f.label)
    if (f.type === 'choice' && value && f.options && !f.options.includes(value)) {
      throw new UserError('invalid_choice', `"${value}" is not a choice of ${f.label}`)
    }
    out[f.key] = value
  }
  if (missing.length) throw new UserError('missing_fields', `Fill in: ${missing.join(', ')}`)
  return out
}

/** `{Label}` (case-insensitive) → the field's value; unknown placeholders stay as they are. */
export function fillInstructions(workflow: Workflow, values: Record<string, string>): string {
  const byLabel = new Map(workflow.fields.map((f) => [f.label.toLowerCase(), values[f.key] || '(not set)']))
  return workflow.instructions.replace(/\{([^{}]+)\}/g, (whole, label: string) => byLabel.get(label.trim().toLowerCase()) ?? whole)
}
