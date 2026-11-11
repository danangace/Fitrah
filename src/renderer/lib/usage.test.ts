import { describe, expect, it } from 'vitest'
import { formatReset, liveWindows, percent, sortWindows, timeAgo, usageTone, windowLabel } from './usage'

const secs = (iso: string) => Date.parse(iso) / 1000
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

  it('treats a window as 0% once its reset time has passed', () => {
    const now = Date.parse('2026-11-11T22:43:00Z')
    const session = { key: 'five_hour', utilization: 0.9, resetsAt: secs('2026-11-11T18:40:00Z'), status: 'rejected' }
    const weekly = { key: 'seven_day', utilization: 0.46, resetsAt: secs('2026-11-16T16:00:00Z'), status: 'allowed' }
    const [five, week] = liveWindows([weekly, session], now)
    expect(five).toMatchObject({ key: 'five_hour', utilization: 0, resetsAt: null, status: 'allowed' })
    expect(week).toEqual(weekly)
  })

  it('says how old the numbers are', () => {
    const now = Date.parse('2026-11-11T12:00:00Z')
    expect(timeAgo('2026-11-11T11:56:00Z', now)).toBe('4m ago')
    expect(timeAgo('2026-11-11T11:59:50Z', now)).toBe('just now')
  })
})
