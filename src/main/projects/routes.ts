import type { Hono } from 'hono'
import { z } from 'zod/v4'
import { UserError } from '../errors'
import type { Db } from '../sqlite/db'
import { cloneProject, createProject, inspectFolder, listDirs } from './service'

const body = async <S extends z.ZodType>(raw: Promise<unknown>, schema: S): Promise<z.infer<S>> => {
  const parsed = schema.safeParse(await raw)
  if (!parsed.success) throw new UserError('invalid_request', parsed.error.issues[0]?.message ?? 'Invalid request')
  return parsed.data
}

export function registerProjectRoutes(app: Hono, db: Db): void {
  app.get('/api/fs/dirs', (c) => c.json(listDirs(c.req.query('path'), c.req.query('hidden') === '1')))
  app.post('/api/projects/inspect', async (c) => {
    const { path } = await body(c.req.json(), z.object({ path: z.string().min(1) }))
    return c.json(await inspectFolder(path))
  })
  app.post('/api/projects/clone', async (c) => {
    const input = await body(c.req.json(), z.object({ url: z.string().min(1), parentDir: z.string().min(1), name: z.string().optional() }))
    return c.json(await cloneProject(db, input), 201)
  })
  app.post('/api/projects/create', async (c) => {
    const input = await body(c.req.json(), z.object({ parentDir: z.string().min(1), name: z.string().min(1) }))
    return c.json(await createProject(db, input), 201)
  })
}
