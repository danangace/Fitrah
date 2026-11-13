import { ExternalLink, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { type Connector, type ExternalPage, HELIX_STATUSES, type Iteration } from '../../../shared/connectors'
import { api } from '../../api/nakoda'
import { cn } from '../../lib/cn'
import { errorText } from '../../lib/errors'
import { statusLabel } from '../../lib/tasks-tabs'
import { useRouter } from '../../store/router'
import { toast } from '../../store/toast'
import { Button } from '../ui/Button'
import { Notice } from '../ui/Field'
import { Select } from '../ui/Select'

const ALL = 'all'

/** Read-only list of the tickets in an outside system (Helix). Transfer copies one to our board; nothing is written back. */
export function ExternalTasks() {
  const navigate = useRouter((s) => s.navigate)
  const [connectors, setConnectors] = useState<Connector[] | null>(null)
  const [connectorId, setConnectorId] = useState('')
  const [boards, setBoards] = useState<{ id: number; name: string }[]>([])
  const [iterations, setIterations] = useState<Iteration[]>([])
  const [boardId, setBoardId] = useState(ALL)
  const [iterationId, setIterationId] = useState(ALL)
  const [status, setStatus] = useState(ALL)
  const [scope, setScope] = useState<'mine' | 'everyone'>('mine')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<ExternalPage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [nonce, setNonce] = useState(0)
  // Tickets already copied to our board (matched by key), and the one being copied now.
  const [onBoard, setOnBoard] = useState<Set<string>>(new Set())
  const [copying, setCopying] = useState<string | null>(null)

  useEffect(() => {
    api.listConnectors().then(
      (list) => {
        setConnectors(list)
        setConnectorId((cur) => cur || list[0]?.id || '')
      },
      (e: unknown) => setError(errorText(e)),
    )
  }, [])

  useEffect(() => {
    api.listTasks().then((tasks) => setOnBoard(new Set(tasks.filter((t) => t.externalId).map((t) => t.externalId as string))), () => {})
  }, [])

  const transfer = async (key: string) => {
    setCopying(key)
    try {
      await api.transferTicket(connectorId, key)
      setOnBoard((cur) => new Set(cur).add(key))
      toast.success(`${key} is on your board`)
    } catch (e) {
      setError(errorText(e))
    } finally {
      setCopying(null)
    }
  }

  useEffect(() => {
    if (!connectorId) return
    api.connectorBoards(connectorId).then(setBoards, () => setBoards([]))
  }, [connectorId])

  // Iterations belong to a board, so they only appear once a board is chosen.
  useEffect(() => {
    setIterationId(ALL)
    setIterations([])
    if (!connectorId || boardId === ALL) return
    api.connectorIterations(connectorId, Number(boardId)).then(setIterations, () => setIterations([]))
  }, [connectorId, boardId])

  useEffect(() => {
    if (!connectorId) return
    let current = true
    setLoading(true)
    api
      .externalTickets(
        connectorId,
        { page, boardId: boardId === ALL ? undefined : Number(boardId), iterationId: iterationId === ALL ? undefined : Number(iterationId), mine: scope === 'mine', statuses: status === ALL ? undefined : [status] },
        nonce > 0,
      )
      .then(
        (d) => {
          if (!current) return
          setData(d)
          setError(null)
        },
        (e: unknown) => {
          if (!current) return
          setData(null)
          setError(errorText(e))
        },
      )
      .finally(() => current && setLoading(false))
    return () => {
      current = false
    }
  }, [connectorId, page, boardId, iterationId, scope, status, nonce])

  const filter = <T,>(set: (v: T) => void) => (v: T) => {
    set(v)
    setPage(1)
  }

  if (connectors && connectors.length === 0) {
    return (
      <div className="space-y-3 rounded-md border border-dashed border-border p-8 text-center">
        <p className="text-sm text-muted-foreground">No task source is connected yet.</p>
        <Button onClick={() => navigate({ name: 'settings', section: 'connectors' })}>Connect Helix</Button>
      </div>
    )
  }

  const lastPage = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {connectors && connectors.length > 1 && (
          <Select aria-label="Connection" className="w-44" value={connectorId} onValueChange={filter(setConnectorId)} options={connectors.map((c) => ({ value: c.id, label: c.label }))} />
        )}
        <Select aria-label="Whose tickets" className="w-40" value={scope} onValueChange={filter((v: string) => setScope(v === 'everyone' ? 'everyone' : 'mine'))} options={[{ value: 'mine', label: 'Assigned to me' }, { value: 'everyone', label: 'Everyone' }]} />
        <Select aria-label="Board" className="w-44" value={boardId} onValueChange={filter(setBoardId)} options={[{ value: ALL, label: 'All boards' }, ...boards.map((b) => ({ value: String(b.id), label: b.name }))]} />
        {boardId !== ALL && (
          <Select aria-label="Iteration" className="w-44" value={iterationId} onValueChange={filter(setIterationId)} options={[{ value: ALL, label: 'All iterations' }, ...iterations.map((i) => ({ value: String(i.id), label: i.name }))]} />
        )}
        <Select aria-label="Status" className="w-44" value={status} onValueChange={filter(setStatus)} options={[{ value: ALL, label: 'All statuses' }, ...HELIX_STATUSES.map((s) => ({ value: s, label: statusLabel(s) }))]} />
        <Button variant="ghost" aria-label="Refresh" title="Refresh" disabled={loading} onClick={() => setNonce((n) => n + 1)}>
          <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
        </Button>
        <span className="ml-auto text-xs text-muted-foreground">{data ? `${data.total} ticket${data.total === 1 ? '' : 's'}` : ''}</span>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {data && data.items.length === 0 && <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No tickets match.</div>}
      {data && data.items.length > 0 && (
        <ul className="divide-y divide-border rounded-md border border-border" data-testid="external-list">
          {data.items.map((t) => (
            <li key={t.key} className="flex items-center gap-3 px-3 py-2.5">
              <span className="w-20 shrink-0 font-mono text-xs text-muted-foreground">{t.key}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-foreground">{t.title}</span>
                <span className="block truncate text-xs text-muted-foreground">{[t.board, t.iteration, t.assignee].filter(Boolean).join(' · ')}</span>
              </span>
              <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium', t.kind === 'defect' ? 'bg-destructive/15 text-red-200' : 'bg-secondary text-foreground/70')}>{t.kind === 'defect' ? 'Defect' : 'Task'}</span>
              <span className="w-28 shrink-0 truncate text-xs text-foreground/70">{statusLabel(t.status)}</span>
              <span className="w-16 shrink-0 truncate text-xs text-muted-foreground">{t.priority ?? ''}</span>
              {onBoard.has(t.key) ? (
                <button type="button" onClick={() => navigate({ name: 'tasks', tab: 'board' })} className="w-24 shrink-0 text-left text-xs text-success hover:underline" title="Show on the board">
                  On board
                </button>
              ) : (
                <Button className="w-24" disabled={copying === t.key} onClick={() => void transfer(t.key)}>
                  {copying === t.key ? 'Copying…' : 'Transfer'}
                </Button>
              )}
              <a href={t.url} target="_blank" rel="noreferrer noopener" className="inline-flex shrink-0 items-center gap-1 text-xs text-foreground/70 hover:text-foreground">
                Open in source <ExternalLink className="size-3" />
              </a>
            </li>
          ))}
        </ul>
      )}
      {data && lastPage > 1 && (
        <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
          <Button disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <span>
            Page {data.page} of {lastPage}
          </span>
          <Button disabled={page >= lastPage || loading} onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
