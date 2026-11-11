import type { Hono } from 'hono'
import { API } from '../../shared/api'
import type { Db } from '../sqlite/db'
import { listChromeProfiles } from '../system/browsers'
import { addRepo, getSettings, listRepos, removeRepo, saveSettings, updateRepo } from './store'

export function registerSettingsRoutes(app: Hono, db: Db): void {
  app.get(API.settings, (c) => c.json(getSettings(db)))
  app.put(API.settings, async (c) => c.json(saveSettings(db, await c.req.json())))
  app.get('/api/system/chrome-profiles', (c) => c.json(listChromeProfiles()))
  app.get(API.repos, (c) => c.json(listRepos(db)))
  app.post(API.repos, async (c) => c.json(await addRepo(db, await c.req.json()), 201))
  app.patch(`${API.repos}/:id`, async (c) => c.json(updateRepo(db, c.req.param('id'), await c.req.json())))
  app.delete(`${API.repos}/:id`, (c) => {
    removeRepo(db, c.req.param('id'))
    return c.json({ ok: true })
  })
}
