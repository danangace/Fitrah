import { describe, expect, it } from 'vitest'
import { PLATFORMS, connectionState } from './connector-platforms'

describe('connector platforms', () => {
  it('lists Helix, Jira, ClickUp and Lark with only Helix available', () => {
    expect(PLATFORMS.map((p) => p.id)).toEqual(['helix', 'jira', 'clickup', 'lark'])
    expect(PLATFORMS.filter((p) => p.available).map((p) => p.id)).toEqual(['helix'])
  })

  it('shows connected only after a successful test', () => {
    expect(connectionState({ configured: false, lastCheckedAt: null })).toBe('unconfigured')
    expect(connectionState({ configured: true, lastCheckedAt: null })).toBe('untested')
    expect(connectionState({ configured: true, lastCheckedAt: '2026-11-14T00:00:00Z' })).toBe('connected')
    expect(connectionState({ configured: true, lastCheckedAt: '2026-11-14T00:00:00Z', testError: true })).toBe('failed')
  })
})
