import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { APP_INFO, appTitle } from '../shared/app-info'
import { DEFAULT_PORT, HOST, WEB_ROOT, fitrahHome } from '../main/config'
import { startRuntime } from '../main/index'

const USAGE = `${appTitle()}

Usage:
  ${APP_INFO.cli} start [--port <n>] [--no-open]   start the runtime and open the UI
  ${APP_INFO.cli} open [--port <n>] [--print]      open the UI of a running Fitrah in your default browser
                                              (--print: only print the link, e.g. for another browser)
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

/** Open (or print) the link with the session token for an already running Fitrah. */
async function openUi(port: number, printOnly: boolean): Promise<void> {
  const url = `http://${HOST}:${port}`
  const running = await fetch(`${url}/api/health`).then((r) => r.ok, () => false)
  if (!running) {
    console.error(`Fitrah is not running on ${url}. Start it with: ${APP_INFO.cli} start`)
    process.exitCode = 1
    return
  }
  const tokenFile = join(fitrahHome(), 'token')
  if (!existsSync(tokenFile)) {
    console.error(`No session token at ${tokenFile}. Start Fitrah once with: ${APP_INFO.cli} start`)
    process.exitCode = 1
    return
  }
  const link = `${url}/?token=${readFileSync(tokenFile, 'utf8').trim()}`
  if (printOnly) {
    console.info(link)
    console.info('Keep this link private: it gives full access to your Fitrah.')
    return
  }
  openBrowser(link)
  console.info(`Opened ${url} in your default browser.`)
}

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    port: { type: 'string' },
    'no-open': { type: 'boolean', default: false },
    print: { type: 'boolean', default: false },
  },
})

switch (positionals[0]) {
  case 'start':
    await start(values.port ? Number(values.port) : undefined, !values['no-open'])
    break
  case 'open':
    await openUi(values.port ? Number(values.port) : Number(process.env.FITRAH_PORT ?? DEFAULT_PORT), values.print)
    break
  default:
    console.info(USAGE)
}
