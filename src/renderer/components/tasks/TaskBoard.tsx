import { ExternalLink, Plus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { Workflow } from '../../../shared/schemas'
import { checkReady } from '../../../shared/readiness'
import { BOARD_COLUMNS, COLUMN_LABELS, type BoardColumn, type Task } from '../../../shared/tasks'
import { api } from '../../api/nakoda'
import { cn } from '../../lib/cn'
import { errorText } from '../../lib/errors'
import { groupByColumn } from '../../lib/tasks-board'
import { useRouter } from '../../store/router'
import { useWorkspaces } from '../../store/workspaces'
import { Button } from '../ui/Button'
import { Notice } from '../ui/Field'
import { StatusDot } from '../workspace/StatusDot'
import { AssignModal } from './AssignModal'
import { TaskModal } from './TaskModal'

type Dialog = { kind: 'edit'; task?: Task } | { kind: 'assign'; task: Task } | null

function Card({ task, workflows, onOpen }: { task: Task; workflows: Workflow[]; onOpen: () => void }) {
  const navigate = useRouter((s) => s.navigate)
  const workspace = useWorkspaces((s) => s.workspaces.find((w) => w.id === task.workspaceId))
  const missing = checkReady(task, workflows.find((w) => w.id === task.workflowId)?.fields)
  // Ready / Missing only matters while the ticket still waits for a workspace.
  const showReadiness = task.column === 'backlog' && !task.workspaceId
  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      data-testid="task-card"
      onDragStart={(e) => e.dataTransfer.setData('text/plain', task.id)}
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
      className="cursor-pointer space-y-1.5 rounded-md border border-border bg-card p-3 text-left hover:border-ring/60"
    >
      <div className="text-sm text-foreground">{task.title}</div>
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        {task.kind === 'defect' && <span className="rounded bg-destructive/15 px-1.5 py-0.5 font-medium text-red-200">Defect</span>}
        {task.priority && <span className="rounded bg-secondary px-1.5 py-0.5 text-foreground/70">{task.priority}</span>}
        {task.source !== 'manual' && <span className="rounded bg-secondary px-1.5 py-0.5 text-foreground/70">{task.externalId ?? task.source}</span>}
        {showReadiness &&
          (missing.length === 0 ? (
            <span className="rounded bg-success/15 px-1.5 py-0.5 font-medium text-success">Ready</span>
          ) : (
            <span className="rounded bg-warning/15 px-1.5 py-0.5 font-medium text-warning">Missing: {missing.join(', ')}</span>
          ))}
      </div>
      {(workspace || task.externalUrl) && (
        <div className="flex items-center justify-between gap-2 text-xs">
          {workspace ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                navigate({ name: 'workspace', id: workspace.id })
              }}
              className="flex min-w-0 items-center gap-1.5 text-foreground/70 hover:text-foreground"
            >
              <StatusDot status={workspace.status} />
              <span className="truncate">{workspace.name}</span>
            </button>
          ) : (
            <span />
          )}
          {task.externalUrl && (
            <a href={task.externalUrl} target="_blank" rel="noreferrer noopener" onClick={(e) => e.stopPropagation()} className="inline-flex shrink-0 items-center gap-1 text-foreground/60 hover:text-foreground">
              Open in source <ExternalLink className="size-3" />
            </a>
          )}
        </div>
      )}
    </div>
  )
}

/** Our own kanban: four columns, drag a card to change its column. Status is ours; nothing is written back to a source. */
export function TaskBoard() {
  const load = useWorkspaces((s) => s.load)
  const [tasks, setTasks] = useState<Task[]>([])
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [over, setOver] = useState<BoardColumn | null>(null)

  const refresh = useCallback(() => api.listTasks().then(setTasks, (e: unknown) => setError(errorText(e))), [])
  useEffect(() => {
    void load()
    void refresh()
    api.listWorkflows().then(setWorkflows, () => setWorkflows([]))
  }, [load, refresh])

  const drop = async (column: BoardColumn, id: string) => {
    setOver(null)
    const task = tasks.find((t) => t.id === id)
    if (!task || task.column === column) return
    setTasks((cur) => cur.map((t) => (t.id === id ? { ...t, column } : t)))
    try {
      await api.moveTask(id, column)
      setError(null)
    } catch (e) {
      setError(errorText(e))
    }
    void refresh()
  }

  const groups = groupByColumn(tasks)
  const current = dialog && dialog.kind === 'edit' && dialog.task ? (tasks.find((t) => t.id === dialog.task?.id) ?? dialog.task) : undefined
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="primary" onClick={() => setDialog({ kind: 'edit' })}>
          <Plus className="size-4" /> New ticket
        </Button>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="grid grid-cols-4 gap-3">
        {BOARD_COLUMNS.map((column) => (
          <section
            key={column}
            aria-label={COLUMN_LABELS[column]}
            data-testid={`column-${column}`}
            onDragOver={(e) => {
              e.preventDefault()
              setOver(column)
            }}
            onDragLeave={() => setOver((c) => (c === column ? null : c))}
            onDrop={(e) => {
              e.preventDefault()
              void drop(column, e.dataTransfer.getData('text/plain'))
            }}
            className={cn('min-h-48 space-y-2 rounded-lg border border-border bg-secondary/30 p-2', over === column && 'border-ring bg-secondary/60')}
          >
            <header className="flex items-center justify-between px-1 text-xs font-semibold text-muted-foreground">
              <span>{COLUMN_LABELS[column]}</span>
              <span>{groups[column].length}</span>
            </header>
            {groups[column].map((t) => (
              <Card key={t.id} task={t} workflows={workflows} onOpen={() => setDialog({ kind: 'edit', task: t })} />
            ))}
          </section>
        ))}
      </div>
      {dialog?.kind === 'edit' && (
        <TaskModal
          key={current?.id ?? 'new'}
          task={current}
          workflows={workflows}
          onClose={() => setDialog(null)}
          onChanged={() => void refresh()}
          onAssign={(t) => setDialog({ kind: 'assign', task: t })}
        />
      )}
      {dialog?.kind === 'assign' && (
        <AssignModal
          task={tasks.find((t) => t.id === dialog.task.id) ?? dialog.task}
          tasks={tasks}
          workflows={workflows}
          onClose={() => setDialog(null)}
          onChanged={() => {
            void refresh()
            void load()
          }}
        />
      )}
    </div>
  )
}
