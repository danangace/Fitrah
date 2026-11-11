import { describe, expect, it } from 'vitest'
import { formatReset, percent, sortWindows, timeAgo, usageTone, windowLabel } from './usage'

const w = (key: string, utilization: number) => ({ key, utilization, resetsAt: null, status: 'allowed' })

describe('usage helpers', () => {
  it('formats resets like the statusline', () => {
    const now = 1_000_000_000_000
    const at = (mins: number) => (now + mins * 60_000) / 1000
    expect(formatReset(at(56), now)).toBe('56m')
    expect(formatReset(at(130), now)).toBe('2h 10m')
    expect(formatReset(at(3 * 1440 + 21 * 60), now)).toBe('3d 21h')
    expect(formatReset(at(-5), now)).toBe('now')
    expect(formatReset(null, now)).toBe('')
  })

  it('labels, sorts, rounds and colors windows', () => {
    expect(windowLabel('five_hour')).toEqual({ long: 'Session', short: '5h' })
    expect(sortWindows([w('seven_day', 0.4), w('five_hour', 0.8)]).map((x) => x.key)).toEqual(['five_hour', 'seven_day'])
    expect(percent(w('five_hour', 0.826))).toBe(83)
    expect([usageTone(w('a', 0.3)), usageTone(w('a', 0.7)), usageTone(w('a', 0.9))]).toEqual(['ok', 'warn', 'high'])
  })

  it('says how old the numbers are', () => {
    const now = Date.parse('2026-11-11T12:00:00Z')
    expect(timeAgo('2026-11-11T11:56:00Z', now)).toBe('4m ago')
    expect(timeAgo('2026-11-11T11:59:50Z', now)).toBe('just now')
  })
})
