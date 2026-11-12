import { describe, expect, it } from 'vitest'
import { configDirName } from './accounts'

describe('configDirName', () => {
  it('returns the login folder name', () => {
    expect(configDirName('/Users/x/.claude')).toBe('.claude')
    expect(configDirName('/Users/x/.claude-sid')).toBe('.claude-sid')
  })
  it('ignores a trailing slash', () => {
    expect(configDirName('/Users/x/.claude-work/')).toBe('.claude-work')
  })
})
