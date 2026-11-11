import { serve, type ServerType } from '@hono/node-server'
import { appTitle } from '../shared/app-info'
import { HOST, WEB_ROOT, runtimePort } from './config'
import { createApp } from './server/app'

export type RuntimeHandle = { url: string; server: ServerType }

export function startRuntime(port = runtimePort()): Promise<RuntimeHandle> {
  const app = createApp({ webRoot: WEB_ROOT })
  return new Promise((resolveStart) => {
    const server = serve({ fetch: app.fetch, hostname: HOST, port }, (info) => {
      resolveStart({ url: `http://${HOST}:${info.port}`, server })
    })
  })
}

if (import.meta.main) {
  const { url } = await startRuntime()
  console.info(`${appTitle()} runtime on ${url}`)
}
