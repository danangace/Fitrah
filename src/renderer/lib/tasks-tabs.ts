/** Tabs of the Tasks page: our own board, and the tickets waiting in outside systems. */
export const TASK_TABS = [
  { id: 'board', label: 'Our board' },
  { id: 'external', label: 'External' },
] as const

export type TaskTabId = (typeof TASK_TABS)[number]['id']

/** Unknown tab ids (old links) fall back to the board. */
export function resolveTaskTab(id: string): TaskTabId {
  return TASK_TABS.find((t) => t.id === id)?.id ?? TASK_TABS[0].id
}

/** "ready_to_test" → "Ready to test". */
export function statusLabel(status: string): string {
  const text = status.replaceAll('_', ' ').trim()
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '—'
}
