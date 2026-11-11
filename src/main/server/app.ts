import { existsSync } from 'node:fs'
import { relative } from 'node:path'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { setCookie } from 'hono/cookie'
import { APP_INFO } from '../../shared/app-info'
import { UserError } from '../errors'
import { registerAccountRoutes } from '../accounts/routes'
import { registerDocsRoutes } from '../docs/routes'
import { DocsService } from '../docs/service'
import { DocsWatcher } from '../docs/watch'
import { EventBus } from '../events/bus'
import { registerEventRoutes } from '../events/routes'
import { claudeAdapter } from '../native-chat/claude/adapter'
import { ApprovalManager } from '../native-chat/approvals'
import { registerChatRoutes } from '../native-chat/routes'
import { ChatService } from '../native-chat/service'
import { registerSettingsRoutes } from '../settings/routes'
import { registerProjectRoutes } from '../projects/routes'
import { StatusTracker } from '../status/tracker'
import { registerWorkflowRoutes } from '../workflows/routes'
import { registerWorkspaceRoutes } from '../workspaces/routes'
import { SetupRunner } from '../workspaces/setup-runner'
import type { Db } from '../sqlite/db'
import { TOKEN_COOKIE, type SecurityConfig, hostGuard, tokenGuard } from './security'

export type AppOptions = {
  security: SecurityConfig
  db: Db
  docs?: DocsService
  bus?: EventBus
  chats?: ChatService
  /** Folder with the built UI; when missing, only the API is served. */
  webRoot?: string
}

export function createApp(options: AppOptions): Hono {
  return createRuntimeApp(options).app
}

/** The app plus the services the runtime wires together (chat, bus). */
export function createRuntimeApp(options: AppOptions): { app: Hono; chats: ChatService; bus: EventBus } {
  const app = new Hono()
  const { security, webRoot, db } = options

  // Every request must target a local host (DNS-rebinding guard), UI included.
  app.use('*', hostGuard(security))

  app.get('/api/health', (c) => c.json({ ok: true, name: APP_INFO.name }))

  // Everything else under /api, and the chat socket, needs the session token.
  app.use('/api/*', tokenGuard(security))
  app.use('/ws/*', tokenGuard(security))

  // Exchange the token (sent once in the header) for an HttpOnly cookie, so EventSource and
  // WebSocket requests from the UI are authenticated too.
  app.post('/api/session', (c) => {
    // Remembered for 30 days, so a browser restart does not disconnect you.
    setCookie(c, TOKEN_COOKIE, security.token, { httpOnly: true, sameSite: 'Strict', path: '/', maxAge: 60 * 60 * 24 * 30 })
    return c.json({ ok: true })
  })

  const bus = options.bus ?? new EventBus()
  const docs = options.docs ?? new DocsService(db)
  const watcher = new DocsWatcher(docs, bus)
  watcher.sync()

  // Restart the docs watcher when the docs root changes.
  app.use('/api/settings', async (c, next) => {
    await next()
    if (c.req.method === 'PUT' && c.res.ok) {
      docs.invalidate()
      watcher.sync()
    }
  })
  registerSettingsRoutes(app, db)
  registerAccountRoutes(app, db)
  registerWorkflowRoutes(app, db)
  registerProjectRoutes(app, db)
  registerDocsRoutes(app, docs)
  registerEventRoutes(app, bus)
  const chats = options.chats ?? new ChatService(db, { claude: claudeAdapter })
  const tracker = new StatusTracker(db, bus, chats)
  registerWorkspaceRoutes(app, db, { setup: new SetupRunner(db, bus), status: tracker.statusOf })
  const approvals = new ApprovalManager(db, chats)
  chats.setDecider(approvals.decide)
  chats.onStop((chatId) => approvals.cancelChat(chatId))
  registerChatRoutes(app, chats, approvals.answer)

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

  return { app, chats, bus }
}
