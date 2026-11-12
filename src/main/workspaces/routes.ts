import type { Hono } from 'hono'
import { API } from '../../shared/api'
import type { Db } from '../sqlite/db'
import { archiveWorkspace } from './archive'
import { type StatusLookup, createWorkspace, getWorkspace, listWorkspaces, updateWorkspace } from './service'
import type { SetupRunner } from './setup-runner'

export type WorkspaceHooks = { status?: StatusLookup; setup?: SetupRunner }

export function registerWorkspaceRoutes(app: Hono, db: Db, hooks: WorkspaceHooks = {}): void {
  app.get(API.workspaces, (c) => c.json(listWorkspaces(db, hooks.status)))
  app.get(`${API.workspaces}/:id`, (c) => c.json(getWorkspace(db, c.req.param('id'), hooks.status)))
  app.get(`${API.workspaces}/:id/setup-log`, (c) => {
    getWorkspace(db, c.req.param('id'))
    return c.json({ log: hooks.setup?.log(c.req.param('id')) ?? '' })
  })
  app.patch(`${API.workspaces}/:id`, async (c) => c.json(updateWorkspace(db, c.req.param('id'), await c.req.json(), hooks.status)))
  app.post(`${API.workspaces}/:id/archive`, async (c) => {
    await archiveWorkspace(db, c.req.param('id'), await c.req.json().catch(() => ({})))
    return c.json({ ok: true })
  })
  app.post(API.workspaces, async (c) => {
    const ws = await createWorkspace(db, await c.req.json())
    // Setup runs in the background; its output streams over SSE (workspace.setup).
    void hooks.setup?.run(ws.id)
    return c.json(ws, 201)
  })
}
