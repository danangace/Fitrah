import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createApp } from './app'

describe('createApp', () => {
  it('answers the health check', async () => {
    const res = await createApp().request('/api/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, name: 'Fitrah' })
  })

  it('returns 404 json for unknown api routes', async () => {
    const res = await createApp().request('/api/nope')
    expect(res.status).toBe(404)
  })

  it('serves the built ui with spa fallback', async () => {
    const webRoot = mkdtempSync(join(tmpdir(), 'fitrah-web-'))
    writeFileSync(join(webRoot, 'index.html'), '<div id="root"></div>')
    const app = createApp({ webRoot })
    expect(await (await app.request('/')).text()).toContain('root')
    expect(await (await app.request('/workspaces/abc')).text()).toContain('root')
  })
})
