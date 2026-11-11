import type { Hono } from 'hono'
import { API } from '../../shared/api'
import type { Db } from '../sqlite/db'
import { listAccounts, refreshAccount, setDefaultAccount } from './service'

export function registerAccountRoutes(app: Hono, db: Db): void {
  app.get(API.accounts, (c) => c.json(listAccounts(db)))
  app.post(`${API.accounts}/:id/check`, async (c) => c.json(await refreshAccount(db, c.req.param('id'))))
  app.post(`${API.accounts}/:id/default`, (c) => c.json(setDefaultAccount(db, c.req.param('id'))))
}
