import { RATE_LIMIT_PREFIX } from '../../shared/events'
import type { Account, UsageWindow } from '../../shared/schemas'

const LABELS: Record<string, { long: string; short: string; order: number }> = {
  five_hour: { long: 'Session', short: '5h', order: 0 },
  seven_day: { long: 'Weekly', short: 'wk', order: 1 },
  seven_day_opus: { long: 'Opus weekly', short: 'opus', order: 2 },
  seven_day_sonnet: { long: 'Sonnet weekly', short: 'sonnet', order: 3 },
}

export function windowLabel(key: string): { long: string; short: string } {
  const known = LABELS[key]
  return known ? { long: known.long, short: known.short } : { long: key.replaceAll('_', ' '), short: key }
}

export function sortWindows(windows: UsageWindow[]): UsageWindow[] {
  return windows.toSorted((a, b) => (LABELS[a.key]?.order ?? 9) - (LABELS[b.key]?.order ?? 9))
}

/**
 * Nakoda only learns usage from what Claude reports with a message, so a snapshot can outlive its
 * window. Once a window's reset time has passed it is back to 0% (the next reset is unknown until
 * the next message), instead of showing the old number.
 */
export function liveWindows(windows: UsageWindow[], nowMs = Date.now()): UsageWindow[] {
  return sortWindows(
    windows.map((w) =>
      w.resetsAt !== null && w.resetsAt * 1000 <= nowMs ? { ...w, utilization: 0, resetsAt: null, status: 'allowed' } : w,
    ),
  )
}

export const percent = (w: UsageWindow) => Math.round(w.utilization * 100)

/** Time until a reset, like the statusline: "56m", "2h 10m", "3d 21h". */
export function formatReset(resetsAt: number | null, nowMs = Date.now()): string {
  if (!resetsAt) return ''
  const mins = Math.max(0, Math.round((resetsAt * 1000 - nowMs) / 60_000))
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ${mins % 60}m`
  return `${Math.floor(hours / 24)}d ${hours % 24}h`
}

export function timeAgo(iso: string, nowMs = Date.now()): string {
  const mins = Math.floor((nowMs - Date.parse(iso)) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`
}

/** Bar color: calm until 60%, warning until 85%, then red. */
export function usageTone(w: UsageWindow): 'ok' | 'warn' | 'high' {
  if (w.status === 'rejected' || w.utilization >= 0.85) return 'high'
  return w.utilization >= 0.6 ? 'warn' : 'ok'
}

/**
 * A rate-limit warning is only cleared by a successful turn, so it can outlive the limit. It is
 * stale when the last snapshot recorded a rejected window and that window has since reset.
 * Without such a window we cannot tell, so the warning stays.
 */
export function isWarningStale(account: Pick<Account, 'warning' | 'usage'>, nowMs = Date.now()): boolean {
  if (!account.warning?.startsWith(RATE_LIMIT_PREFIX) || !account.usage) return false
  const rejected = account.usage.windows.filter((w) => w.status === 'rejected')
  if (rejected.length === 0) return false
  return rejected.every((w) => w.resetsAt !== null && w.resetsAt * 1000 <= nowMs)
}
