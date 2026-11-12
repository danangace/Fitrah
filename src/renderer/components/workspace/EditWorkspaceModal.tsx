import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Workflow, Workspace } from '../../../shared/schemas'
import { api } from '../../api/fitrah'
import { docFolders } from '../../lib/docs-folders'
import { errorText } from '../../lib/errors'
import { toast } from '../../store/toast'
import { useWorkspaces } from '../../store/workspaces'
import { Button } from '../ui/Button'
import { Field, Notice } from '../ui/Field'
import { Modal } from '../ui/Modal'
import { WorkflowFieldInput } from './CreateWorkspaceModal'

const select = 'w-full rounded-md border border-input bg-card px-2.5 py-1.5 text-sm text-foreground'
const FREE = '__free'

/**
 * Edit an existing workspace: its type and the workflow values (e.g. fill Iteration / Module that
 * were not known at creation). Required fields may stay empty here; they show as "not set".
 */
export function EditWorkspaceModal({ workspace, onClose, onSaved }: { workspace: Workspace; onClose: () => void; onSaved: (ws: Workspace) => void }) {
  const { repos, load } = useWorkspaces()
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [folders, setFolders] = useState<string[]>([])
  const [type, setType] = useState(workspace.workflowId ?? FREE)
  const [values, setValues] = useState<Record<string, string>>(workspace.values)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.listWorkflows().then(setWorkflows, (e: unknown) => setError(errorText(e)))
    api.docsTree().then((t) => setFolders(docFolders(t)), () => setFolders([]))
  }, [])

  const workflow = workflows.find((w) => w.id === type) ?? null
  const repo = repos.find((r) => r.id === workspace.repoId)
  const missing = (workflow?.fields ?? []).filter((f) => f.required && !values[f.key]?.trim()).map((f) => f.label)
  const hasBranchField = Boolean(workflow?.fields.some((f) => f.type === 'branch'))

  const changeType = (next: string) => {
    setType(next)
    // Switching workflow: keep values whose field key still exists, fill the rest from defaults.
    const target = workflows.find((w) => w.id === next)
    if (target) setValues((cur) => Object.fromEntries(target.fields.map((f) => [f.key, cur[f.key] ?? f.default ?? ''])))
  }

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      const ws = await api.updateWorkspace(workspace.id, { workflowId: workflow?.id ?? null, values: workflow ? values : {} })
      await load()
      toast.success('Workspace saved', 'Chats use the new values from their next message.')
      onSaved(ws)
      onClose()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Edit workspace" onClose={onClose}>
      <div
        className="space-y-4"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !busy) void save()
        }}
      >
        {error && <Notice tone="error">{error}</Notice>}
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground/80">{workspace.name}</span> · branch <code className="text-foreground/80">{workspace.branch}</code> (the branch and
          folder do not change)
        </p>
        <Field label="Type">
          <select aria-label="Type" className={select} value={type} onChange={(e) => changeType(e.target.value)}>
            <option value={FREE}>Free chat</option>
            {workflows.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </Field>
        {workflow && (
          <div className="space-y-3 rounded-md border border-border p-3">
            {workflow.description && <p className="text-xs text-muted-foreground">{workflow.description}</p>}
            {workflow.fields.map((f) => (
              <WorkflowFieldInput
                key={f.key}
                field={f}
                value={values[f.key] ?? ''}
                projectBase={repo?.featureBase ?? ''}
                onChange={(v) => setValues((cur) => ({ ...cur, [f.key]: v }))}
              />
            ))}
            {hasBranchField && <p className="text-xs text-muted-foreground">The base branch only applied when the workspace was created.</p>}
            <datalist id="fitrah-doc-folders">
              {folders.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </div>
        )}
        {missing.length > 0 && <p className="text-xs text-warning">Still empty: {missing.join(', ')}. You can save now and fill them later.</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={busy} onClick={() => void save()}>
            {busy && <Loader2 size={14} className="animate-spin" />}
            {busy ? 'Saving…' : 'Save'} <span className="text-[11px] opacity-70">⌘↵</span>
          </Button>
        </div>
      </div>
    </Modal>
  )
}
