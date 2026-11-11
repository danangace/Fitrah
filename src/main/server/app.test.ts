import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createApp } from './app'
import { TOKEN_HEADER, localHosts } from './security'

const token = 'a'.repeat(64)
const security = { token, allowedHosts: localHosts(4317) }
const host = { host: '127.0.0.1:4317' }

describe('createApp', () => {
  it('answers the health check without a token', async () => {
    const res = await createApp({ security }).request('/api/health', { headers: host })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, name: 'Fitrah' })
  })

  it('rejects api calls without or with a wrong token (AC-F2)', async () => {
    const app = createApp({ security })
    expect((await app.request('/api/anything', { headers: host })).status).toBe(401)
    expect((await app.request('/api/anything', { headers: { ...host, [TOKEN_HEADER]: 'b'.repeat(64) } })).status).toBe(401)
  })

  it('rejects a foreign origin and a foreign host (AC-F2)', async () => {
    const app = createApp({ security })
    const auth = { [TOKEN_HEADER]: token }
    expect((await app.request('/api/health', { headers: { ...host, origin: 'https://evil.example' } })).status).toBe(403)
    expect((await app.request('/api/health', { headers: { host: 'evil.example:4317', ...auth } })).status).toBe(403)
  })

  it('exchanges the token for an httponly cookie that authenticates later calls', async () => {
    const app = createApp({ security })
    const res = await app.request('/api/session', { method: 'POST', headers: { ...host, [TOKEN_HEADER]: token } })
    expect(res.status).toBe(200)
    const cookie = res.headers.get('set-cookie') ?? ''
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Strict')
    const later = await app.request('/api/nope', { headers: { ...host, cookie: cookie.split(';')[0] ?? '' } })
    expect(later.status).toBe(404) // authenticated, route just doesn't exist
  })

  it('serves the built ui with spa fallback', async () => {
    const webRoot = mkdtempSync(join(tmpdir(), 'fitrah-web-'))
    writeFileSync(join(webRoot, 'index.html'), '<div id="root"></div>')
    const app = createApp({ security, webRoot })
    expect(await (await app.request('/', { headers: host })).text()).toContain('root')
    expect(await (await app.request('/workspaces/abc', { headers: host })).text()).toContain('root')
  })
})
