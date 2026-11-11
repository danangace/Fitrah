import { existsSync } from 'node:fs'
import { relative } from 'node:path'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { APP_INFO } from '../../shared/app-info'

export type AppOptions = {
  /** Folder with the built UI; when missing, only the API is served. */
  webRoot?: string
}

export function createApp(options: AppOptions = {}): Hono {
  const app = new Hono()

  app.get('/api/health', (c) => c.json({ ok: true, name: APP_INFO.name }))
  app.all('/api/*', (c) => c.json({ error: 'not_found' }, 404))

  const { webRoot } = options
  if (webRoot && existsSync(webRoot)) {
    // serveStatic resolves `root` against the process cwd, so pass a relative path.
    const root = relative(process.cwd(), webRoot) || '.'
    app.use('/*', serveStatic({ root }))
    // Single-page app: unknown non-API paths fall back to index.html.
    app.get('*', serveStatic({ root, path: 'index.html' }))
  }

  return app
}
