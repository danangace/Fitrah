import type { WorkspaceStatus } from '../../../shared/schemas'
import { cn } from '../../lib/cn'

export const STATUS_LABEL: Record<WorkspaceStatus, string> = {
  idle: 'idle',
  working: 'working',
  needs_approval: 'needs approval',
  waiting: 'waiting',
  done: 'done',
  error: 'error',
}

const COLOR: Record<WorkspaceStatus, string> = {
  idle: 'bg-muted-foreground/50',
  working: 'bg-info animate-pulse',
  needs_approval: 'bg-warning',
  waiting: 'bg-foreground/70',
  done: 'bg-success',
  error: 'bg-destructive',
}

export function StatusDot({ status }: { status: WorkspaceStatus }) {
  return <span title={STATUS_LABEL[status]} className={cn('inline-block size-2 shrink-0 rounded-full', COLOR[status])} />
}
