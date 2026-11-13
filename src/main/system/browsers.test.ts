import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { listChromeProfiles, openCommand } from './browsers'

describe('browsers', () => {
  it('lists Chrome profiles from Local State', () => {
    const home = mkdtempSync(join(tmpdir(), 'nakoda-home-'))
    const dir = join(home, 'Library', 'Application Support', 'Google', 'Chrome')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'Local State'), JSON.stringify({ profile: { info_cache: { Default: { name: 'Work' }, 'Profile 1': { name: 'Me' } } } }))
    expect(listChromeProfiles(home)).toEqual([
      { dir: 'Default', name: 'Work' },
      { dir: 'Profile 1', name: 'Me' },
    ])
    expect(listChromeProfiles(mkdtempSync(join(tmpdir(), 'nakoda-empty-')))).toEqual([])
  })

  it('opens a chosen Chrome profile on macOS, else the default browser', () => {
    expect(openCommand('http://x', { kind: 'chrome', profile: 'Default' }, 'darwin')).toEqual([
      'open',
      ['-na', 'Google Chrome', '--args', '--profile-directory=Default', 'http://x'],
    ])
    expect(openCommand('http://x', { kind: 'default' }, 'darwin')).toEqual(['open', ['http://x']])
    expect(openCommand('http://x', { kind: 'chrome', profile: 'Default' }, 'linux')).toEqual(['xdg-open', ['http://x']])
  })
})
