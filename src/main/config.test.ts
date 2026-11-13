import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { databaseFile, envSetting, nakodaHome, runtimePort } from './config'

const home = () => mkdtempSync(join(tmpdir(), 'nakoda-home-'))

describe('config after the rename (Fitrah → Nakoda)', () => {
  it('uses ~/.nakoda on a fresh machine', () => {
    const h = home()
    expect(nakodaHome({}, h)).toBe(join(h, '.nakoda'))
  })

  it('keeps using an existing ~/.fitrah in place (never moves it)', () => {
    const h = home()
    mkdirSync(join(h, '.fitrah'))
    expect(nakodaHome({}, h)).toBe(join(h, '.fitrah'))
    // Once ~/.nakoda exists, it wins.
    mkdirSync(join(h, '.nakoda'))
    expect(nakodaHome({}, h)).toBe(join(h, '.nakoda'))
  })

  it('keeps an existing fitrah.db, else nakoda.db', () => {
    const dir = home()
    expect(databaseFile(dir)).toBe(join(dir, 'nakoda.db'))
    writeFileSync(join(dir, 'fitrah.db'), '')
    expect(databaseFile(dir)).toBe(join(dir, 'fitrah.db'))
  })

  it('reads NAKODA_* first, then the old FITRAH_* variables', () => {
    expect(envSetting('PORT', { FITRAH_PORT: '4400' })).toBe('4400')
    expect(envSetting('PORT', { FITRAH_PORT: '4400', NAKODA_PORT: '4500' })).toBe('4500')
    expect(runtimePort({ FITRAH_PORT: '4400' })).toBe(4400)
    expect(nakodaHome({ FITRAH_HOME: '/tmp/x' }, home())).toBe('/tmp/x')
  })
})
