import { describe, expect, it } from 'vitest'
import { BOARDS, DEFECT, ME, MILESTONES, SEARCH, STORY } from './fixtures/helix'
import { HelixClient, iterationShort, normalizeBaseUrl, ticketKind } from './helix'

const TOKEN = `sidpjm_${'f'.repeat(64)}`
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })

/** A fake Helix: routes by path, records every request. */
function fake(routes: Record<string, () => Response>) {
  const calls: { url: string; init: RequestInit }[] = []
  const fetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = new URL(String(url))
    calls.push({ url: String(url), init: init ?? {} })
    const handler = routes[u.pathname]
    return handler ? handler() : json({ error: 'nope' }, 404)
  }) as typeof fetch
  return { fetchFn, calls }
}
const client = (routes: Record<string, () => Response>, extra: Partial<ConstructorParameters<typeof HelixClient>[0]> = {}) => {
  const f = fake(routes)
  return { ...f, helix: new HelixClient({ baseUrl: 'https://helix.test', token: TOKEN, fetch: f.fetchFn, sleep: async () => {}, ...extra }) }
}

describe('normalizeBaseUrl', () => {
  it('keeps the origin only', () => expect(normalizeBaseUrl('https://project.sid.id/some/path/')).toBe('https://project.sid.id'))
  it('rejects plain http except for localhost', () => {
    expect(() => normalizeBaseUrl('http://project.sid.id')).toThrow(/https/)
    expect(normalizeBaseUrl('http://localhost:8080')).toBe('http://localhost:8080')
  })
  it('rejects text that is not an address', () => expect(() => normalizeBaseUrl('helix')).toThrow(/web address/))
})

describe('mapping helpers', () => {
  it('turns Helix iteration names into the short form', () => {
    expect(iterationShort('Iteration 15')).toBe('i-15')
    expect(iterationShort('Iteration 14b')).toBe('i-14b')
    expect(iterationShort('Sprint X')).toBeNull()
    expect(iterationShort(null)).toBeNull()
  })
  it('routes defects and bugs to the defect workflow, the rest to tasks', () => {
    expect(ticketKind('defect_staging')).toBe('defect')
    expect(ticketKind('bug')).toBe('defect')
    expect(ticketKind('story')).toBe('task')
  })
})

describe('HelixClient', () => {
  it('sends the token as a bearer header, never in the URL, and never follows redirects', async () => {
    const { helix, calls } = client({ '/api/auth/me': () => json(ME) })
    await helix.test()
    expect(calls[0]?.url).not.toContain('sidpjm')
    expect(((calls[0]?.init.headers ?? {}) as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`)
    expect(calls[0]?.init.redirect).toBe('manual')
  })

  it('reports the owner, scope and expiry, with no warning for a healthy read-only token', async () => {
    const { helix } = client({ '/api/auth/me': () => json(ME) })
    const result = await helix.test(new Date('2026-11-13'))
    expect(result).toMatchObject({ ok: true, owner: { id: 7, name: 'Ada Lovelace' }, scope: 'read_only', expiresAt: '2027-09-01T00:00:00Z', warnings: [] })
  })

  it('warns about a token that can write and about one that expires soon', async () => {
    const me = { data: { ...ME.data, token: { scope: 'full_author', capabilities: ['read', 'write'], expires_at: '2026-11-20T00:00:00Z' } } }
    const { helix } = client({ '/api/auth/me': () => json(me) })
    const { warnings } = await helix.test(new Date('2026-11-13'))
    expect(warnings).toHaveLength(2)
    expect(warnings[0]).toMatch(/more than read/)
    expect(warnings[1]).toMatch(/expires in 7 days/)
  })

  it.each([
    [401, 'helix_token', /expired/],
    [403, 'helix_forbidden', /read_only/],
    [429, 'helix_rate_limited', /rate limiting/],
  ])('maps a %i answer to a message a person can act on', async (status, code, text) => {
    const { helix } = client({ '/api/auth/me': () => json({ error: 'x' }, status) })
    await expect(helix.test()).rejects.toMatchObject({ code, message: expect.stringMatching(text) })
  })

  it('says Helix is unreachable on a network failure and when it redirects', async () => {
    const down = new HelixClient({ baseUrl: 'https://helix.test', token: TOKEN, fetch: (async () => { throw new TypeError('fetch failed') }) as typeof fetch })
    await expect(down.test()).rejects.toMatchObject({ code: 'helix_unreachable', message: expect.stringContaining('https://helix.test') })
    const { helix } = client({ '/api/auth/me': () => new Response(null, { status: 302, headers: { location: 'https://evil.test' } }) })
    await expect(helix.test()).rejects.toMatchObject({ code: 'helix_redirect' })
  })

  it('retries once after 503 busy, then gives up', async () => {
    let n = 0
    const { helix } = client({ '/api/boards/': () => (++n === 1 ? json({}, 503, { 'Retry-After': '1' }) : json(BOARDS)) })
    expect(await helix.boards()).toHaveLength(2)
    const busy = client({ '/api/boards/': () => json({}, 503) })
    await expect(busy.helix.boards()).rejects.toMatchObject({ code: 'helix_busy' })
    expect(busy.calls).toHaveLength(2)
  })

  it('lists boards and the iterations of a board', async () => {
    const { helix, calls } = client({ '/api/boards/': () => json(BOARDS), '/api/boards/4/milestones': () => json(MILESTONES) })
    expect(await helix.boards()).toEqual([{ id: 4, name: 'TRIBE 2' }, { id: 5, name: 'SandBox' }])
    expect(await helix.iterations(4)).toEqual([{ id: 95, name: 'Iteration 15', status: 'active' }, { id: 82, name: 'Iteration 14b', status: 'closed' }])
    expect(calls.at(-1)?.url).toContain('/api/boards/4/milestones')
  })

  it('lists my tickets from search: paged, filtered by numbers we checked, archived hidden', async () => {
    const { helix, calls } = client({ '/api/search': () => json(SEARCH) })
    const page = await helix.list({ meId: 7, boardId: 4, iterationId: 95, page: 2 })
    const url = new URL(calls[0]?.url ?? '')
    expect(Object.fromEntries(url.searchParams)).toEqual({ page: '2', limit: '50', assignee_id: '7', board_id: '4', milestone_id: '95' })
    expect(page.total).toBe(3)
    expect(page.items.map((i) => i.key)).toEqual(['T2-3672', 'T2-3252'])
    expect(page.items[0]).toMatchObject({ kind: 'defect', iteration: 'Iteration 15', board: 'TRIBE 2', assignee: 'Ada Lovelace', url: 'https://helix.test/tickets/T2-3672' })
    expect(page.items[1]?.kind).toBe('task')
  })

  it('leaves out the assignee filter for "everyone" and refuses filter values Helix would silently ignore', async () => {
    const { helix, calls } = client({ '/api/search': () => json(SEARCH) })
    await helix.list({ meId: 7, mine: false })
    expect(new URL(calls[0]?.url ?? '').searchParams.has('assignee_id')).toBe(false)
    await expect(helix.list({ meId: 7, boardId: Number.NaN })).rejects.toMatchObject({ code: 'invalid_board' })
    expect(calls).toHaveLength(1)
  })

  it('maps a story: sections in order, first PRD and Figma links kept, all links collected', async () => {
    const { helix } = client({ '/api/tickets/T2-3252': () => json(STORY) })
    const t = await helix.ticket('T2-3252')
    expect(t).toMatchObject({ key: 'T2-3252', kind: 'task', iterationName: 'Iteration 14b', iteration: 'i-14b', board: 'TRIBE 2' })
    expect(t.prdLinks).toEqual(['https://docs.example.test/prd-1', 'https://docs.example.test/prd-2'])
    expect(t.figmaLinks).toEqual(['https://www.figma.com/design/abc/invoices'])
    expect(t.children.map((c) => c.key)).toEqual(['T2-3274', 'T2-3391'])
    expect(t.description).toBe(
      '## Objective\n\nLet finance manage invoices\n\n## Scope\n\nList\n\nDetail\n\n## Acceptance criteria\n\nTotals match\n\n' +
        '## Subtasks (2)\n\n- [T2-3274](https://helix.test/tickets/T2-3274) · subtask · done — [FE] Invoice list\n- [T2-3391](https://helix.test/tickets/T2-3391) · defect · in_progress — Total ignores discount',
    )
  })

  it('maps a defect with its steps, expected and actual behaviour', async () => {
    const { helix } = client({ '/api/tickets/T2-3672': () => json(DEFECT) })
    const t = await helix.ticket('T2-3672')
    expect(t).toMatchObject({ kind: 'defect', severity: 'medium', iteration: 'i-15' })
    expect(t.description).toContain('## Steps to reproduce')
    expect(t.description).toContain('## Actual behavior\n\nLand on the dashboard')
  })

  it('refuses a ticket key that could change the request path', async () => {
    const { helix, calls } = client({})
    await expect(helix.ticket('../auth/me')).rejects.toMatchObject({ code: 'invalid_ticket_key' })
    expect(calls).toHaveLength(0)
  })

  it('never puts a token in an error message', async () => {
    const { helix } = client({ '/api/boards/': () => json({ error: `bad ${TOKEN}` }, 500) })
    await expect(helix.boards()).rejects.toThrow(/^(?!.*sidpjm_f{64})/)
  })
})
