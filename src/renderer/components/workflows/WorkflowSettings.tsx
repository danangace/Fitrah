import { ArrowDown, ArrowUp, Check, Loader2, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { Workflow, WorkflowField, WorkflowInput } from '../../../shared/schemas'
import { api } from '../../api/fitrah'
import { cn } from '../../lib/cn'
import { errorText } from '../../lib/errors'
import { FIELD_TYPE_LABEL, keyFromLabel, parseOptions } from '../../lib/workflow-form'
import { Button } from '../ui/Button'
import { Card, Field, Input, Notice, ScriptArea } from '../ui/Field'

type Draft = { name: string; description: string; fields: WorkflowField[]; instructions: string }
const EMPTY: Draft = { name: '', description: '', fields: [], instructions: '' }
const cellInput = 'w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs focus:border-emerald-600 focus:outline-none'

function FieldRow({
  field,
  onChange,
  onRemove,
  onMove,
}: {
  field: WorkflowField
  onChange: (f: WorkflowField) => void
  onRemove: () => void
  onMove: (dir: -1 | 1) => void
}) {
  return (
    <div data-testid="workflow-field" className="space-y-2 rounded-md border border-neutral-800 p-2.5">
      <div className="grid grid-cols-12 items-center gap-2">
        <input aria-label="Field label" className={cn(cellInput, 'col-span-4')} value={field.label} onChange={(e) => onChange({ ...field, label: e.target.value })} />
        <select aria-label="Field type" className={cn(cellInput, 'col-span-3')} value={field.type} onChange={(e) => onChange({ ...field, type: e.target.value as WorkflowField['type'] })}>
          {Object.entries(FIELD_TYPE_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <label className="col-span-2 flex items-center gap-1.5 text-xs text-neutral-300">
          <input type="checkbox" checked={field.required} onChange={(e) => onChange({ ...field, required: e.target.checked })} /> required
        </label>
        <div className="col-span-3 flex justify-end gap-1 text-neutral-500">
          <button type="button" aria-label="Move up" onClick={() => onMove(-1)} className="hover:text-white">
            <ArrowUp size={13} />
          </button>
          <button type="button" aria-label="Move down" onClick={() => onMove(1)} className="hover:text-white">
            <ArrowDown size={13} />
          </button>
          <button type="button" aria-label="Remove field" onClick={onRemove} className="hover:text-red-400">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-12 gap-2">
        <input aria-label="Default value" placeholder="Default (optional)" className={cn(cellInput, 'col-span-4')} value={field.default ?? ''} onChange={(e) => onChange({ ...field, default: e.target.value || undefined })} />
        <input aria-label="Help text" placeholder="Help text (optional)" className={cn(cellInput, field.type === 'choice' ? 'col-span-4' : 'col-span-8')} value={field.help ?? ''} onChange={(e) => onChange({ ...field, help: e.target.value || undefined })} />
        {field.type === 'choice' && (
          <input
            aria-label="Choices"
            placeholder="Choices: dev, staging, prod"
            className={cn(cellInput, 'col-span-4')}
            value={(field.options ?? []).join(', ')}
            onChange={(e) => onChange({ ...field, options: parseOptions(e.target.value) })}
          />
        )}
      </div>
      <div className="text-[10px] text-neutral-600">key: {field.key}</div>
    </div>
  )
}

function Editor({
  workflow,
  justSaved,
  onSaved,
  onDeleted,
}: {
  workflow: Workflow | null
  justSaved: boolean
  onSaved: (w: Workflow) => void
  onDeleted: () => void
}) {
  const [draft, setDraft] = useState<Draft>(
    workflow ? { name: workflow.name, description: workflow.description, fields: workflow.fields, instructions: workflow.instructions } : EMPTY,
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(justSaved)
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<Draft>) => {
    setDraft({ ...draft, ...patch })
    setSaved(false)
  }
  const setField = (i: number, f: WorkflowField) => set({ fields: draft.fields.map((x, j) => (j === i ? f : x)) })
  const addField = () =>
    set({ fields: [...draft.fields, { key: keyFromLabel(`Field ${draft.fields.length + 1}`, draft.fields.map((f) => f.key)), label: `Field ${draft.fields.length + 1}`, type: 'text', required: false }] })
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= draft.fields.length) return
    const fields = [...draft.fields]
    ;[fields[i], fields[j]] = [fields[j] as WorkflowField, fields[i] as WorkflowField]
    set({ fields })
  }
  const insert = (label: string) => set({ instructions: `${draft.instructions}{${label}}` })

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const input: WorkflowInput = { name: draft.name, description: draft.description, fields: draft.fields, instructions: draft.instructions }
      const result = workflow ? await api.updateWorkflow(workflow.id, input) : await api.createWorkflow(input)
      setSaved(true)
      onSaved(result)
    } catch (e) {
      setError(errorText(e))
    } finally {
      setSaving(false)
    }
  }
  const remove = async () => {
    if (!workflow || !window.confirm(`Delete the workflow "${workflow.name}"?`)) return
    try {
      await api.deleteWorkflow(workflow.id)
      onDeleted()
    } catch (e) {
      setError(errorText(e))
    }
  }

  return (
    <Card title={workflow ? `Edit · ${workflow.name}` : 'New workflow'}>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Name">
          <Input value={draft.name} placeholder="e.g. Planning" onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="Description">
          <Input value={draft.description} placeholder="What this workflow is for" onChange={(e) => set({ description: e.target.value })} />
        </Field>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-neutral-200">Fields the user fills when creating a workspace</span>
          <Button onClick={addField}>
            <Plus size={13} /> Add field
          </Button>
        </div>
        {draft.fields.length === 0 && <p className="text-xs text-neutral-500">No fields yet.</p>}
        {draft.fields.map((f, i) => (
          <FieldRow
            key={f.key}
            field={f}
            onChange={(next) =>
              // A new field's key follows its label until saved; saved keys never change (values use them).
              setField(i, workflow?.fields.some((w) => w.key === f.key) ? next : { ...next, key: keyFromLabel(next.label, draft.fields.filter((_, j) => j !== i).map((x) => x.key)) })
            }
            onRemove={() => set({ fields: draft.fields.filter((_, j) => j !== i) })}
            onMove={(dir) => move(i, dir)}
          />
        ))}
      </div>
      <Field label="Instructions for Claude" hint="Sent with every message in workspaces using this workflow. Click a field to insert it.">
        <ScriptArea rows={5} className="font-sans text-sm" value={draft.instructions} onChange={(e) => set({ instructions: e.target.value })} />
      </Field>
      {draft.fields.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {draft.fields.map((f) => (
            <button key={f.key} type="button" onClick={() => insert(f.label)} className="rounded bg-neutral-800 px-1.5 py-0.5 font-mono text-[11px] text-emerald-300 hover:bg-neutral-700">
              {`{${f.label}}`}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-3">
        <Button variant="primary" disabled={saving || !draft.name.trim()} onClick={() => void save()}>
          {saving && <Loader2 size={14} className="animate-spin" />}
          {saving ? 'Saving…' : workflow ? 'Save workflow' : 'Create workflow'}
        </Button>
        {saved && (
          <span className="flex items-center gap-1 text-xs text-emerald-400">
            <Check size={13} /> Saved
          </span>
        )}
        {workflow && (
          <Button variant="ghost" className="ml-auto" onClick={() => void remove()}>
            <Trash2 size={13} /> Delete
          </Button>
        )}
      </div>
    </Card>
  )
}

/** Settings → Workflows: user-defined templates (D-16). */
export function WorkflowSettings() {
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [selected, setSelected] = useState<string | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Keeps "Saved" visible after a new workflow is created (the editor reopens on its id).
  const [justSavedId, setJustSavedId] = useState<string | null>(null)
  const load = useCallback(
    (select?: string) =>
      api.listWorkflows().then((list) => {
        setWorkflows(list)
        setSelected((cur) => select ?? cur ?? list[0]?.id ?? 'new')
      }, (e: unknown) => setError(errorText(e))),
    [],
  )
  useEffect(() => {
    void load()
  }, [load])
  const current = workflows.find((w) => w.id === selected) ?? null

  return (
    <div className="grid gap-4 md:grid-cols-[200px_1fr]">
      <div className="space-y-1">
        {error && <Notice tone="error">{error}</Notice>}
        {workflows.map((w) => (
          <button
            key={w.id}
            type="button"
            onClick={() => setSelected(w.id)}
            className={cn('block w-full truncate rounded-md px-2.5 py-1.5 text-left text-sm', w.id === selected ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:bg-neutral-900')}
          >
            {w.name}
            <span className="ml-1 text-[11px] text-neutral-600">{w.fields.length} fields</span>
          </button>
        ))}
        <button type="button" onClick={() => setSelected('new')} className="flex w-full items-center gap-1.5 rounded-md px-2.5 py-1.5 text-left text-sm text-emerald-400 hover:bg-neutral-900">
          <Plus size={13} /> New workflow
        </button>
      </div>
      <Editor
        key={selected ?? 'none'}
        workflow={selected === 'new' ? null : current}
        justSaved={Boolean(current && current.id === justSavedId)}
        onSaved={(w) => {
          setJustSavedId(w.id)
          void load(w.id)
        }}
        onDeleted={() => void load(undefined).then(() => setSelected(null))}
      />
    </div>
  )
}
