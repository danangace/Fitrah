import type { UsageWindow } from '../../../shared/schemas'
import { withIdleSession } from '../../native-chat/claude/idle-session'

type Row = { utilization: number | null; resets_at: string | null } | null | undefined
export type PlanLimits = Partial<Record<'five_hour' | 'seven_day' | 'seven_day_opus' | 'seven_day_sonnet', Row>> & {
  /** Weekly limits of one model, e.g. Fable. */
  model_scoped?: { display_name: string; utilization: number | null; resets_at: string | null }[]
}

/** Claude reports 0–100 and an ISO reset time; Nakoda stores 0–1 and unix seconds. */
export function windowsFromPlanLimits(limits: PlanLimits): UsageWindow[] {
  const rows: [string, Row][] = [
    ...(['five_hour', 'seven_day', 'seven_day_opus', 'seven_day_sonnet'] as const).map((key): [string, Row] => [key, limits[key]]),
    // Keyed `seven_day_<model>`; the UI labels it "<Model> weekly".
    ...(limits.model_scoped ?? []).map((m): [string, Row] => [`seven_day_${m.display_name.toLowerCase().replaceAll(/\W+/g, '_')}`, m]),
  ]
  const windows: UsageWindow[] = []
  for (const [key, row] of rows) {
    if (!row || row.utilization === null) continue
    const utilization = row.utilization / 100
    const reset = row.resets_at ? Date.parse(row.resets_at) : Number.NaN
    windows.push({ key, utilization, resetsAt: Number.isNaN(reset) ? null : Math.floor(reset / 1000), status: utilization >= 1 ? 'rejected' : 'allowed' })
  }
  return windows
}

/**
 * The plan's real limits right now (what `/usage` shows), without sending a message. Null when the
 * login has no plan limits (API key etc.) or Claude could not be asked.
 */
export async function fetchClaudeUsage(configDir: string): Promise<UsageWindow[] | null> {
  // EXPERIMENTAL in the SDK: it may change or disappear in a release.
  const report = await withIdleSession(configDir, (s) => s.usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET({ skipBehaviors: true }))
  if (!report.rate_limits_available || !report.rate_limits) return null
  return windowsFromPlanLimits(report.rate_limits)
}
