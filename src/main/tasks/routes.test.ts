import { describe, expect, it } from 'vitest'
import { createApp } from '../server/app'
import { TOKEN_HEADER, localHosts } from '../server/security'
import { openDb } from '../sqlite/db'

const token = 'a'.repeat(64)
const headers = { host: '127.0.0.1:4317', [TOKEN_HEADER]: token, 'content-type': 'application/json' }

describe('task routes', () => {
  const app = createApp({ security: { token, allowedHosts: localHosts(4317) }, db: openDb(':memory:') })
  const call = (method: string, path: string, body?: unknown) => app.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })

  it('creates, lists, edits, moves and deletes a ticket', async () => {
    const created = await call('POST', '/api/tasks', { title: 'First' })
    expect(created.status).toBe(201)
    const task = await created.json()
    expect(await (await call('GET', '/api/tasks')).json()).toHaveLength(1)
    expect(await (await call('PATCH', `/api/tasks/${task.id}`, { description: 'More' })).json()).toMatchObject({ title: 'First', description: 'More' })
    expect(await (await call('POST', `/api/tasks/${task.id}/move`, { column: 'review' })).json()).toMatchObject({ column: 'review' })
    expect((await call('POST', `/api/tasks/${task.id}/move`, { column: 'nope' })).status).toBe(400)
    expect((await call('DELETE', `/api/tasks/${task.id}`)).status).toBe(200)
    expect((await call('GET', `/api/tasks/${task.id}`)).status).toBe(404)
  })

  it('answers 400 for a ticket without a title and 404 when assigning to an unknown workspace', async () => {
    expect((await call('POST', '/api/tasks', { title: '' })).status).toBe(400)
    const task = await (await call('POST', '/api/tasks', { title: 'Bare' })).json()
    const res = await call('POST', `/api/tasks/${task.id}/assign`, { workspaceId: 'x' })
    expect(res.status).toBe(404)
  })
})
