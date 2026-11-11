import type { WorkspaceStatus } from '../../shared/schemas'

/** Which status changes deserve a browser notification (only while the tab is hidden, AC-N2). */
export function notificationFor(status: WorkspaceStatus, hidden: boolean): string | null {
  if (!hidden) return null
  if (status === 'needs_approval') return 'Claude needs your approval'
  if (status === 'done') return 'Claude is done'
  if (status === 'error') return 'Claude stopped with an error'
  return null
}
