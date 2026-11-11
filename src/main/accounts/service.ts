import { randomUUID } from 'node:crypto'
import { type Account, AccountUsage, AgentId, type UsageWindow } from '../../shared/schemas'
import { UserError } from '../errors'
import { nowIso } from '../paths'
import type { Db } from '../sqlite/db'
import { type StatusResult, claudeStatus } from './claude/status'

/** One provider per agent (Codex-ready seam). V1 registers Claude only. */
export type AccountProvider = { status: (configDir: string) => Promise<StatusResult> }
export const providers: Partial<Record<AgentId, AccountProvider>> = { claude: { status: (dir) => claudeStatus(dir) } }

type AccountRow = {
  id: string
  agent: AgentId
  label: string
  kind: 'attached' | 'managed'
  config_dir: string
  email: string | null
  login_expires_at: string | null
  login_status: Account['loginStatus']
  warning: string | null
  is_default: number
  last_checked_at: string | null
  usage_json: string | null
  usage_updated_at: string | null
}

const parseUsage = (r: AccountRow): Account['usage'] => {
  if (!r.usage_json || !r.usage_updated_at) return null
  const parsed = AccountUsage.safeParse({ windows: JSON.parse(r.usage_json), updatedAt: r.usage_updated_at })
  return parsed.success ? parsed.data : null
}

const toAccount = (r: AccountRow): Account => ({
  id: r.id,
  agent: r.agent,
  label: r.label,
  kind: r.kind,
  configDir: r.config_dir,
  email: r.email,
  loginExpiresAt: r.login_expires_at,
  loginStatus: r.login_status,
  warning: r.warning,
  isDefault: r.is_default === 1,
  lastCheckedAt: r.last_checked_at,
  usage: parseUsage(r),
})

export function listAccounts(db: Db, agent?: AgentId): Account[] {
  const rows = agent
    ? db.prepare('SELECT * FROM accounts WHERE agent = ? ORDER BY created_at').all(agent)
    : db.prepare('SELECT * FROM accounts ORDER BY agent, created_at').all()
  return (rows as AccountRow[]).map(toAccount)
}

export function getAccount(db: Db, id: string): Account {
  const row = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as AccountRow | undefined
  if (!row) throw new UserError('account_not_found', 'Account not found', 404)
  return toAccount(row)
}

export function defaultAccount(db: Db, agent: AgentId): Account | null {
  const row = db.prepare('SELECT * FROM accounts WHERE agent = ? AND is_default = 1').get(agent) as AccountRow | undefined
  return row ? toAccount(row) : null
}

export function insertAccount(
  db: Db,
  input: { agent: AgentId; label: string; kind: Account['kind']; configDir: string },
): Account {
  if (db.prepare('SELECT 1 FROM accounts WHERE config_dir = ?').get(input.configDir)) {
    throw new UserError('account_exists', 'This login folder is already attached', 409)
  }
  const id = randomUUID()
  // The first account of an agent becomes its default (exactly one default, AC-A5).
  const isDefault = defaultAccount(db, input.agent) ? 0 : 1
  db.prepare(
    'INSERT INTO accounts (id, agent, label, kind, config_dir, is_default, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(id, input.agent, input.label, input.kind, input.configDir, isDefault, nowIso())
  return getAccount(db, id)
}

export function setDefaultAccount(db: Db, id: string): Account {
  const account = getAccount(db, id)
  db.exec('BEGIN')
  db.prepare('UPDATE accounts SET is_default = 0 WHERE agent = ?').run(account.agent)
  db.prepare('UPDATE accounts SET is_default = 1 WHERE id = ?').run(id)
  db.exec('COMMIT')
  return getAccount(db, id)
}

/** Re-read the login status from the agent CLI. Fitrah stores what it reports, never tokens. */
export async function refreshAccount(db: Db, id: string, provider = providers[getAccount(db, id).agent]): Promise<Account> {
  const account = getAccount(db, id)
  if (!provider) throw new UserError('agent_not_supported', `${account.agent} is not supported yet`)
  const s = await provider.status(account.configDir)
  db.prepare(
    'UPDATE accounts SET login_status = ?, email = ?, login_expires_at = ?, warning = ?, last_checked_at = ? WHERE id = ?',
  ).run(s.loginStatus, s.email, s.loginExpiresAt, s.warning, nowIso(), id)
  return getAccount(db, id)
}

/** Save the limits a chat just reported (merged per window key). */
export function saveAccountUsage(db: Db, id: string, windows: UsageWindow[]): Account['usage'] {
  const current = getAccount(db, id).usage?.windows ?? []
  const merged = [...current.filter((w) => !windows.some((n) => n.key === w.key)), ...windows]
  const updatedAt = nowIso()
  db.prepare('UPDATE accounts SET usage_json = ?, usage_updated_at = ? WHERE id = ?').run(JSON.stringify(merged), updatedAt, id)
  return { windows: merged, updatedAt }
}

export function setAccountWarning(db: Db, id: string, warning: string | null): void {
  db.prepare('UPDATE accounts SET warning = ? WHERE id = ?').run(warning, id)
}

export function deleteAccountRow(db: Db, id: string): void {
  const account = getAccount(db, id)
  db.prepare('UPDATE chats SET account_id = NULL WHERE account_id = ?').run(id)
  db.prepare('DELETE FROM accounts WHERE id = ?').run(id)
  if (account.isDefault) {
    const next = db.prepare('SELECT id FROM accounts WHERE agent = ? ORDER BY created_at LIMIT 1').get(account.agent) as
      | { id: string }
      | undefined
    if (next) setDefaultAccount(db, next.id)
  }
}
