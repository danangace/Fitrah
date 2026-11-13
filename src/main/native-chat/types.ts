import type { ChatEvent } from '../../shared/events'
import type { ModelOption, AgentId, Effort } from '../../shared/schemas'

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
  /** Reasoning effort; null = the agent's default. */
  effort: Effort | null
  /** Continue this agent session when set (resume). */
  sessionId: string | null
  prompt: string
  /** Workspace facts (PRD, Figma, iteration, module, branch…) added to the agent's system prompt. */
  context: string
  /** Every adapter event, already translated to Nakoda's event model. */
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
 * the rest of Nakoda, and the whole UI, only sees Nakoda chat events.
 */
export type AgentAdapter = {
  agent: AgentId
  startTurn: (options: TurnOptions) => Turn
  /** Rebuild a chat's events from the agent's own transcript (after a restart). */
  readHistory?: (configDir: string, sessionId: string) => AdapterEvent[]
  /** The models this login may use (no message is sent, nothing is billed). */
  listModels?: (configDir: string) => Promise<ModelOption[]>
}
