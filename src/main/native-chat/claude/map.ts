import type { AdapterEvent } from '../types'
import { summarizeTool } from '../summarize'

/** Loose view of SDK messages: only the fields Fitrah reads (keeps the SDK out of the mapper). */
type Block = { type: string; text?: string; id?: string; name?: string; input?: unknown; tool_use_id?: string; is_error?: boolean; content?: unknown }
export type SdkLike = {
  type: string
  subtype?: string
  session_id?: string
  model?: string
  message?: { content?: Block[] | string }
  is_error?: boolean
  num_turns?: number
  result?: string
  errors?: string[]
  rate_limit_info?: { status?: string; rateLimitType?: string; resetsAt?: number }
}

const asText = (content: unknown): string => {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content.map((c) => (c && typeof c === 'object' && 'text' in c ? String((c as { text: unknown }).text) : '')).join('')
  }
  return ''
}

const short = (text: string, max = 300) => (text.length > max ? `${text.slice(0, max)}…` : text)

const isRateLimit = (text: string) => /rate limit|usage limit|limit reached|too many requests|\b429\b/i.test(text)
const isAuth = (text: string) => /not logged in|please run \/login|invalid api key|authentication|unauthorized|\b401\b/i.test(text)

/** Translate one Claude Agent SDK message into Fitrah chat events (no SDK types leak out). */
export function mapClaudeMessage(msg: SdkLike): AdapterEvent[] {
  switch (msg.type) {
    case 'system':
      return msg.subtype === 'init' && msg.session_id
        ? [{ type: 'session.started', sessionId: msg.session_id, model: msg.model ?? '' }]
        : []
    case 'assistant': {
      const blocks = Array.isArray(msg.message?.content) ? msg.message.content : []
      return blocks.flatMap((b): AdapterEvent[] => {
        if (b.type === 'text' && b.text?.trim()) return [{ type: 'message.text', text: b.text }]
        if (b.type === 'tool_use' && b.id && b.name) {
          const input = (b.input && typeof b.input === 'object' ? b.input : {}) as Record<string, unknown>
          return [{ type: 'tool.started', toolUseId: b.id, name: b.name, summary: summarizeTool(b.name, input) }]
        }
        return []
      })
    }
    case 'user': {
      const blocks = Array.isArray(msg.message?.content) ? msg.message.content : []
      return blocks.flatMap((b): AdapterEvent[] =>
        b.type === 'tool_result' && b.tool_use_id
          ? [{ type: 'tool.result', toolUseId: b.tool_use_id, isError: b.is_error === true, summary: short(asText(b.content)) }]
          : [],
      )
    }
    case 'rate_limit_event': {
      const info = msg.rate_limit_info
      if (info?.status !== 'rejected') return []
      const reset = info.resetsAt ? ` until ${new Date(info.resetsAt * 1000).toLocaleString()}` : ''
      return [{ type: 'error', kind: 'rate_limit', message: `Usage limit reached (${info.rateLimitType ?? 'limit'})${reset}.` }]
    }
    case 'result': {
      const ok = msg.subtype === 'success' && msg.is_error !== true
      const events: AdapterEvent[] = []
      if (!ok) {
        const text = [msg.result ?? '', ...(msg.errors ?? [])].join(' ').trim() || msg.subtype || 'Turn failed'
        events.push({ type: 'error', kind: isRateLimit(text) ? 'rate_limit' : isAuth(text) ? 'auth' : 'other', message: short(text, 500) })
      }
      events.push({ type: 'turn.done', ok, numTurns: msg.num_turns ?? 0 })
      return events
    }
    default:
      return []
  }
}
