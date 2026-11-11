import { describe, expect, it, vi } from 'vitest'
import { claudeEnv } from '../env'
import { claudeStatus } from './status'

const runner = (stdout: string) => vi.fn().mockResolvedValue({ stdout })

describe('claudeStatus', () => {
  it('reads a claude.ai login (AC-A2)', async () => {
    const run = runner(
      JSON.stringify({ loggedIn: true, authMethod: 'claude.ai', email: 'me@example.com', loginExpiresAt: '2026-11-20T00:00:00Z' }),
    )
    expect(await claudeStatus('/acc', run)).toEqual({
      loginStatus: 'logged_in',
      email: 'me@example.com',
      loginExpiresAt: '2026-11-20T00:00:00Z',
      warning: null,
    })
    const [file, args, opts] = run.mock.calls[0] as [string, string[], { env: Record<string, string> }]
    expect([file, ...args]).toEqual(['claude', 'auth', 'status', '--json'])
    expect(opts.env.CLAUDE_CONFIG_DIR).toBe('/acc')
  })

  it('warns when the login is not a subscription', async () => {
    const s = await claudeStatus('/acc', runner(JSON.stringify({ loggedIn: true, authMethod: 'apiKey' })))
    expect(s.warning).toMatch(/billed/)
  })

  it('reports logged out and CLI failures', async () => {
    expect((await claudeStatus('/acc', runner(JSON.stringify({ loggedIn: false })))).loginStatus).toBe('logged_out')
    const failing = vi.fn().mockRejectedValue(new Error('ENOENT'))
    expect((await claudeStatus('/acc', failing)).loginStatus).toBe('error')
  })
})

describe('claudeEnv', () => {
  it('sets the config dir and strips api keys and parent session vars', () => {
    const env = claudeEnv('/acc', {
      PATH: '/bin',
      ANTHROPIC_API_KEY: 'x',
      ANTHROPIC_AUTH_TOKEN: 'y',
      CLAUDE_CODE_OAUTH_TOKEN: 'z',
      CLAUDECODE: '1',
      CLAUDE_CONFIG_DIR: '/other',
    })
    expect(env).toEqual({ PATH: '/bin', CLAUDE_CONFIG_DIR: '/acc' })
  })
})
