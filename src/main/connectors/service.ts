import { randomUUID } from 'node:crypto'
import { z } from 'zod/v4'
import { type Connector, ConnectorInput, type ExternalPage, type ExternalQuery, type TestResult, TokenSource } from '../../shared/connectors'
import { UserError } from '../errors'
import { nowIso } from '../paths'
import type { Db } from '../sqlite/db'
import { HelixClient, type HelixTicket, normalizeBaseUrl } from './helix'
import { type SecretStore, tokenHint } from './secrets'

const KEY = 'connectors'
const STORED_TOKEN = /^sidpjm_[a-f0-9]{64}$/
/** Only Helix variables may be read from the environment, so a connection cannot be pointed at, say, an AWS key. */
const ENV_NAME = /^SIDPJM_[A-Z0-9_]+$/
/** Nakoda only reads; the author token is never used by it (and is kept out of chats). */
export const AUTHOR_TOKEN_VAR = 'SIDPJM_PAT_AUTHOR_TICKET'

const Row = z.object({
  id: z.string(),
  kind: z.literal('helix'),
  label: z.string(),
  baseUrl: z.string(),
  tokenSource: TokenSource,
  lastCheckedAt: z.string().nullable(),
})
type Row = z.infer<typeof Row>

const LIST_CACHE_MS = 60_000
const ME_CACHE_MS = 10 * 60_000

export type ConnectorServiceOptions = { fetch?: typeof fetch; env?: NodeJS.ProcessEnv; sleep?: (ms: number) => Promise<void> }

export class ConnectorService {
  private readonly env: NodeJS.ProcessEnv
  private readonly lists = new Map<string, { at: number; page: ExternalPage }>()
  private readonly me = new Map<string, { at: number; id: number }>()

  constructor(
    private readonly db: Db,
    private readonly secrets: SecretStore,
    private readonly options: ConnectorServiceOptions = {},
  ) {
    this.env = options.env ?? process.env
  }

  private rows(): Row[] {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(KEY) as { value: string } | undefined
    if (!row) return []
    const parsed = z.array(Row).safeParse(JSON.parse(row.value))
    return parsed.success ? parsed.data : []
  }

  private save(rows: Row[]): void {
    this.db
      .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value')
      .run(KEY, JSON.stringify(rows))
  }

  private find(id: string): Row {
    const row = this.rows().find((r) => r.id === id)
    if (!row) throw new UserError('connector_not_found', 'That connection does not exist', 404)
    return row
  }

  private token(row: Row): string | null {
    return row.tokenSource.kind === 'stored' ? this.secrets.getToken(row.id) : (this.env[row.tokenSource.name] ?? null)
  }

  private view(row: Row): Connector {
    const token = this.token(row)
    return { ...row, tokenHint: token ? tokenHint(token) : null }
  }

  list(): Connector[] {
    return this.rows().map((r) => this.view(r))
  }

  /** Names (never values) of Helix variables in the environment that a connection may use. */
  envNames(): string[] {
    return Object.keys(this.env)
      .filter((k) => ENV_NAME.test(k) && k !== AUTHOR_TOKEN_VAR && this.env[k])
      .toSorted()
  }

  private source(input: ConnectorInput, id: string, current?: Row): TokenSource {
    const token = input.token?.trim()
    const envName = input.envName?.trim()
    if (token && envName) throw new UserError('invalid_token_source', 'Paste a token or pick a variable, not both')
    if (token) {
      if (!STORED_TOKEN.test(token)) throw new UserError('invalid_token', 'That does not look like a Helix token (sidpjm_ and 64 characters)')
      this.secrets.setToken(id, token)
      return { kind: 'stored' }
    }
    if (envName) {
      if (!ENV_NAME.test(envName) || envName === AUTHOR_TOKEN_VAR) {
        throw new UserError('invalid_env_name', `Use a read-token variable named SIDPJM_… (not ${AUTHOR_TOKEN_VAR})`)
      }
      if (!this.env[envName]) throw new UserError('env_missing', `${envName} is not set in the environment Nakoda runs in`)
      this.secrets.deleteToken(id)
      return { kind: 'env', name: envName }
    }
    if (current) return current.tokenSource
    throw new UserError('token_required', 'Paste a read-only token or pick an existing variable')
  }

  create(raw: unknown): Connector {
    const input = parse(raw)
    const id = randomUUID()
    const row: Row = {
      id,
      kind: 'helix',
      label: input.label,
      baseUrl: normalizeBaseUrl(input.baseUrl),
      tokenSource: this.source(input, id),
      lastCheckedAt: null,
    }
    this.save([...this.rows(), row])
    return this.view(row)
  }

  update(id: string, raw: unknown): Connector {
    const current = this.find(id)
    const input = parse(raw)
    const next: Row = { ...current, label: input.label, baseUrl: normalizeBaseUrl(input.baseUrl), tokenSource: this.source(input, id, current), lastCheckedAt: null }
    this.save(this.rows().map((r) => (r.id === id ? next : r)))
    this.forget(id)
    return this.view(next)
  }

  remove(id: string): void {
    this.find(id)
    this.secrets.deleteToken(id)
    this.save(this.rows().filter((r) => r.id !== id))
    this.forget(id)
  }

  private forget(id: string): void {
    this.me.delete(id)
    for (const k of this.lists.keys()) if (k.startsWith(`${id}|`)) this.lists.delete(k)
  }

  private client(id: string): HelixClient {
    const row = this.find(id)
    const token = this.token(row)
    if (!token) {
      throw new UserError(
        'token_missing',
        row.tokenSource.kind === 'env' ? `${row.tokenSource.name} is not set in the environment Nakoda runs in` : 'This connection has no token. Edit it and paste one.',
      )
    }
    return new HelixClient({ baseUrl: row.baseUrl, token, ...this.options })
  }

  async test(id: string): Promise<TestResult> {
    const result = await this.client(id).test()
    this.me.set(id, { at: Date.now(), id: result.owner.id })
    this.save(this.rows().map((r) => (r.id === id ? { ...r, lastCheckedAt: nowIso() } : r)))
    return result
  }

  boards(id: string) {
    return this.client(id).boards()
  }

  iterations(id: string, boardId: number) {
    return this.client(id).iterations(boardId)
  }

  async tickets(id: string, query: ExternalQuery, refresh = false): Promise<ExternalPage> {
    const cacheKey = `${id}|${JSON.stringify(query)}`
    const hit = this.lists.get(cacheKey)
    if (!refresh && hit && Date.now() - hit.at < LIST_CACHE_MS) return hit.page
    const client = this.client(id)
    let me = this.me.get(id)
    if (!me || Date.now() - me.at > ME_CACHE_MS) {
      me = { at: Date.now(), id: (await client.test()).owner.id }
      this.me.set(id, me)
    }
    const page = await client.list({ ...query, meId: me.id })
    this.lists.set(cacheKey, { at: Date.now(), page })
    return page
  }

  ticket(id: string, key: string): Promise<HelixTicket> {
    return this.client(id).ticket(key)
  }
}

function parse(raw: unknown): ConnectorInput {
  const parsed = ConnectorInput.safeParse(raw)
  if (!parsed.success) throw new UserError('invalid_connector', parsed.error.issues[0]?.message ?? 'Invalid connection')
  return parsed.data
}
