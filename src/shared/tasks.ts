import { z } from 'zod/v4'

/** Four columns. "Ready" is a badge on a Backlog card, not a column. */
export const BOARD_COLUMNS = ['backlog', 'in_progress', 'review', 'done'] as const
export const BoardColumn = z.enum(BOARD_COLUMNS)
export type BoardColumn = z.infer<typeof BoardColumn>

export const COLUMN_LABELS: Record<BoardColumn, string> = {
  backlog: 'Backlog',
  in_progress: 'In progress',
  review: 'Review',
  done: 'Done',
}

export const TaskKind = z.enum(['task', 'defect'])

export const TaskInput = z.object({
  title: z.string().trim().min(1, 'Give the ticket a title'),
  description: z.string().default(''),
  kind: TaskKind.default('task'),
  priority: z.string().trim().default(''),
  /** The project (repo) the work happens in. */
  repoId: z.string().nullable().default(null),
  /** The workflow it will run with; its required fields become part of readiness. */
  workflowId: z.string().nullable().default(null),
  values: z.record(z.string(), z.string()).default({}),
})
export type TaskInput = z.input<typeof TaskInput>

export const TaskUpdate = TaskInput.partial().extend({ column: BoardColumn.optional() })
export type TaskUpdate = z.input<typeof TaskUpdate>

export const Task = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  kind: TaskKind,
  column: BoardColumn,
  position: z.number(),
  priority: z.string(),
  repoId: z.string().nullable(),
  workflowId: z.string().nullable(),
  values: z.record(z.string(), z.string()),
  /** `manual`, or the system it was copied from (`helix`). */
  source: z.string(),
  externalId: z.string().nullable(),
  /** Copied from the source; "Open in source". */
  externalUrl: z.string().nullable(),
  workspaceId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type Task = z.infer<typeof Task>
