import { readdirSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join, relative } from 'node:path'
import type { Account, AgentId, DetectedLogin } from '../../shared/schemas'
import { fitrahHome } from '../config'
import { UserError } from '../errors'
import { execFileAsync, expandHome, isDirectory } from '../paths'
import type { Db } from '../sqlite/db'
import { claudeLoginCandidates, claudeSiblingDirs } from './claude/detect'
import { claudeEnv } from './env'
import { deleteAccountRow, getAccount, insertAccount, listAccounts, refreshAccount } from './service'

/** Managed accounts (created by Fitrah's sign-in) live here; only these may ever be deleted. */
export function managedAccountsRoot(): string {
  return join(fitrahHome(), 'accounts')
}

/** Logins found on this machine. They are only proposed; nothing is attached silently (OQ-24, AC-A1). */
export function detectLogins(db: Db, home = homedir()): DetectedLogin[] {
  const attached = new Set(listAccounts(db).map((a) => a.configDir))
  const dirs = new Set([...claudeLoginCandidates(home), ...claudeSiblingDirs(home, (d) => readdirSync(d))])
  return [...dirs].toSorted().map((configDir) => ({ agent: 'claude' as const, configDir, attached: attached.has(configDir) }))
}

export async function attachAccount(db: Db, input: { agent: AgentId; configDir: string; label?: string }): Promise<Account> {
  if (input.agent !== 'claude') throw new UserError('agent_not_supported', 'Only Claude accounts are supported in V1')
  const configDir = expandHome(input.configDir)
  if (!isDirectory(configDir)) throw new UserError('folder_missing', `Folder does not exist: ${configDir}`)
  const account = insertAccount(db, {
    agent: input.agent,
    kind: 'attached',
    configDir,
    label: input.label?.trim() || basename(configDir),
  })
  return refreshAccount(db, account.id)
}

/**
 * Remove an account. Attached: only forget it, the user's folder is never touched. Managed:
 * sign out and delete its folder, but only if it sits inside Fitrah's own accounts folder (AC-A4).
 */
export async function removeAccount(db: Db, id: string, logout = claudeLogout): Promise<void> {
  const account = getAccount(db, id)
  if (account.kind === 'managed') {
    const rel = relative(managedAccountsRoot(), account.configDir)
    if (rel.startsWith('..') || rel === '' || rel.includes('..')) {
      throw new UserError('unsafe_delete', 'Refusing to delete a folder outside Fitrah accounts')
    }
    await logout(account.configDir).catch(() => undefined)
    rmSync(account.configDir, { recursive: true, force: true })
  }
  deleteAccountRow(db, id)
}

async function claudeLogout(configDir: string): Promise<void> {
  await execFileAsync('claude', ['auth', 'logout'], { env: claudeEnv(configDir), timeout: 15_000 })
}
