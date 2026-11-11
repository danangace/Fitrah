import type { Hono } from 'hono'
import type { Db } from '../sqlite/db'
import { createWorkflow, getWorkflow, listWorkflows, removeWorkflow, updateWorkflow } from './service'

export function registerWorkflowRoutes(app: Hono, db: Db): void {
  app.get('/api/workflows', (c) => c.json(listWorkflows(db)))
  app.get('/api/workflows/:id', (c) => c.json(getWorkflow(db, c.req.param('id'))))
  app.post('/api/workflows', async (c) => c.json(createWorkflow(db, await c.req.json()), 201))
  app.put('/api/workflows/:id', async (c) => c.json(updateWorkflow(db, c.req.param('id'), await c.req.json())))
  app.delete('/api/workflows/:id', (c) => {
    removeWorkflow(db, c.req.param('id'))
    return c.json({ ok: true })
  })
}
