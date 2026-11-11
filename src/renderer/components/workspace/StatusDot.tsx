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
  idle: 'bg-neutral-600',
  working: 'bg-sky-400 animate-pulse',
  needs_approval: 'bg-amber-400',
  waiting: 'bg-neutral-300',
  done: 'bg-emerald-400',
  error: 'bg-red-500',
}

export function StatusDot({ status }: { status: WorkspaceStatus }) {
  return <span title={STATUS_LABEL[status]} className={cn('inline-block size-2 shrink-0 rounded-full', COLOR[status])} />
}
