import { Check, Copy, FileText, PanelRight, Pencil } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { resolveDocPath } from '../../shared/doc-paths'
import type { Settings, Workflow, Workspace } from '../../shared/schemas'
import { useRouter } from '../store/router'
import { api } from '../api/nakoda'
import { ArchiveButton } from '../components/workspace/ArchiveButton'
import { EditWorkspaceModal } from '../components/workspace/EditWorkspaceModal'
import { STATUS_LABEL, StatusDot } from '../components/workspace/StatusDot'
import { Collapsible } from '../components/ui/Collapsible'
import { Notice } from '../components/ui/Field'
import { cn } from '../lib/cn'
import { errorText } from '../lib/errors'
import { readPref, writePref } from '../lib/local-pref'
import { useAppEvents } from '../store/events'

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1200)
    return () => clearTimeout(t)
  }, [copied])
  return (
    <button
      type="button"
      aria-label={`Copy ${label}`}
      title={copied ? 'Copied' : 'Copy'}
      onClick={() => void navigator.clipboard.writeText(value).then(() => setCopied(true))}
      className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground"
    >
      {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
    </button>
  )
}

/**
 * One topic per row: the name on top, the full value below (wrapped, never cut off) and a copy button,
 * so a long PRD / Figma link or doc path can be read and copied whole.
 */
function DetailRow({ label, value, copy, open, note }: { label: string; value: string; copy?: string; open?: ReactNode; note?: ReactNode }) {
  const isUrl = /^https?:\/\//.test(value)
  return (
    <div className="rounded-md border border-border/60 bg-background/40 px-2.5 py-1.5">
      <div className="flex items-center gap-1">
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{label}</span>
        {open}
        {value && <CopyButton value={copy ?? value} label={label} />}
      </div>
      {!value ? (
        <div className="text-[13px] text-muted-foreground/50">—</div>
      ) : isUrl ? (
        <a
          href={value}
          target="_blank"
          rel="noreferrer"
          className="block font-mono text-xs break-all text-foreground underline decoration-foreground/30 underline-offset-2 hover:decoration-foreground"
        >
          {value}
        </a>
      ) : (
        <div className="font-mono text-xs break-all text-foreground/90">{value}</div>
      )}
      {note && <div className="mt-0.5 text-xs text-warning">{note}</div>}
    </div>
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
  return <span className="rounded bg-info/10 px-1.5 py-0.5 text-xs font-medium text-info">{workflow?.name ?? 'Workflow'}</span>
}

/** The workflow values Claude receives in every chat of this workspace (workspace context). */
function TaskDetails({ workspace }: { workspace: Workspace }) {
  const workflow = useWorkflow(workspace.workflowId)
  if (!workspace.workflowId) return <div className="text-sm text-foreground/80">Free chat</div>
  return (
    <div className="space-y-1.5" title="Claude gets these in every chat of this workspace">
      <div className="mb-1 text-sm font-medium text-info">{workflow?.name ?? 'Workflow'}</div>
      {(workflow?.fields ?? []).map((f) => (
        <DetailRow key={f.key} label={f.label} value={workspace.values[f.key] ?? ''} />
      ))}
    </div>
  )
}

/** Your doc paths (Settings → General) filled for this workspace: the same list Claude is told. */
function DocLocations({ workspace, onEdit }: { workspace: Workspace; onEdit: () => void }) {
  const workflow = useWorkflow(workspace.workflowId)
  const navigate = useRouter((s) => s.navigate)
  const [settings, setSettings] = useState<Settings | null>(null)
  useEffect(() => {
    api.getSettings().then(setSettings, () => setSettings(null))
  }, [])
  if (!settings) return null
  if (!settings.docsRoot) return <div className="text-xs text-muted-foreground">Set a docs root in Settings → General to see doc paths.</div>
  if (settings.docPaths.length === 0) return <div className="text-xs text-muted-foreground">No doc paths yet. Add them in Settings → General.</div>
  const root = settings.docsRoot.replace(/\/+$/, '')
  return (
    <div className="space-y-1.5">
      {settings.docPaths.map((p) => {
        const r = resolveDocPath(p, workspace, workflow)
        const full = `${root}/${r.path}`
        const canOpen = r.missing.length === 0 && r.path.endsWith('.md')
        return (
          <DetailRow
            key={p.label}
            label={p.label}
            value={r.path}
            copy={full}
            note={
              r.missing.length ? (
                <>
                  Not set: {r.missing.map((m) => `{${m}}`).join(', ')} ·{' '}
                  <button type="button" onClick={onEdit} className="underline underline-offset-2 hover:text-foreground">
                    Fill in
                  </button>
                </>
              ) : undefined
            }
            open={
              canOpen ? (
                <button
                  type="button"
                  aria-label={`Open ${p.label} in Docs`}
                  title="Open in Docs"
                  onClick={() => navigate({ name: 'docs', path: r.path })}
                  className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <FileText className="size-3.5" />
                </button>
              ) : undefined
            }
          />
        )
      })}
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
    <Collapsible defaultOpen={workspace.setupStatus !== 'done'} title={workspace.setupStatus} className="bg-background/40">
      <pre ref={ref} className="max-h-56 overflow-y-auto p-2.5 text-xs whitespace-pre-wrap text-muted-foreground">
        {log || 'Waiting for output…'}
      </pre>
    </Collapsible>
  )
}

function DetailsSection({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-2 border-b border-border px-4 py-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-muted-foreground/80">{title}</h3>
        {action}
      </div>
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
      className="block w-full rounded bg-secondary/60 px-2 py-1 text-left font-mono text-xs break-all text-foreground/80 hover:bg-secondary"
    >
      {value}
    </button>
  )
}

/** Right panel (Orca's right sidebar): task values, branch + folder, setup log, archive. */
function DetailsPanel({ workspace, onEdit }: { workspace: Workspace; onEdit: () => void }) {
  return (
    <aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-l border-border bg-sidebar">
      <DetailsSection
        title={workspace.workflowId ? 'Task' : 'Type'}
        action={
          !workspace.archivedAt && (
            <button
              type="button"
              aria-label="Edit workspace"
              title="Edit type and values"
              onClick={onEdit}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <Pencil className="size-3" /> Edit
            </button>
          )
        }
      >
        <TaskDetails workspace={workspace} />
      </DetailsSection>
      <DetailsSection title="Docs">
        <DocLocations workspace={workspace} onEdit={onEdit} />
      </DetailsSection>
      <DetailsSection title="Branch">
        <CopyLine value={workspace.branch} />
        <div className="text-xs text-muted-foreground">from {workspace.base}</div>
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
  const [editing, setEditing] = useState(false)
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
      {editing && <EditWorkspaceModal workspace={workspace} onClose={() => setEditing(false)} onSaved={setWorkspace} />}
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-4">
        <StatusDot status={workspace.status} />
        <h1 className="truncate text-sm font-semibold text-foreground">{workspace.name}</h1>
        <span className="truncate font-mono text-xs text-muted-foreground/70">{workspace.branch}</span>
        {workspace.workflowId && <WorkflowChip workflowId={workspace.workflowId} />}
        <span className="text-xs text-muted-foreground">{STATUS_LABEL[workspace.status]}</span>
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
        {details && <DetailsPanel workspace={workspace} onEdit={() => setEditing(true)} />}
      </div>
    </div>
  )
}
