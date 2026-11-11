import { PanelRight } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import type { Workflow, Workspace } from '../../shared/schemas'
import { api } from '../api/fitrah'
import { ArchiveButton } from '../components/workspace/ArchiveButton'
import { STATUS_LABEL, StatusDot } from '../components/workspace/StatusDot'
import { Notice } from '../components/ui/Field'
import { cn } from '../lib/cn'
import { errorText } from '../lib/errors'
import { readPref, writePref } from '../lib/local-pref'
import { useAppEvents } from '../store/events'

function TaskLink({ label, value }: { label: string; value: string }) {
  if (!value) return <span className="text-muted-foreground/50">—</span>
  return /^https?:\/\//.test(value) ? (
    <a href={value} target="_blank" rel="noreferrer" title={value} className="text-foreground underline decoration-foreground/30 underline-offset-2 hover:decoration-foreground">
      {label} ↗
    </a>
  ) : (
    <span className="text-foreground/90" title={value}>
      {value}
    </span>
  )
}

function useWorkflow(workflowId: string | null) {
  const [workflow, setWorkflow] = useState<Workflow | null>(null)
  useEffect(() => {
    if (!workflowId) return setWorkflow(null)
    api.listWorkflows().then((list) => setWorkflow(list.find((w) => w.id === workflowId) ?? null), () => setWorkflow(null))
  }, [workflowId])
  return workflow
}

function WorkflowChip({ workflowId }: { workflowId: string }) {
  const workflow = useWorkflow(workflowId)
  return <span className="rounded bg-info/10 px-1.5 py-0.5 text-[11px] font-medium text-info">{workflow?.name ?? 'Workflow'}</span>
}

/** The workflow values Claude receives in every chat of this workspace (workspace context). */
function TaskDetails({ workspace }: { workspace: Workspace }) {
  const workflow = useWorkflow(workspace.workflowId)
  if (!workspace.workflowId) return <div className="text-[13px] text-foreground/80">Free chat</div>
  return (
    <dl className="space-y-1.5 text-[12px]" title="Claude gets these in every chat of this workspace">
      <div className="mb-1 text-[13px] font-medium text-info">{workflow?.name ?? 'Workflow'}</div>
      {(workflow?.fields ?? []).map((f) => (
        <div key={f.key} className="grid grid-cols-[88px_1fr] gap-2">
          <dt className="truncate text-muted-foreground">{f.label}</dt>
          <dd className="min-w-0 truncate">
            <TaskLink label={f.label} value={workspace.values[f.key] ?? ''} />
          </dd>
        </div>
      ))}
    </dl>
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
    <details open={workspace.setupStatus !== 'done'} className="rounded-md border border-border bg-background/40">
      <summary className="cursor-pointer px-2.5 py-1.5 text-[12px] text-foreground/80">{workspace.setupStatus}</summary>
      <pre ref={ref} className="max-h-56 overflow-y-auto border-t border-border p-2.5 text-[11px] whitespace-pre-wrap text-muted-foreground">
        {log || 'Waiting for output…'}
      </pre>
    </details>
  )
}

function DetailsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2 border-b border-border px-4 py-3">
      <h3 className="text-xs font-semibold text-muted-foreground/80">{title}</h3>
      {children}
    </section>
  )
}

function CopyLine({ value }: { value: string }) {
  return (
    <button
      type="button"
      title="Copy"
      onClick={() => void navigator.clipboard.writeText(value)}
      className="block w-full truncate rounded bg-secondary/60 px-2 py-1 text-left font-mono text-[11px] text-foreground/80 hover:bg-secondary"
    >
      {value}
    </button>
  )
}

/** Right panel (Orca's right sidebar): task values, branch + folder, setup log, archive. */
function DetailsPanel({ workspace }: { workspace: Workspace }) {
  return (
    <aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-l border-border bg-sidebar">
      <DetailsSection title={workspace.workflowId ? 'Task' : 'Type'}>
        <TaskDetails workspace={workspace} />
      </DetailsSection>
      <DetailsSection title="Branch">
        <CopyLine value={workspace.branch} />
        <div className="text-[11px] text-muted-foreground">from {workspace.base}</div>
      </DetailsSection>
      <DetailsSection title="Folder">
        <CopyLine value={workspace.worktreePath} />
      </DetailsSection>
      {workspace.setupStatus !== 'skipped' && (
        <DetailsSection title="Setup">
          <SetupLog workspace={workspace} />
        </DetailsSection>
      )}
      <DetailsSection title="Workspace">
        <ArchiveButton workspace={workspace} />
      </DetailsSection>
    </aside>
  )
}

export function WorkspacePage({ id, chats }: { id: string; chats?: (ws: Workspace) => ReactNode }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [details, setDetails] = useState(() => readPref('details-open', true))
  const load = useCallback(() => {
    api.getWorkspace(id).then(setWorkspace, (e: unknown) => setError(errorText(e)))
  }, [id])
  useEffect(load, [load])
  useAppEvents((e) => {
    if (e.type === 'workspace.setup' && e.workspaceId === id && e.done) load()
    if (e.type === 'workspace.status' && e.workspaceId === id) setWorkspace((w) => (w ? { ...w, status: e.status } : w))
  })
  const toggleDetails = () => {
    setDetails(!details)
    writePref('details-open', !details)
  }

  if (error) return <div className="p-6"><Notice tone="error">{error}</Notice></div>
  if (!workspace) return null
  return (
    <div className="flex h-full flex-col">
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-4">
        <StatusDot status={workspace.status} />
        <h1 className="truncate text-[13px] font-semibold text-foreground">{workspace.name}</h1>
        <span className="truncate font-mono text-[11px] text-muted-foreground/70">{workspace.branch}</span>
        {workspace.workflowId && <WorkflowChip workflowId={workspace.workflowId} />}
        <span className="text-[11px] text-muted-foreground">{STATUS_LABEL[workspace.status]}</span>
        <button
          type="button"
          aria-label={details ? 'Hide details' : 'Show details'}
          title={details ? 'Hide details' : 'Show details'}
          onClick={toggleDetails}
          className={cn('ml-auto flex size-7 items-center justify-center rounded-md hover:bg-secondary', details ? 'text-foreground' : 'text-muted-foreground')}
        >
          <PanelRight className="size-4" />
        </button>
      </header>
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">{chats?.(workspace)}</div>
        {details && <DetailsPanel workspace={workspace} />}
      </div>
    </div>
  )
}
