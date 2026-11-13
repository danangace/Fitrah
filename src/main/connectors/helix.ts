import type { ExternalPage, ExternalQuery, ExternalTicket, Iteration, TestResult } from '../../shared/connectors'
import { UserError } from '../errors'
import { redactTokens } from './secrets'
import { tiptapToMarkdown } from './tiptap'

type Fetch = typeof fetch

export type HelixOptions = {
  baseUrl: string
  token: string
  /** Replaceable in tests. */
  fetch?: Fetch
  /** Wait between a `503 busy` and its one retry; replaceable in tests. */
  sleep?: (ms: number) => Promise<void>
  timeoutMs?: number
}

const REQUEST_TIMEOUT_MS = 20_000
const EXPIRY_WARNING_DAYS = 30
/** Helix allows `limit` 1–200; the list asks for a modest page. */
export const PAGE_SIZE = 50

const isLocalHost = (host: string) => host === 'localhost' || host === '127.0.0.1'

/** The base URL must be https (localhost may be http, for development); returns it without a trailing slash. */
export function normalizeBaseUrl(input: string): string {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    throw new UserError('invalid_base_url', 'That is not a web address. Use something like https://project.sid.id')
  }
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocalHost(url.hostname))) {
    throw new UserError('invalid_base_url', 'Helix must be reached over https')
  }
  return url.origin
}

const asRecord = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})
const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null)

/** Defects and bugs follow the defect workflow; everything else is a task. */
export function ticketKind(type: string): 'task' | 'defect' {
  return /^(defect|bug)/i.test(type) ? 'defect' : 'task'
}

export class HelixClient {
  private readonly base: string
  private readonly token: string
  private readonly doFetch: Fetch
  private readonly sleep: (ms: number) => Promise<void>
  private readonly timeoutMs: number

  constructor(options: HelixOptions) {
    this.base = normalizeBaseUrl(options.baseUrl)
    this.token = options.token
    this.doFetch = options.fetch ?? fetch
    this.sleep = options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)))
    this.timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS
  }

  ticketUrl(key: string): string {
    return `${this.base}/tickets/${encodeURIComponent(key)}`
  }

  /** GET one path; maps Helix's errors to messages a person can act on. Never follows a redirect (it could carry the token elsewhere). */
  private async get(path: string, retried = false): Promise<Record<string, unknown>> {
    let res: Response
    try {
      res = await this.doFetch(`${this.base}${path}`, {
        method: 'GET',
        redirect: 'manual',
        headers: { Authorization: `Bearer ${this.token}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(this.timeoutMs),
      })
    } catch {
      throw new UserError('helix_unreachable', `Cannot reach Helix at ${this.base}.`)
    }
    if (res.status >= 300 && res.status < 400) {
      throw new UserError('helix_redirect', `Helix at ${this.base} redirected the request. Check the address.`)
    }
    if (res.status === 503 && !retried) {
      const wait = Math.min(Number(res.headers.get('Retry-After')) || 2, 10)
      await this.sleep(wait * 1000)
      return this.get(path, true)
    }
    const body = asRecord(await res.json().catch(() => ({})))
    if (res.ok) return body
    const code = str(body.error) ?? str(asRecord(body.error).code) ?? ''
    if (res.status === 401) throw new UserError('helix_token', 'Helix token is missing, wrong or expired. Create a new read-only token.')
    if (res.status === 403) throw new UserError('helix_forbidden', 'This token cannot read that. Use a read_only token.')
    if (res.status === 404) throw new UserError('helix_not_found', 'Ticket not found (or not visible to this token).', 404)
    if (res.status === 429) throw new UserError('helix_rate_limited', 'Helix is rate limiting requests. Try again in a minute.')
    if (res.status === 503) throw new UserError('helix_busy', 'Helix is busy. Try again in a moment.')
    throw new UserError('helix_error', redactTokens(`Helix answered ${res.status}${code ? ` (${code})` : ''}.`))
  }

  /** Who the token belongs to, its scope and expiry. Warns about a token that can write or is about to expire. */
  async test(now = new Date()): Promise<TestResult> {
    const data = asRecord((await this.get('/api/auth/me')).data)
    const token = asRecord(data.token)
    const scope = str(token.scope) ?? 'unknown'
    const capabilities = Array.isArray(token.capabilities) ? token.capabilities.filter((c): c is string => typeof c === 'string') : []
    const expiresAt = str(token.expires_at)
    const warnings: string[] = []
    if (scope !== 'read_only') warnings.push(`This token can do more than read (scope ${scope}). A read_only token is safer; Nakoda only reads.`)
    if (!capabilities.includes('read')) warnings.push('This token cannot read tickets.')
    if (expiresAt) {
      const days = Math.floor((new Date(expiresAt).getTime() - now.getTime()) / 86_400_000)
      if (days < 0) warnings.push('This token has expired. Create a new one.')
      else if (days < EXPIRY_WARNING_DAYS) warnings.push(`This token expires in ${days} day${days === 1 ? '' : 's'}. Helix cannot renew it; create a new one before then.`)
    }
    return {
      ok: true,
      owner: { id: Number(data.id) || 0, name: str(data.name) ?? '', username: str(data.username) ?? '' },
      scope,
      capabilities,
      expiresAt,
      warnings,
    }
  }

  async boards(): Promise<{ id: number; name: string }[]> {
    const rows = (await this.get('/api/boards/')).data
    return (Array.isArray(rows) ? rows : []).map(asRecord).map((b) => ({ id: Number(b.id), name: str(b.name) ?? `Board ${b.id}` }))
  }

  async iterations(boardId: number): Promise<Iteration[]> {
    if (!Number.isInteger(boardId)) throw new UserError('invalid_board', 'Pick a board first')
    const rows = (await this.get(`/api/boards/${boardId}/milestones`)).data
    return (Array.isArray(rows) ? rows : []).map(asRecord).map((m) => ({ id: Number(m.id), name: str(m.name) ?? `Iteration ${m.id}`, status: str(m.status) ?? '' }))
  }

  /**
   * The External list. Uses search (paged, filterable), never the whole-board endpoint. Filters are
   * numbers we checked ourselves: Helix ignores a bad filter value and would answer with everything.
   */
  async list(query: ExternalQuery & { meId: number }): Promise<ExternalPage> {
    const params = new URLSearchParams({ page: String(Math.max(1, query.page ?? 1)), limit: String(PAGE_SIZE) })
    if (query.mine !== false) params.set('assignee_id', String(query.meId))
    if (query.boardId !== undefined) {
      if (!Number.isInteger(query.boardId)) throw new UserError('invalid_board', 'Unknown board')
      params.set('board_id', String(query.boardId))
    }
    if (query.iterationId !== undefined) {
      if (!Number.isInteger(query.iterationId)) throw new UserError('invalid_iteration', 'Unknown iteration')
      params.set('milestone_id', String(query.iterationId))
    }
    const body = await this.get(`/api/search?${params}`)
    const rows = Array.isArray(body.data) ? body.data : []
    return {
      items: rows.map(asRecord).filter((r) => r.archived !== true).map((r) => this.listItem(r)),
      total: Number(body.total) || 0,
      page: Number(body.page) || 1,
      limit: Number(body.limit) || PAGE_SIZE,
    }
  }

  private listItem(r: Record<string, unknown>): ExternalTicket {
    const key = str(r.ticket_key) ?? String(r.id)
    const type = str(r.type) ?? 'task'
    return {
      key,
      title: str(r.title) ?? key,
      kind: ticketKind(type),
      type,
      status: str(r.status) ?? '',
      priority: str(r.priority),
      board: str(r.board_name),
      iteration: str(r.milestone_name),
      assignee: str(asRecord(r.assignee).name),
      dueDate: str(r.due_date),
      url: this.ticketUrl(key),
    }
  }

  /** The full ticket, always read fresh (a list row has no rich text). */
  async ticket(key: string): Promise<HelixTicket> {
    if (!/^[A-Za-z0-9_-]+$/.test(key)) throw new UserError('invalid_ticket_key', 'That is not a ticket key')
    return mapTicket((await this.get(`/api/tickets/${encodeURIComponent(key)}`)).data, this.ticketUrl(key))
  }
}

export type HelixTicket = {
  key: string
  title: string
  kind: 'task' | 'defect'
  type: string
  status: string
  priority: string | null
  severity: string | null
  environment: string | null
  board: string | null
  /** As Helix names it (`Iteration 15`). */
  iterationName: string | null
  /** Nakoda's short form (`i-15`), null when the name does not look like `Iteration N`. */
  iteration: string | null
  /** Markdown, in reading order; for a defect: steps, expected, actual. */
  description: string
  /** Every PRD / Figma link found in the ticket's custom fields. */
  prdLinks: string[]
  figmaLinks: string[]
  url: string
}

/** `Iteration 15` → `i-15`, `Iteration 14b` → `i-14b`. */
export function iterationShort(name: string | null): string | null {
  const m = name?.match(/^iteration\s+(\d+[a-z]?)$/i)
  return m ? `i-${m[1]?.toLowerCase()}` : null
}

const urlsOf = (value: unknown): string[] =>
  typeof value === 'string' ? value.split(/[,\s]+/).filter((u) => /^https?:\/\//i.test(u)) : []

const SECTIONS: [field: string, heading: string][] = [
  ['description', 'Description'],
  ['objective', 'Objective'],
  ['scope', 'Scope'],
  ['acceptance_criteria', 'Acceptance criteria'],
  ['steps_to_reproduce', 'Steps to reproduce'],
  ['expected_behavior', 'Expected behavior'],
  ['actual_behavior', 'Actual behavior'],
  ['root_cause', 'Root cause'],
]

export function mapTicket(raw: unknown, url: string): HelixTicket {
  const t = asRecord(raw)
  const type = str(t.type) ?? 'task'
  const fields = (Array.isArray(t.fields) ? t.fields : []).map(asRecord)
  const field = (name: string) => fields.filter((f) => f.field_key === name).flatMap((f) => urlsOf(f.field_value))
  const iterationName = str(asRecord(t.milestone).name)
  const description = SECTIONS.map(([key, heading]) => [heading, tiptapToMarkdown(t[key])] as const)
    .filter(([, md]) => md !== '')
    .map(([heading, md]) => `## ${heading}\n\n${md}`)
    .join('\n\n')
  return {
    key: str(t.ticket_key) ?? '',
    title: str(t.title) ?? '',
    kind: ticketKind(type),
    type,
    status: str(t.status) ?? '',
    priority: str(t.priority),
    severity: str(t.severity),
    environment: str(t.environment),
    board: str(asRecord(t.board).name),
    iterationName,
    iteration: iterationShort(iterationName),
    description,
    prdLinks: [...field('prd_links'), ...urlsOf(t.prd_link)],
    figmaLinks: [...field('figma_links'), ...urlsOf(t.figma_link)],
    url,
  }
}
