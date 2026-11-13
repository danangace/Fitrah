import { describe, expect, it } from 'vitest'
import { claudeEnv } from './env'

describe('claudeEnv', () => {
  const base = {
    PATH: '/bin',
    ANTHROPIC_API_KEY: 'k',
    CLAUDE_CODE_OAUTH_TOKEN: 't',
    SIDPJM_PAT_READ_TICKET: 'read',
    SIDPJM_PAT_AUTHOR_TICKET: 'author',
  }

  it('keeps the read-only Helix token but drops the one that can write tickets', () => {
    const env = claudeEnv('/h/.claude', base, '/h')
    expect(env.SIDPJM_PAT_READ_TICKET).toBe('read')
    expect(env).not.toHaveProperty('SIDPJM_PAT_AUTHOR_TICKET')
  })

  it('drops API-key variables and sets the config dir only for non-default accounts', () => {
    expect(claudeEnv('/h/.claude', base, '/h')).toEqual({ PATH: '/bin', SIDPJM_PAT_READ_TICKET: 'read' })
    expect(claudeEnv('/h/.claude-sid', base, '/h').CLAUDE_CONFIG_DIR).toBe('/h/.claude-sid')
  })
})
