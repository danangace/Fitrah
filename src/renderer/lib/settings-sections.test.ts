import { describe, expect, it } from 'vitest'
import { parseRoute } from './route'
import { SETTINGS_SECTIONS, resolveSettingsSection } from './settings-sections'

describe('settings sections', () => {
  it('has unique ids and Connectors last', () => {
    const ids = SETTINGS_SECTIONS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.at(-1)).toBe('connectors')
  })

  it('resolves an id and falls back to General for unknown ones', () => {
    expect(resolveSettingsSection('models')).toBe('models')
    expect(resolveSettingsSection('connectors')).toBe('connectors')
    expect(resolveSettingsSection('repos')).toBe('general')
    expect(resolveSettingsSection('')).toBe('general')
  })

  it('every section is reachable by URL', () => {
    for (const s of SETTINGS_SECTIONS) {
      expect(parseRoute(`/settings/${s.id}`)).toEqual({ name: 'settings', section: s.id })
    }
  })
})
