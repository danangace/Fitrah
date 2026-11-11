import type { Hono } from 'hono'
import { API } from '../../shared/api'
import type { Db } from '../sqlite/db'
import { type StatusLookup, createWorkspace, getWorkspace, listWorkspaces } from './service'

export type WorkspaceHooks = { status?: StatusLookup; afterCreate?: (workspaceId: string) => void }

export function registerWorkspaceRoutes(app: Hono, db: Db, hooks: WorkspaceHooks = {}): void {
  app.get(API.workspaces, (c) => c.json(listWorkspaces(db, hooks.status)))
  app.get(`${API.workspaces}/:id`, (c) => c.json(getWorkspace(db, c.req.param('id'), hooks.status)))
  app.post(API.workspaces, async (c) => {
    const ws = await createWorkspace(db, await c.req.json())
    hooks.afterCreate?.(ws.id)
    return c.json(ws, 201)
  })
}
