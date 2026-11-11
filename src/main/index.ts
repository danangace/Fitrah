import { join } from 'node:path'
import { serve, type ServerType } from '@hono/node-server'
import { appTitle } from '../shared/app-info'
import { HOST, WEB_ROOT, fitrahHome, runtimePort } from './config'
import { createApp } from './server/app'
import { loadOrCreateToken, localHosts } from './server/security'
import { type Db, openDb } from './sqlite/db'

/** Vite dev server port, allowed as a host only when FITRAH_DEV=1. */
const DEV_UI_PORT = 5173

export type RuntimeHandle = { url: string; token: string; db: Db; server: ServerType }

export function startRuntime(port = runtimePort()): Promise<RuntimeHandle> {
  const home = fitrahHome()
  const token = loadOrCreateToken(home)
  const db = openDb(join(home, 'fitrah.db'))
  const devPort = process.env.FITRAH_DEV === '1' ? DEV_UI_PORT : undefined
  const app = createApp({ security: { token, allowedHosts: localHosts(port, devPort) }, webRoot: WEB_ROOT })
  return new Promise((resolveStart) => {
    // Bind to 127.0.0.1 only: never reachable from the network (AC-F1).
    const server = serve({ fetch: app.fetch, hostname: HOST, port }, (info) => {
      resolveStart({ url: `http://${HOST}:${info.port}`, token, db, server })
    })
  })
}

if (import.meta.main) {
  const { url, token } = await startRuntime()
  console.info(`${appTitle()} runtime on ${url}`)
  console.info(`Open: ${url}/?token=${token}`)
}
