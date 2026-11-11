import type { Hono } from 'hono'
import { API } from '../../shared/api'
import { z } from 'zod/v4'
import { AgentId } from '../../shared/schemas'
import { UserError } from '../errors'
import type { Db } from '../sqlite/db'
import { attachAccount, detectLogins, removeAccount } from './manage'
import { listAccounts, refreshAccount, setDefaultAccount } from './service'

const AttachBody = z.object({ agent: AgentId, configDir: z.string().min(1), label: z.string().optional() })

export function registerAccountRoutes(app: Hono, db: Db): void {
  app.get(API.accounts, (c) => c.json(listAccounts(db)))
  app.get(API.accountsDetect, (c) => c.json(detectLogins(db)))
  app.post(API.accounts, async (c) => {
    const parsed = AttachBody.safeParse(await c.req.json())
    if (!parsed.success) throw new UserError('invalid_account', parsed.error.issues[0]?.message ?? 'Invalid account')
    return c.json(await attachAccount(db, parsed.data), 201)
  })
  app.delete(`${API.accounts}/:id`, async (c) => {
    await removeAccount(db, c.req.param('id'))
    return c.json({ ok: true })
  })
  app.post(`${API.accounts}/:id/check`, async (c) => c.json(await refreshAccount(db, c.req.param('id'))))
  app.post(`${API.accounts}/:id/default`, (c) => c.json(setDefaultAccount(db, c.req.param('id'))))
}
