import { z } from 'zod/v4'
import { AccountUsage, ChatStatus, UsageWindow, WorkspaceStatus } from './schemas'

/**
 * Fitrah's own chat events. The UI only understands these; each agent adapter translates its
 * SDK messages into them (Codex-ready seam, Design §7.3). Nothing in the UI imports an agent SDK.
 */
export const ChatEvent = z.discriminatedUnion('type', [
  z.object({ type: z.literal('user.message'), chatId: z.string(), text: z.string(), at: z.string() }),
  z.object({ type: z.literal('session.started'), chatId: z.string(), sessionId: z.string(), model: z.string() }),
  z.object({ type: z.literal('message.text'), chatId: z.string(), text: z.string() }),
  z.object({
    type: z.literal('tool.started'),
    chatId: z.string(),
    toolUseId: z.string(),
    name: z.string(),
    summary: z.string(),
  }),
  z.object({
    type: z.literal('tool.result'),
    chatId: z.string(),
    toolUseId: z.string(),
    isError: z.boolean(),
    summary: z.string(),
  }),
  z.object({
    type: z.literal('approval.requested'),
    chatId: z.string(),
    approvalId: z.string(),
    tool: z.string(),
    summary: z.string(),
    reason: z.string(),
  }),
  z.object({
    type: z.literal('approval.resolved'),
    chatId: z.string(),
    approvalId: z.string(),
    decision: z.enum(['allow', 'deny']),
  }),
  z.object({ type: z.literal('status'), chatId: z.string(), status: ChatStatus }),
  /** Usage limits reported with a turn (5-hour, weekly…); saved on the chat's account. */
  z.object({ type: z.literal('usage'), chatId: z.string(), windows: z.array(UsageWindow) }),
  z.object({
    type: z.literal('turn.done'),
    chatId: z.string(),
    ok: z.boolean(),
    numTurns: z.number(),
  }),
  z.object({
    type: z.literal('error'),
    chatId: z.string(),
    kind: z.enum(['rate_limit', 'auth', 'other']),
    message: z.string(),
  }),
])
export type ChatEvent = z.infer<typeof ChatEvent>

/** Messages the UI sends over the chat WebSocket. */
export const ClientMessage = z.discriminatedUnion('type', [
  z.object({ type: z.literal('send'), chatId: z.string(), text: z.string().min(1) }),
  z.object({ type: z.literal('approve'), approvalId: z.string(), decision: z.enum(['allow', 'deny']) }),
  z.object({ type: z.literal('stop'), chatId: z.string() }),
])
export type ClientMessage = z.infer<typeof ClientMessage>

/** App-wide events on the SSE stream (sidebar badges, docs live reload, setup logs). */
export const AppEvent = z.discriminatedUnion('type', [
  z.object({ type: z.literal('workspace.status'), workspaceId: z.string(), status: WorkspaceStatus }),
  z.object({ type: z.literal('workspace.setup'), workspaceId: z.string(), line: z.string(), done: z.boolean() }),
  z.object({ type: z.literal('docs.changed'), path: z.string() }),
  z.object({ type: z.literal('account.warning'), accountId: z.string(), warning: z.string().nullable() }),
  z.object({ type: z.literal('account.usage'), accountId: z.string(), usage: AccountUsage }),
])
export type AppEvent = z.infer<typeof AppEvent>
