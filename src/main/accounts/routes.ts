import type { Hono } from 'hono'
import { API } from '../../shared/api'
import { z } from 'zod/v4'
import { AgentId } from '../../shared/schemas'
import { UserError } from '../errors'
import type { Db } from '../sqlite/db'
import { ClaudeLoginManager } from './claude/login'
import type { ModelCatalogs } from './models'
import { attachAccount, detectLogins, removeAccount } from './manage'
import { listAccounts, refreshAccount, renameAccount, setDefaultAccount } from './service'

const AttachBody = z.object({ agent: AgentId, configDir: z.string().min(1), label: z.string().optional() })

export function registerAccountRoutes(app: Hono, db: Db, catalogs: ModelCatalogs): void {
  const logins = new ClaudeLoginManager(db)
  // Sign in a new Claude account (managed folder under ~/.nakoda/accounts).
  app.post(`${API.accounts}/login`, async (c) => {
    const body = z.object({ label: z.string().min(1) }).safeParse(await c.req.json())
    if (!body.success) throw new UserError('invalid_label', 'Give the account a label')
    return c.json(logins.start(body.data.label), 201)
  })
  app.get(`${API.accounts}/login/:id`, (c) => c.json(logins.view(c.req.param('id'))))
  app.post(`${API.accounts}/login/:id/code`, async (c) => {
    const body = z.object({ code: z.string().min(1) }).safeParse(await c.req.json())
    if (!body.success) throw new UserError('invalid_code', 'Paste the code from the sign-in page')
    return c.json(logins.submitCode(c.req.param('id'), body.data.code))
  })
  app.delete(`${API.accounts}/login/:id`, (c) => c.json(logins.cancel(c.req.param('id'))))

  app.get(API.accounts, (c) => c.json(listAccounts(db)))
  app.get(API.accountsDetect, (c) => c.json(detectLogins(db)))
  app.post(API.accounts, async (c) => {
    const parsed = AttachBody.safeParse(await c.req.json())
    if (!parsed.success) throw new UserError('invalid_account', parsed.error.issues[0]?.message ?? 'Invalid account')
    return c.json(await attachAccount(db, parsed.data), 201)
  })
  // The models this account may use (cached; ?refresh=1 asks Claude Code again).
  app.get(`${API.accounts}/:id/models`, async (c) => c.json(await catalogs.get(c.req.param('id'), c.req.query('refresh') === '1')))
  app.delete(`${API.accounts}/:id`, async (c) => {
    await removeAccount(db, c.req.param('id'))
    catalogs.forget(c.req.param('id'))
    return c.json({ ok: true })
  })
  app.post(`${API.accounts}/:id/check`, async (c) => c.json(await refreshAccount(db, c.req.param('id'))))
  app.post(`${API.accounts}/:id/default`, (c) => c.json(setDefaultAccount(db, c.req.param('id'))))
  app.patch(`${API.accounts}/:id`, async (c) => {
    const body = z.object({ label: z.string() }).safeParse(await c.req.json())
    if (!body.success) throw new UserError('invalid_label', 'Give the account a name')
    return c.json(renameAccount(db, c.req.param('id'), body.data.label))
  })
}
