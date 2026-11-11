import type { ChatEvent } from '../../shared/events'
import type { AgentId } from '../../shared/schemas'

/** What an agent wants to do that may need the user's OK. */
export type ToolRequest = { tool: string; input: Record<string, unknown> }

export type ApprovalAnswer = 'allow' | 'deny'

/** Distributive omit, so each event variant keeps its own fields. */
type OmitChatId<T> = T extends unknown ? Omit<T, 'chatId'> : never
export type AdapterEvent = OmitChatId<ChatEvent>

export type TurnOptions = {
  /** The workspace worktree; the agent works only here. */
  cwd: string
  /** Account login folder (CLAUDE_CONFIG_DIR / CODEX_HOME). */
  configDir: string
  model: string
  /** Continue this agent session when set (resume). */
  sessionId: string | null
  prompt: string
  /** Every adapter event, already translated to Fitrah's event model. */
  onEvent: (event: AdapterEvent) => void
  /** Called for each tool use the agent asks permission for. */
  onToolRequest: (request: ToolRequest) => Promise<ApprovalAnswer>
}

export type Turn = {
  /** Stop the running turn. */
  stop: () => void
  /** Resolves when the turn has ended (finished, stopped or failed). */
  done: Promise<void>
}

/**
 * One adapter per agent (Codex-ready seam, Design §7.3). Only adapters import an agent SDK;
 * the rest of Fitrah, and the whole UI, only sees Fitrah chat events.
 */
export type AgentAdapter = {
  agent: AgentId
  startTurn: (options: TurnOptions) => Turn
}
