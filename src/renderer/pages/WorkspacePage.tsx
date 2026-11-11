import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import type { Workspace } from '../../shared/schemas'
import { api } from '../api/fitrah'
import { ArchiveButton } from '../components/workspace/ArchiveButton'
import { STATUS_LABEL, StatusDot } from '../components/workspace/StatusDot'
import { Notice } from '../components/ui/Field'
import { errorText } from '../lib/errors'
import { useAppEvents } from '../store/events'

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
    <details open={workspace.setupStatus !== 'done'} className="rounded-md border border-neutral-800">
      <summary className="cursor-pointer px-3 py-2 text-sm text-neutral-300">Setup · {workspace.setupStatus}</summary>
      <pre ref={ref} className="max-h-64 overflow-y-auto border-t border-neutral-800 p-3 text-xs text-neutral-400">
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
      <header className="border-b border-neutral-800 px-6 py-3">
        <div className="flex items-center gap-2">
          <StatusDot status={workspace.status} />
          <h1 className="text-lg font-semibold text-white">{workspace.name}</h1>
          <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-xs text-neutral-300">{workspace.kind}</span>
          <span className="text-xs text-neutral-500">{STATUS_LABEL[workspace.status]}</span>
        </div>
        <div className="mt-1 flex items-start justify-between gap-4">
          <div className="text-xs text-neutral-500">
            {workspace.branch} ← {workspace.base} · {workspace.worktreePath}
          </div>
          <ArchiveButton workspace={workspace} />
        </div>
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
