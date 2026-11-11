import { existsSync } from 'node:fs'
import { relative } from 'node:path'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { setCookie } from 'hono/cookie'
import { APP_INFO } from '../../shared/app-info'
import { UserError } from '../errors'
import { registerAccountRoutes } from '../accounts/routes'
import { registerSettingsRoutes } from '../settings/routes'
import type { Db } from '../sqlite/db'
import { TOKEN_COOKIE, type SecurityConfig, hostGuard, tokenGuard } from './security'

export type AppOptions = {
  security: SecurityConfig
  db: Db
  /** Folder with the built UI; when missing, only the API is served. */
  webRoot?: string
}

export function createApp(options: AppOptions): Hono {
  const app = new Hono()
  const { security, webRoot, db } = options

  // Every request must target a local host (DNS-rebinding guard), UI included.
  app.use('*', hostGuard(security))

  app.get('/api/health', (c) => c.json({ ok: true, name: APP_INFO.name }))

  // Everything else under /api needs the session token.
  app.use('/api/*', tokenGuard(security))

  // Exchange the token (sent once in the header) for an HttpOnly cookie, so EventSource and
  // WebSocket requests from the UI are authenticated too.
  app.post('/api/session', (c) => {
    setCookie(c, TOKEN_COOKIE, security.token, { httpOnly: true, sameSite: 'Strict', path: '/' })
    return c.json({ ok: true })
  })

  registerSettingsRoutes(app, db)
  registerAccountRoutes(app, db)

  app.all('/api/*', (c) => c.json({ error: 'not_found' }, 404))

  app.onError((error, c) => {
    if (error instanceof UserError) return c.json({ error: error.code, message: error.message }, error.status)
    if (error instanceof SyntaxError) return c.json({ error: 'invalid_json', message: error.message }, 400)
    console.error(error)
    return c.json({ error: 'internal_error', message: 'Something went wrong' }, 500)
  })

  if (webRoot && existsSync(webRoot)) {
    // serveStatic resolves `root` against the process cwd, so pass a relative path.
    const root = relative(process.cwd(), webRoot) || '.'
    app.use('/*', serveStatic({ root }))
    // Single-page app: unknown non-API paths fall back to index.html.
    app.get('*', serveStatic({ root, path: 'index.html' }))
  }

  return app
}
