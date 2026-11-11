import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { APP_INFO, appTitle } from '../shared/app-info'
import { WEB_ROOT } from '../main/config'
import { startRuntime } from '../main/index'

const USAGE = `${appTitle()}

Usage:
  ${APP_INFO.cli} start [--port <n>] [--no-open]   start the runtime and open the UI
  ${APP_INFO.cli} help
`

/** Build the UI on every start (about a second), so an updated checkout never serves a stale UI. */
async function buildUi(): Promise<void> {
  console.info(existsSync(join(WEB_ROOT, 'index.html')) ? 'Building the UI…' : 'Building the UI (first run)…')
  const { build } = await import('vite')
  await build({ configFile: join(import.meta.dirname, '../../vite.web.config.ts'), logLevel: 'warn' })
}

function openBrowser(url: string): void {
  const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open'
  spawn(opener, [url], { stdio: 'ignore', detached: true }).unref()
}

async function start(port: number | undefined, open: boolean): Promise<void> {
  await buildUi()
  const { url, token, server, db } = await startRuntime(port)
  const openUrl = `${url}/?token=${token}`
  console.info(`${APP_INFO.name} is running on ${url}`)
  console.info(`Open: ${openUrl}`)
  console.info('Stop with Ctrl+C.')
  if (open) openBrowser(openUrl)
  const stop = () => {
    server.close()
    db.close()
    process.exit(0)
  }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
}

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { port: { type: 'string' }, 'no-open': { type: 'boolean', default: false } },
})

switch (positionals[0]) {
  case 'start':
    await start(values.port ? Number(values.port) : undefined, !values['no-open'])
    break
  default:
    console.info(USAGE)
}
