import { describe, expect, it } from 'vitest'
import { parseRoute, routePath } from './route'

describe('route', () => {
  it('parses each page', () => {
    expect(parseRoute('/')).toEqual({ name: 'home' })
    expect(parseRoute('/docs/brainstorm/Design%20-%20Fitrah.md')).toEqual({
      name: 'docs',
      path: 'brainstorm/Design - Fitrah.md',
    })
    expect(parseRoute('/settings')).toEqual({ name: 'settings', section: 'general' })
    expect(parseRoute('/settings/accounts')).toEqual({ name: 'settings', section: 'accounts' })
    expect(parseRoute('/workspaces/w1')).toEqual({ name: 'workspace', id: 'w1' })
    expect(parseRoute('/nope')).toEqual({ name: 'not-found' })
  })

  it('round-trips paths', () => {
    for (const p of ['/', '/docs/a/b c.md', '/settings/repos', '/workspaces/w1']) {
      expect(routePath(parseRoute(p))).toBe(p.replace('b c', 'b%20c'))
    }
  })
})
