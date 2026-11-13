import { useMemo, useState } from 'react'
import type { Workflow } from '../../../shared/schemas'
import { checkReady } from '../../../shared/readiness'
import { BOARD_COLUMNS, COLUMN_LABELS, type BoardColumn, type Task } from '../../../shared/tasks'
import { api } from '../../api/nakoda'
import { errorText } from '../../lib/errors'
import { defaultWorkflowId } from '../../lib/tasks-board'
import { useWorkspaces } from '../../store/workspaces'
import { Button } from '../ui/Button'
import { Field, Input, Notice, TextArea } from '../ui/Field'
import { Modal } from '../ui/Modal'
import { Select } from '../ui/Select'
import { useConfirm } from '../ui/confirm'
import { WorkflowFieldInput } from '../workspace/CreateWorkspaceModal'

const NONE = '__none'

/** Create (no `task`) or edit a ticket. Shows what is still missing before it can be assigned. */
export function TaskModal({ task, workflows, onClose, onChanged, onAssign }: {
  task?: Task
  workflows: Workflow[]
  onClose: () => void
  onChanged: () => void
  onAssign?: (task: Task) => void
}) {
  const repos = useWorkspaces((s) => s.repos)
  const confirm = useConfirm()
  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [kind, setKind] = useState<'task' | 'defect'>(task?.kind ?? 'task')
  const [priority, setPriority] = useState(task?.priority ?? '')
  const [repoId, setRepoId] = useState(task ? (task.repoId ?? NONE) : (repos[0]?.id ?? NONE))
  const [workflowId, setWorkflowId] = useState(task ? (task.workflowId ?? NONE) : (defaultWorkflowId(workflows) ?? NONE))
  const [column, setColumn] = useState<BoardColumn>(task?.column ?? 'backlog')
  const [values, setValues] = useState<Record<string, string>>(task?.values ?? {})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const workflow = workflows.find((w) => w.id === workflowId)
  const repo = repos.find((r) => r.id === repoId)
  const missing = useMemo(
    () => checkReady({ title, description, repoId: repoId === NONE ? null : repoId, values }, workflow?.fields),
    [title, description, repoId, values, workflow],
  )
  const assigned = Boolean(task?.workspaceId)

  const save = async () => {
    setBusy(true)
    setError(null)
    // Only keep values of the chosen workflow's fields.
    const keep = Object.fromEntries((workflow?.fields ?? []).map((f) => [f.key, values[f.key] ?? '']))
    const input = { title, description, kind, priority, repoId: repoId === NONE ? null : repoId, workflowId: workflowId === NONE ? null : workflowId, values: keep }
    try {
      if (task) await api.updateTask(task.id, { ...input, column })
      else await api.createTask(input)
      onChanged()
      onClose()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!task || !(await confirm({ title: 'Delete this ticket?', description: 'It is removed from the board. The source ticket is not touched.', confirmLabel: 'Delete', destructive: true }))) return
    try {
      await api.deleteTask(task.id)
      onChanged()
      onClose()
    } catch (e) {
      setError(errorText(e))
    }
  }

  return (
    <Modal title={task ? 'Edit ticket' : 'New ticket'} onClose={onClose} width="max-w-2xl">
      <div className="space-y-4">
        {error && <Notice tone="error">{error}</Notice>}
        <Field label="Title">
          <Input aria-label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Description" hint="What to do and how we know it is done.">
          <TextArea aria-label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Kind">
            <Select aria-label="Kind" value={kind} onValueChange={(v) => setKind(v === 'defect' ? 'defect' : 'task')} options={[{ value: 'task', label: 'Task' }, { value: 'defect', label: 'Defect' }]} />
          </Field>
          <Field label="Priority">
            <Input aria-label="Priority" placeholder="e.g. high" value={priority} onChange={(e) => setPriority(e.target.value)} />
          </Field>
          {task && (
            <Field label="Column">
              <Select aria-label="Column" value={column} onValueChange={(v) => setColumn(v as BoardColumn)} options={BOARD_COLUMNS.map((c) => ({ value: c, label: COLUMN_LABELS[c] }))} />
            </Field>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Project" hint={assigned ? 'Unassign the ticket to change it.' : undefined}>
            <Select aria-label="Project" value={repoId} disabled={assigned} onValueChange={setRepoId} options={[{ value: NONE, label: 'Not chosen' }, ...repos.map((r) => ({ value: r.id, label: r.name }))]} />
          </Field>
          <Field label="Workflow">
            <Select aria-label="Workflow" value={workflowId} onValueChange={setWorkflowId} options={[{ value: NONE, label: 'Free chat' }, ...workflows.map((w) => ({ value: w.id, label: w.name }))]} />
          </Field>
        </div>
        {workflow && workflow.fields.length > 0 && (
          <div className="space-y-3 rounded-md border border-border p-3">
            {workflow.fields.map((f) => (
              <WorkflowFieldInput key={f.key} field={f} value={values[f.key] ?? ''} projectBase={repo?.featureBase ?? ''} onChange={(v) => setValues((cur) => ({ ...cur, [f.key]: v }))} />
            ))}
          </div>
        )}
        {task?.externalUrl && (
          <a href={task.externalUrl} target="_blank" rel="noreferrer noopener" className="text-xs text-foreground/70 underline hover:text-foreground">
            Open in source ({task.source} {task.externalId})
          </a>
        )}
        <p className={missing.length ? 'text-xs text-warning' : 'text-xs text-success'}>{missing.length ? `Missing: ${missing.join(', ')}` : 'Ready to assign.'}</p>
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-2">
            {task && (
              <Button variant="ghost" onClick={() => void remove()}>
                Delete
              </Button>
            )}
            {task && !assigned && onAssign && (
              <Button disabled={busy} onClick={() => onAssign(task)}>
                Assign to a workspace…
              </Button>
            )}
          </div>
          <Button variant="primary" disabled={busy || !title.trim()} onClick={() => void save()}>
            {task ? 'Save ticket' : 'Create ticket'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
