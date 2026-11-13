import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createApp } from '../server/app'
import { TOKEN_HEADER, localHosts } from '../server/security'
import { openDb } from '../sqlite/db'
import { BOARDS, DEFECT, ME, SEARCH, STORY } from './fixtures/helix'

const TOKEN = `sidpjm_${'c'.repeat(64)}`
const sessionToken = 'a'.repeat(64)
const headers = { host: '127.0.0.1:4317', [TOKEN_HEADER]: sessionToken, 'content-type': 'application/json' }

function setup(env: NodeJS.ProcessEnv = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'nakoda-conn-'))
  const seen: { path: string; auth: string | null }[] = []
  let searches = 0
  const fakeFetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = new URL(String(url))
    seen.push({ path: u.pathname, auth: ((init?.headers ?? {}) as Record<string, string>).Authorization ?? null })
    const body = u.pathname === '/api/auth/me' ? ME : u.pathname === '/api/boards/' ? BOARDS : u.pathname === '/api/search' ? (searches++, SEARCH) : u.pathname === '/api/tickets/T2-3672' ? DEFECT : u.pathname === '/api/tickets/T2-3252' ? STORY : {}
    return new Response(JSON.stringify(body), { status: 200 })
  }) as typeof fetch
  const db = openDb(':memory:')
  const app = createApp({
    security: { token: sessionToken, allowedHosts: localHosts(4317) },
    db,
    connectors: { secretsDir: dir, fetch: fakeFetch, env },
  })
  const call = (method: string, path: string, body?: unknown) =>
    app.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  return { call, dir, seen, searches: () => searches, db }
}

describe('connector routes', () => {
  it('saves a token to secrets.json and never returns it', async () => {
    const { call, dir } = setup()
    const res = await call('POST', '/api/connectors', { label: 'Helix', baseUrl: 'https://helix.test/', token: TOKEN })
    expect(res.status).toBe(201)
    const created = await res.json()
    expect(created).toMatchObject({ kind: 'helix', baseUrl: 'https://helix.test', tokenSource: { kind: 'stored' }, tokenHint: 'sidpjm_…cccc' })
    expect(JSON.stringify(created)).not.toContain(TOKEN)
    expect(JSON.stringify(await (await call('GET', '/api/connectors')).json())).not.toContain(TOKEN)
    expect(readFileSync(join(dir, 'secrets.json'), 'utf8')).toContain(TOKEN)
  })

  it('rejects a malformed token, an http address, and both sources at once', async () => {
    const { call } = setup({ SIDPJM_PAT_READ_TICKET: TOKEN })
    expect((await call('POST', '/api/connectors', { label: 'H', baseUrl: 'https://helix.test', token: 'nope' })).status).toBe(400)
    expect((await call('POST', '/api/connectors', { label: 'H', baseUrl: 'http://helix.test', token: TOKEN })).status).toBe(400)
    expect((await call('POST', '/api/connectors', { label: 'H', baseUrl: 'https://helix.test', token: TOKEN, envName: 'SIDPJM_PAT_READ_TICKET' })).status).toBe(400)
    expect((await call('POST', '/api/connectors', { label: 'H', baseUrl: 'https://helix.test' })).status).toBe(400)
  })

  it('offers only Helix variable names, never the author token or values, and refuses other variables', async () => {
    const { call, seen } = setup({ SIDPJM_PAT_READ_TICKET: TOKEN, SIDPJM_PAT_AUTHOR_TICKET: TOKEN, AWS_SECRET_ACCESS_KEY: 'x', PATH: '/bin' })
    const names = await (await call('GET', '/api/connectors/env-vars')).json()
    expect(names).toEqual(['SIDPJM_PAT_READ_TICKET'])
    expect((await call('POST', '/api/connectors', { label: 'H', baseUrl: 'https://helix.test', envName: 'AWS_SECRET_ACCESS_KEY' })).status).toBe(400)
    expect((await call('POST', '/api/connectors', { label: 'H', baseUrl: 'https://helix.test', envName: 'SIDPJM_PAT_AUTHOR_TICKET' })).status).toBe(400)
    const ok = await call('POST', '/api/connectors', { label: 'H', baseUrl: 'https://helix.test', envName: 'SIDPJM_PAT_READ_TICKET' })
    expect(ok.status).toBe(201)
    const conn = await ok.json()
    await call('POST', `/api/connectors/${conn.id}/test`)
    expect(seen[0]?.auth).toBe(`Bearer ${TOKEN}`)
  })

  it('tests the connection and records when', async () => {
    const { call } = setup()
    const conn = await (await call('POST', '/api/connectors', { label: 'H', baseUrl: 'https://helix.test', token: TOKEN })).json()
    const result = await (await call('POST', `/api/connectors/${conn.id}/test`)).json()
    expect(result).toMatchObject({ ok: true, scope: 'read_only', owner: { name: 'Ada Lovelace' } })
    expect((await (await call('GET', '/api/connectors')).json())[0].lastCheckedAt).toEqual(expect.any(String))
  })

  it('lists my tickets, caches the page, and refreshes on request', async () => {
    const { call, searches } = setup()
    const conn = await (await call('POST', '/api/connectors', { label: 'H', baseUrl: 'https://helix.test', token: TOKEN })).json()
    const page = await (await call('GET', `/api/connectors/${conn.id}/tickets`)).json()
    expect(page.items.map((i: { key: string }) => i.key)).toEqual(['T2-3672', 'T2-3252'])
    await call('GET', `/api/connectors/${conn.id}/tickets`)
    expect(searches()).toBe(1)
    await call('GET', `/api/connectors/${conn.id}/tickets?refresh=1`)
    expect(searches()).toBe(2)
  })

  it('passes status filters through and rejects an unknown status before calling Helix', async () => {
    const { call, seen } = setup()
    const conn = await (await call('POST', '/api/connectors', { label: 'H', baseUrl: 'https://helix.test', token: TOKEN })).json()
    expect((await call('GET', `/api/connectors/${conn.id}/tickets?status=to_do&status=in_progress`)).status).toBe(200)
    const before = seen.length
    expect((await call('GET', `/api/connectors/${conn.id}/tickets?status=todo`)).status).toBe(400)
    expect(seen.length).toBe(before)
  })

  it('rejects a bad filter before calling Helix', async () => {
    const { call, seen } = setup()
    const conn = await (await call('POST', '/api/connectors', { label: 'H', baseUrl: 'https://helix.test', token: TOKEN })).json()
    expect((await call('GET', `/api/connectors/${conn.id}/tickets?boardId=abc`)).status).toBe(400)
    expect(seen).toHaveLength(0)
  })

  it('removing a connection also removes its token', async () => {
    const { call, dir } = setup()
    const conn = await (await call('POST', '/api/connectors', { label: 'H', baseUrl: 'https://helix.test', token: TOKEN })).json()
    expect((await call('DELETE', `/api/connectors/${conn.id}`)).status).toBe(200)
    expect(readFileSync(join(dir, 'secrets.json'), 'utf8')).not.toContain(TOKEN)
    expect((await call('POST', `/api/connectors/${conn.id}/test`)).status).toBe(404)
  })

  it('keeps the stored token when only the label is edited', async () => {
    const { call } = setup()
    const conn = await (await call('POST', '/api/connectors', { label: 'H', baseUrl: 'https://helix.test', token: TOKEN })).json()
    const edited = await (await call('PATCH', `/api/connectors/${conn.id}`, { label: 'Work Helix', baseUrl: 'https://helix.test' })).json()
    expect(edited).toMatchObject({ label: 'Work Helix', tokenHint: 'sidpjm_…cccc' })
  })

  it('copies a ticket to the board once, mapped for its kind, and never writes to Helix', async () => {
    const { call, seen } = setup()
    const conn = await (await call('POST', '/api/connectors', { label: 'H', baseUrl: 'https://helix.test', token: TOKEN })).json()
    const res = await call('POST', `/api/connectors/${conn.id}/transfer`, { key: 'T2-3672' })
    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({ source: 'helix', externalId: 'T2-3672', externalUrl: 'https://helix.test/tickets/T2-3672', kind: 'defect', workflowId: 'defect', column: 'backlog' })
    expect((await call('POST', `/api/connectors/${conn.id}/transfer`, { key: 'T2-3672' })).status).toBe(409)
    await call('POST', `/api/connectors/${conn.id}/transfer`, { key: 'T2-3252' })
    const board = await (await call('GET', '/api/tasks')).json()
    expect(board.map((t: { externalId: string }) => t.externalId).toSorted()).toEqual(['T2-3252', 'T2-3672'])
    expect(seen.every((r) => r.path.startsWith('/api/'))).toBe(true)
  })

  it('refuses a transfer without a ticket key', async () => {
    const { call } = setup()
    const conn = await (await call('POST', '/api/connectors', { label: 'H', baseUrl: 'https://helix.test', token: TOKEN })).json()
    expect((await call('POST', `/api/connectors/${conn.id}/transfer`, {})).status).toBe(400)
  })

  it('saves edited mappings with the connection and uses them on transfer', async () => {
    const { call } = setup()
    const conn = await (await call('POST', '/api/connectors', { label: 'H', baseUrl: 'https://helix.test', token: TOKEN })).json()
    expect(conn.mappings.severity.high).toBe('major')
    await call('PATCH', `/api/connectors/${conn.id}`, { label: 'H', baseUrl: 'https://helix.test', mappings: { severity: { medium: 'major' }, environment: { defect_staging: 'dev' } } })
    const task = await (await call('POST', `/api/connectors/${conn.id}/transfer`, { key: 'T2-3672' })).json()
    expect(task.values).toMatchObject({ severity: 'major', environment: 'dev' })
  })
})
