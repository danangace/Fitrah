import { randomUUID } from 'node:crypto'
import { z } from 'zod/v4'
import { type Connector, ConnectorInput, type ExternalPage, type ExternalTicket, type ExternalQuery, type TestResult, TokenSource } from '../../shared/connectors'
import { UserError } from '../errors'
import { nowIso } from '../paths'
import type { Db } from '../sqlite/db'
import { HelixClient, type HelixTicket, normalizeBaseUrl } from './helix'
import type { Task } from '../../shared/tasks'
import { createTask } from '../tasks/service'
import { type SecretStore, tokenHint } from './secrets'
import { DEFAULT_MAPPINGS, toTaskInput, withParent } from './transfer'

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
  /** How Helix words map to ours when a ticket is transferred; the user can edit them. */
  mappings: z.object({ severity: z.record(z.string(), z.string()), environment: z.record(z.string(), z.string()) }).optional(),
})
type Row = z.infer<typeof Row>

const LIST_CACHE_MS = 60_000
const ME_CACHE_MS = 10 * 60_000

export type ConnectorServiceOptions = { fetch?: typeof fetch; env?: NodeJS.ProcessEnv; sleep?: (ms: number) => Promise<void> }

export class ConnectorService {
  private readonly env: NodeJS.ProcessEnv
  private readonly lists = new Map<string, { at: number; page: ExternalPage }>()
  private readonly me = new Map<string, { at: number; id: number }>()
  private readonly subtasks = new Map<string, { at: number; items: ExternalTicket[] }>()

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
    return { ...row, mappings: row.mappings ?? DEFAULT_MAPPINGS, tokenHint: token ? tokenHint(token) : null }
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
      mappings: input.mappings,
    }
    this.save([...this.rows(), row])
    return this.view(row)
  }

  update(id: string, raw: unknown): Connector {
    const current = this.find(id)
    const input = parse(raw)
    const next: Row = { ...current, label: input.label, baseUrl: normalizeBaseUrl(input.baseUrl), tokenSource: this.source(input, id, current), lastCheckedAt: null, mappings: input.mappings ?? current.mappings }
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
    for (const k of this.subtasks.keys()) if (k.startsWith(`${id}|`)) this.subtasks.delete(k)
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
    const page = await client.list({ ...query, meId: await this.meId(id, client) })
    this.lists.set(cacheKey, { at: Date.now(), page })
    return page
  }

  private async meId(id: string, client: HelixClient): Promise<number> {
    let me = this.me.get(id)
    if (!me || Date.now() - me.at > ME_CACHE_MS) {
      me = { at: Date.now(), id: (await client.test()).owner.id }
      this.me.set(id, me)
    }
    return me.id
  }

  /** Subtasks assigned to you in one iteration, found through every parent in it (see HelixClient.mySubtasks). */
  async mySubtasks(id: string, query: { boardId?: number; iterationId: number }, refresh = false): Promise<ExternalTicket[]> {
    const cacheKey = `${id}|${JSON.stringify(query)}`
    const hit = this.subtasks.get(cacheKey)
    if (!refresh && hit && Date.now() - hit.at < LIST_CACHE_MS) return hit.items
    const client = this.client(id)
    const items = await client.mySubtasks({ ...query, meId: await this.meId(id, client) })
    this.subtasks.set(cacheKey, { at: Date.now(), items })
    return items
  }

  children(id: string, key: string): Promise<ExternalTicket[]> {
    return this.client(id).children(key)
  }

  ticket(id: string, key: string): Promise<HelixTicket> {
    return this.client(id).ticket(key)
  }

  /**
   * Copy one Helix ticket to our board. Always re-reads the full ticket (a list row has no rich text).
   * One-way: nothing is written back. A ticket can be copied only once.
   */
  async transfer(id: string, key: string): Promise<Task> {
    const row = this.find(id)
    const existing = this.db.prepare("SELECT id FROM tasks WHERE source = 'helix' AND external_id = ?").get(key)
    if (existing) throw new UserError('already_transferred', `${key} is already on the board`, 409)
    const client = this.client(id)
    let ticket = await client.ticket(key)
    // A subtask's description, PRD and Figma live on its parent story.
    if (ticket.parentKey) ticket = withParent(ticket, await client.ticket(ticket.parentKey))
    const workflowId = (wf: string) => (this.db.prepare('SELECT id FROM workflows WHERE id = ?').get(wf) ? wf : null)
    // With a single project there is nothing to choose; otherwise a person picks it on the card.
    const repos = this.db.prepare('SELECT id FROM repos').all() as { id: string }[]
    const input = toTaskInput(ticket, row.mappings ?? DEFAULT_MAPPINGS, { planning: workflowId('planning'), defect: workflowId('defect') }, repos.length === 1 ? (repos[0]?.id ?? null) : null)
    return createTask(this.db, input, { source: 'helix', externalId: ticket.key, externalUrl: ticket.url })
  }
}

function parse(raw: unknown): ConnectorInput {
  const parsed = ConnectorInput.safeParse(raw)
  if (!parsed.success) throw new UserError('invalid_connector', parsed.error.issues[0]?.message ?? 'Invalid connection')
  return parsed.data
}
