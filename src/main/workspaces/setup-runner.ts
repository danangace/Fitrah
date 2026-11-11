import { spawn } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fitrahHome } from '../config'
import type { EventBus } from '../events/bus'
import { getRepo } from '../settings/store'
import type { Db } from '../sqlite/db'
import { getWorkspace, setSetupStatus } from './service'

const logFile = (workspaceId: string) => join(fitrahHome(), 'logs', `${workspaceId}-setup.log`)

/** Runs the repo's setup script inside a new worktree and streams its output (AC-W3). */
export class SetupRunner {
  constructor(
    private db: Db,
    private bus: EventBus,
  ) {}

  run(workspaceId: string): Promise<'done' | 'failed' | 'skipped'> {
    const ws = getWorkspace(this.db, workspaceId)
    const script = getRepo(this.db, ws.repoId).setupScript.trim()
    if (!script) {
      setSetupStatus(this.db, workspaceId, 'skipped')
      return Promise.resolve('skipped')
    }
    const file = logFile(workspaceId)
    mkdirSync(join(fitrahHome(), 'logs'), { recursive: true })
    writeFileSync(file, `$ ${script}\n`)
    setSetupStatus(this.db, workspaceId, 'running')
    const emit = (line: string, done = false) => {
      appendFileSync(file, `${line}\n`)
      this.bus.emit({ type: 'workspace.setup', workspaceId, line, done })
    }
    emit(`$ ${script}`)

    return new Promise((resolveRun) => {
      const child = spawn('sh', ['-c', script], { cwd: ws.worktreePath, env: process.env })
      let partial = ''
      const onData = (chunk: Buffer) => {
        const lines = (partial + chunk.toString()).split(/\r?\n/)
        partial = lines.pop() ?? ''
        for (const line of lines) emit(line)
      }
      child.stdout.on('data', onData)
      child.stderr.on('data', onData)
      const finish = (ok: boolean, message: string) => {
        if (partial) emit(partial)
        // A failed script keeps the workspace; the user can fix it and continue.
        setSetupStatus(this.db, workspaceId, ok ? 'done' : 'failed')
        emit(message, true)
        resolveRun(ok ? 'done' : 'failed')
      }
      child.on('error', (error) => finish(false, `Setup could not start: ${error.message}`))
      child.on('close', (code) => finish(code === 0, code === 0 ? 'Setup finished.' : `Setup failed (exit ${code}).`))
    })
  }

  log(workspaceId: string): string {
    const file = logFile(workspaceId)
    return existsSync(file) ? readFileSync(file, 'utf8') : ''
  }
}
