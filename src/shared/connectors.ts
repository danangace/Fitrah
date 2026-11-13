import { z } from 'zod/v4'

/** A connection to an outside task system. The token is never part of this; only where it comes from. */
export const TokenSource = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('stored') }),
  z.object({ kind: z.literal('env'), name: z.string() }),
])
export type TokenSource = z.infer<typeof TokenSource>

export const Connector = z.object({
  id: z.string(),
  kind: z.literal('helix'),
  label: z.string(),
  baseUrl: z.string(),
  tokenSource: TokenSource,
  /** `sidpjm_…a1b2`: enough to recognise the token, useless to use it. Null when no token is available. */
  tokenHint: z.string().nullable(),
  lastCheckedAt: z.string().nullable(),
  /** How Helix words map to ours on transfer (editable). */
  mappings: z.object({ severity: z.record(z.string(), z.string()), environment: z.record(z.string(), z.string()) }),
})
export type Connector = z.infer<typeof Connector>

/** What the user types when adding or changing a connection. Exactly one of `token` / `envName` sets the source. */
export const ConnectorInput = z.object({
  kind: z.literal('helix').default('helix'),
  label: z.string().trim().min(1, 'Give the connection a label'),
  baseUrl: z.string().trim().min(1, 'Enter the Helix address'),
  token: z.string().trim().optional(),
  envName: z.string().trim().optional(),
  mappings: z.object({ severity: z.record(z.string(), z.string()), environment: z.record(z.string(), z.string()) }).optional(),
})
export type ConnectorInput = z.infer<typeof ConnectorInput>

export const TestResult = z.object({
  ok: z.literal(true),
  owner: z.object({ id: z.number(), name: z.string(), username: z.string() }),
  scope: z.string(),
  capabilities: z.array(z.string()),
  expiresAt: z.string().nullable(),
  /** Things worth knowing, e.g. a token that can write or that expires soon. */
  warnings: z.array(z.string()),
})
export type TestResult = z.infer<typeof TestResult>

export const TicketKind = z.enum(['task', 'defect'])
export type TicketKind = z.infer<typeof TicketKind>

/** One row of the External list. Safe to show; never used to build a copy (the list is slim). */
export const ExternalTicket = z.object({
  key: z.string(),
  title: z.string(),
  kind: TicketKind,
  type: z.string(),
  status: z.string(),
  priority: z.string().nullable(),
  board: z.string().nullable(),
  iteration: z.string().nullable(),
  assignee: z.string().nullable(),
  dueDate: z.string().nullable(),
  url: z.string(),
})
export type ExternalTicket = z.infer<typeof ExternalTicket>

export const ExternalPage = z.object({
  items: z.array(ExternalTicket),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
})
export type ExternalPage = z.infer<typeof ExternalPage>

export const ExternalFilters = z.object({
  boards: z.array(z.object({ id: z.number(), name: z.string() })),
})
export type ExternalFilters = z.infer<typeof ExternalFilters>

export const Iteration = z.object({ id: z.number(), name: z.string(), status: z.string() })
export type Iteration = z.infer<typeof Iteration>

export type ExternalQuery = { page?: number; boardId?: number; iterationId?: number; mine?: boolean }
