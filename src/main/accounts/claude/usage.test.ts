import { describe, expect, it } from 'vitest'
import { windowsFromPlanLimits } from './usage'

describe('windowsFromPlanLimits', () => {
  it('converts percent and ISO reset to 0–1 and unix seconds, skipping empty rows', () => {
    const windows = windowsFromPlanLimits({
      five_hour: { utilization: 42, resets_at: '2026-11-13T15:00:00Z' },
      seven_day: { utilization: 100, resets_at: null },
      seven_day_opus: null,
      seven_day_sonnet: { utilization: null, resets_at: null },
      model_scoped: [{ display_name: 'Fable', utilization: 2, resets_at: '2026-11-16T16:00:00Z' }],
    })
    expect(windows).toEqual([
      { key: 'five_hour', utilization: 0.42, resetsAt: Date.parse('2026-11-13T15:00:00Z') / 1000, status: 'allowed' },
      { key: 'seven_day', utilization: 1, resetsAt: null, status: 'rejected' },
      { key: 'seven_day_fable', utilization: 0.02, resetsAt: Date.parse('2026-11-16T16:00:00Z') / 1000, status: 'allowed' },
    ])
  })
})
