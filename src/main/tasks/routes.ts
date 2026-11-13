import type { Hono } from 'hono'
import { z } from 'zod/v4'
import { BoardColumn } from '../../shared/tasks'
import { UserError } from '../errors'
import type { Db } from '../sqlite/db'
import { assignTask, createTask, deleteTask, getTask, listTasks, moveTask, unassignTask, updateTask } from './service'

export function registerTaskRoutes(app: Hono, db: Db): void {
  app.get('/api/tasks', (c) => c.json(listTasks(db)))
  app.post('/api/tasks', async (c) => c.json(createTask(db, await c.req.json()), 201))
  app.get('/api/tasks/:id', (c) => c.json(getTask(db, c.req.param('id'))))
  app.patch('/api/tasks/:id', async (c) => c.json(updateTask(db, c.req.param('id'), await c.req.json())))
  app.delete('/api/tasks/:id', (c) => {
    deleteTask(db, c.req.param('id'))
    return c.json({ ok: true })
  })
  app.post('/api/tasks/:id/move', async (c) => {
    const body = z.object({ column: BoardColumn }).safeParse(await c.req.json())
    if (!body.success) throw new UserError('invalid_column', 'Unknown column')
    return c.json(moveTask(db, c.req.param('id'), body.data.column))
  })
  app.post('/api/tasks/:id/assign', async (c) => {
    const body = z.object({ workspaceId: z.string().min(1) }).safeParse(await c.req.json())
    if (!body.success) throw new UserError('invalid_workspace', 'Pick a workspace')
    return c.json(assignTask(db, c.req.param('id'), body.data.workspaceId))
  })
  app.post('/api/tasks/:id/unassign', (c) => c.json(unassignTask(db, c.req.param('id'))))
}
