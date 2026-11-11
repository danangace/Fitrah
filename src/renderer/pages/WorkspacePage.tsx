import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import type { Workflow, Workspace } from '../../shared/schemas'
import { api } from '../api/fitrah'
import { ArchiveButton } from '../components/workspace/ArchiveButton'
import { STATUS_LABEL, StatusDot } from '../components/workspace/StatusDot'
import { Notice } from '../components/ui/Field'
import { errorText } from '../lib/errors'
import { useAppEvents } from '../store/events'

function TaskLink({ label, value }: { label: string; value: string }) {
  if (!value) return <span className="rounded bg-card px-2 py-0.5 text-muted-foreground/60">{label}: —</span>
  return /^https?:\/\//.test(value) ? (
    <a href={value} target="_blank" rel="noreferrer" className="rounded bg-secondary px-2 py-0.5 text-success hover:underline">
      {label} ↗
    </a>
  ) : (
    <span className="rounded bg-secondary px-2 py-0.5 text-foreground/80">
      <span className="text-muted-foreground">{label}:</span> {value}
    </span>
  )
}

/** The workflow values Claude receives in every chat of this workspace (workspace context). */
function TaskDetails({ workspace }: { workspace: Workspace }) {
  const [workflow, setWorkflow] = useState<Workflow | null>(null)
  useEffect(() => {
    if (!workspace.workflowId) return setWorkflow(null)
    api.listWorkflows().then((list) => setWorkflow(list.find((w) => w.id === workspace.workflowId) ?? null), () => setWorkflow(null))
  }, [workspace.workflowId])
  if (!workspace.workflowId) return <div className="mt-2 text-xs text-muted-foreground">Free chat</div>
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs" title="Claude gets these in every chat of this workspace">
      <span className="rounded bg-info/10 px-2 py-0.5 font-medium text-info">{workflow?.name ?? 'Workflow'}</span>
      {(workflow?.fields ?? []).map((f) => (
        <TaskLink key={f.key} label={f.label} value={workspace.values[f.key] ?? ''} />
      ))}
    </div>
  )
}

function SetupLog({ workspace }: { workspace: Workspace }) {
  const [log, setLog] = useState('')
  const ref = useRef<HTMLPreElement>(null)
  useEffect(() => {
    api.setupLog(workspace.id).then((r) => setLog(r.log), () => setLog(''))
  }, [workspace.id])
  useAppEvents((e) => {
    if (e.type === 'workspace.setup' && e.workspaceId === workspace.id) setLog((l) => `${l}${e.line}\n`)
  })
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight })
  }, [log])
  if (workspace.setupStatus === 'skipped') return null
  return (
    <details open={workspace.setupStatus !== 'done'} className="rounded-md border border-border">
      <summary className="cursor-pointer px-3 py-2 text-sm text-foreground/80">Setup · {workspace.setupStatus}</summary>
      <pre ref={ref} className="max-h-64 overflow-y-auto border-t border-border p-3 text-xs text-muted-foreground">
        {log || 'Waiting for output…'}
      </pre>
    </details>
  )
}

export function WorkspacePage({ id, chats }: { id: string; chats?: (ws: Workspace) => ReactNode }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => {
    api.getWorkspace(id).then(setWorkspace, (e: unknown) => setError(errorText(e)))
  }, [id])
  useEffect(load, [load])
  useAppEvents((e) => {
    if (e.type === 'workspace.setup' && e.workspaceId === id && e.done) load()
    if (e.type === 'workspace.status' && e.workspaceId === id) setWorkspace((w) => (w ? { ...w, status: e.status } : w))
  })

  if (error) return <div className="p-6"><Notice tone="error">{error}</Notice></div>
  if (!workspace) return null
  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-border px-6 py-3">
        <div className="flex items-center gap-2">
          <StatusDot status={workspace.status} />
          <h1 className="text-lg font-semibold text-foreground">{workspace.name}</h1>
          <span className="text-xs text-muted-foreground">{STATUS_LABEL[workspace.status]}</span>
        </div>
        <div className="mt-1 flex items-start justify-between gap-4">
          <div className="text-xs text-muted-foreground">
            {workspace.branch} ← {workspace.base} · {workspace.worktreePath}
          </div>
          <ArchiveButton workspace={workspace} />
        </div>
        <TaskDetails workspace={workspace} />
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="space-y-4">
          <SetupLog workspace={workspace} />
          {chats?.(workspace)}
        </div>
      </div>
    </div>
  )
}
