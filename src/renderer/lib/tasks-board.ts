import { BOARD_COLUMNS, type BoardColumn, type Task } from '../../shared/tasks'

/** Tickets per column, in the order the server sent them (column, then position). */
export function groupByColumn(tasks: readonly Task[]): Record<BoardColumn, Task[]> {
  const out = Object.fromEntries(BOARD_COLUMNS.map((c) => [c, [] as Task[]])) as Record<BoardColumn, Task[]>
  for (const t of tasks) out[t.column].push(t)
  return out
}

/** The ticket that keeps a workspace busy: another one there that is not yet in Review or Done. */
export function activeTaskIn(tasks: readonly Task[], workspaceId: string, exceptId?: string): Task | undefined {
  return tasks.find((t) => t.workspaceId === workspaceId && t.id !== exceptId && t.column !== 'review' && t.column !== 'done')
}

/** New Planning tickets start with the Planning workflow when it exists. */
export function defaultWorkflowId(workflows: readonly { id: string }[]): string | null {
  return workflows.find((w) => w.id === 'planning')?.id ?? null
}
