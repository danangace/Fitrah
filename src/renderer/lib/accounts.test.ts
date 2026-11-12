import { describe, expect, it } from 'vitest'
import { accountName, configDirName } from './accounts'

describe('accountName', () => {
  it('prefers your own name, falls back to the folder', () => {
    expect(accountName('Sekolahmu', '/Users/x/.claude-sid')).toBe('Sekolahmu')
    expect(accountName(null, '/Users/x/.claude-sid')).toBe('.claude-sid')
    expect(accountName('  ', '/Users/x/.claude')).toBe('.claude')
  })
})

describe('configDirName', () => {
  it('returns the login folder name', () => {
    expect(configDirName('/Users/x/.claude')).toBe('.claude')
    expect(configDirName('/Users/x/.claude-sid')).toBe('.claude-sid')
  })
  it('ignores a trailing slash', () => {
    expect(configDirName('/Users/x/.claude-work/')).toBe('.claude-work')
  })
})
