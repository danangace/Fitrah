import { type ChildProcess, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import type { Account } from '../../../shared/schemas'
import { UserError } from '../../errors'
import type { Db } from '../../sqlite/db'
import { claudeEnv } from '../env'
import { managedAccountsRoot } from '../manage'
import { insertAccount, refreshAccount } from '../service'

export type LoginState = 'starting' | 'waiting_for_user' | 'done' | 'failed' | 'cancelled'

export type LoginView = {
  id: string
  state: LoginState
  link: string | null
  /** True once Claude asked for a code to be pasted. */
  codePrompt: boolean
  account: Account | null
  error: string | null
}

type Session = LoginView & { child: ChildProcess; configDir: string; timer: NodeJS.Timeout }

const LOGIN_TIMEOUT_MS = 10 * 60_000
const LINK_RE = /https:\/\/(?:claude\.(?:ai|com)|platform\.claude\.com|console\.anthropic\.com)\/\S+/

export type SpawnLogin = (configDir: string) => ChildProcess

/** `claude auth login --claudeai` in a fresh Fitrah-managed folder (checked 2026-11-11: works without a TTY). */
export const spawnClaudeLogin: SpawnLogin = (configDir) =>
  spawn('claude', ['auth', 'login', '--claudeai'], { env: claudeEnv(configDir), stdio: ['pipe', 'pipe', 'pipe'] })

/** Runs sign-in sessions for new managed Claude accounts (AC-A3). */
export class ClaudeLoginManager {
  private sessions = new Map<string, Session>()

  constructor(
    private db: Db,
    private spawnLogin: SpawnLogin = spawnClaudeLogin,
    private refresh: typeof refreshAccount = refreshAccount,
  ) {}

  start(label: string): LoginView {
    const id = randomUUID()
    const configDir = join(managedAccountsRoot(), 'claude', id)
    mkdirSync(configDir, { recursive: true, mode: 0o700 })
    const child = this.spawnLogin(configDir)
    const timer = setTimeout(() => this.finish(id, 'failed', 'Sign-in timed out'), LOGIN_TIMEOUT_MS)
    const session: Session = { id, state: 'starting', link: null, codePrompt: false, account: null, error: null, child, configDir, timer }
    this.sessions.set(id, session)

    let output = ''
    const onData = (chunk: Buffer) => {
      output = (output + chunk.toString()).slice(-8_000)
      const link = output.match(LINK_RE)?.[0]
      if (link && !session.link) session.link = link
      if (/paste code/i.test(output)) session.codePrompt = true
      if (session.state === 'starting' && session.link) session.state = 'waiting_for_user'
    }
    child.stdout?.on('data', onData)
    child.stderr?.on('data', onData)
    child.on('error', (error) => this.finish(id, 'failed', `Could not start claude: ${error.message}`))
    child.on('exit', (code) => {
      if (session.state === 'cancelled' || session.state === 'failed' || session.state === 'done') return
      if (code === 0) void this.complete(id, label)
      else this.finish(id, 'failed', `Sign-in ended with exit code ${code}`)
    })
    return this.view(id)
  }

  submitCode(id: string, code: string): LoginView {
    const session = this.get(id)
    if (session.state !== 'waiting_for_user') throw new UserError('login_not_waiting', 'This sign-in is not waiting for a code')
    session.child.stdin?.write(`${code.trim()}\n`)
    return this.view(id)
  }

  cancel(id: string): LoginView {
    this.finish(id, 'cancelled', null)
    return this.view(id)
  }

  view(id: string): LoginView {
    const { child: _child, configDir: _dir, timer: _timer, ...view } = this.get(id)
    return view
  }

  private get(id: string): Session {
    const session = this.sessions.get(id)
    if (!session) throw new UserError('login_not_found', 'Sign-in session not found', 404)
    return session
  }

  private async complete(id: string, label: string): Promise<void> {
    const session = this.get(id)
    try {
      const inserted = insertAccount(this.db, { agent: 'claude', kind: 'managed', configDir: session.configDir, label })
      session.account = await this.refresh(this.db, inserted.id)
      session.state = 'done'
      clearTimeout(session.timer)
    } catch (error) {
      this.finish(id, 'failed', (error as Error).message)
    }
  }

  private finish(id: string, state: 'failed' | 'cancelled', error: string | null): void {
    const session = this.sessions.get(id)
    if (!session || session.state === 'done') return
    session.state = state
    session.error = error
    clearTimeout(session.timer)
    if (session.child.exitCode === null) session.child.kill()
    // Nothing was attached, so the half-made managed folder is removed.
    rmSync(session.configDir, { recursive: true, force: true })
  }
}
