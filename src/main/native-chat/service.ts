import { randomUUID } from 'node:crypto'
import type { ChatEvent } from '../../shared/events'
import { type AgentId, type Chat, ChatInput, ChatSettingsInput, type ChatStatus, type Effort, type PermissionMode } from '../../shared/schemas'
import { getAccount } from '../accounts/service'
import { UserError } from '../errors'
import { nowIso } from '../paths'
import type { Db } from '../sqlite/db'
import { getRepo, getSettings } from '../settings/store'
import { getWorkspace } from '../workspaces/service'
import { getWorkflow } from '../workflows/service'
import { workspaceContext } from './context'
import type { AdapterEvent, AgentAdapter, ApprovalAnswer, ToolRequest, Turn } from './types'

type ChatRow = {
  id: string
  workspace_id: string
  agent: AgentId
  account_id: string | null
  model: string
  session_id: string | null
  permission_mode: PermissionMode
  effort: Effort | null
  status: ChatStatus
  title: string
  created_at: string
  last_active_at: string | null
}

const toChat = (r: ChatRow): Chat => ({
  id: r.id,
  workspaceId: r.workspace_id,
  agent: r.agent,
  accountId: r.account_id,
  model: r.model,
  sessionId: r.session_id,
  permissionMode: r.permission_mode === ('default' as string) ? 'accept-edits' : r.permission_mode,
  effort: r.effort,
  status: r.status,
  title: r.title,
  createdAt: r.created_at,
  lastActiveAt: r.last_active_at,
})

export type ToolDecider = (chat: Chat, request: ToolRequest) => Promise<ApprovalAnswer>
type Listener = (event: ChatEvent) => void

/** Runs chats: one turn at a time per chat, events fanned out to every open UI. */
export class ChatService {
  private listeners = new Set<Listener>()
  private turns = new Map<string, Turn>()
  private history = new Map<string, ChatEvent[]>()
  private stopHooks = new Set<(chatId: string) => void>()
  private deleteHooks = new Set<(workspaceId: string) => void>()

  constructor(
    private db: Db,
    private adapters: Partial<Record<AgentId, AgentAdapter>>,
    /** Decides tool requests (approval rules + cards, T23). Default: ask is not wired → deny. */
    private decide: ToolDecider = async () => 'deny',
  ) {
    // A restart ends any running turn: those chats wait for the next message.
    this.db.prepare("UPDATE chats SET status = 'waiting' WHERE status IN ('working', 'needs_approval')").run()
  }

  setDecider(decide: ToolDecider): void {
    this.decide = decide
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  create(input: unknown): Chat {
    const parsed = ChatInput.safeParse(input)
    if (!parsed.success) throw new UserError('invalid_chat', parsed.error.issues[0]?.message ?? 'Invalid chat')
    const data = parsed.data
    const ws = getWorkspace(this.db, data.workspaceId)
    if (ws.archivedAt) throw new UserError('workspace_archived', 'This workspace is archived', 409)
    if (!this.adapters[data.agent]) throw new UserError('agent_not_supported', `${data.agent} is not supported yet`)
    const account = getAccount(this.db, data.accountId)
    if (account.agent !== data.agent) throw new UserError('account_mismatch', 'That account belongs to another agent')
    const id = randomUUID()
    const title = data.title?.trim() || `${data.agent} · ${data.model}`
    this.db
      .prepare(
        "INSERT INTO chats (id, workspace_id, agent, account_id, model, title, permission_mode, created_at) VALUES (?, ?, ?, ?, ?, ?, 'accept-edits', ?)",
      )
      .run(id, ws.id, data.agent, account.id, data.model, title, nowIso())
    return this.get(id)
  }

  get(id: string): Chat {
    const row = this.db.prepare('SELECT * FROM chats WHERE id = ?').get(id) as ChatRow | undefined
    if (!row) throw new UserError('chat_not_found', 'Chat not found', 404)
    return toChat(row)
  }

  /** Model / effort / permission from the composer pickers; used from the next turn (permission: right away). */
  update(chatId: string, input: unknown): Chat {
    this.get(chatId)
    const parsed = ChatSettingsInput.safeParse(input)
    if (!parsed.success) throw new UserError('invalid_chat_settings', parsed.error.issues[0]?.message ?? 'Invalid settings')
    const { model, effort, permissionMode } = parsed.data
    if (model !== undefined) this.db.prepare('UPDATE chats SET model = ? WHERE id = ?').run(model, chatId)
    if (effort !== undefined) this.db.prepare('UPDATE chats SET effort = ? WHERE id = ?').run(effort, chatId)
    if (permissionMode !== undefined) this.db.prepare('UPDATE chats SET permission_mode = ? WHERE id = ?').run(permissionMode, chatId)
    return this.get(chatId)
  }

  list(workspaceId: string): Chat[] {
    return (this.db.prepare('SELECT * FROM chats WHERE workspace_id = ? ORDER BY created_at').all(workspaceId) as ChatRow[]).map(
      toChat,
    )
  }

  events(chatId: string): ChatEvent[] {
    const chat = this.get(chatId)
    if (!this.history.has(chatId) && chat.sessionId && chat.accountId) {
      // After a restart: read the conversation back from the agent's transcript (AC-C7).
      const account = getAccount(this.db, chat.accountId)
      const past = this.adapters[chat.agent]?.readHistory?.(account.configDir, chat.sessionId) ?? []
      this.history.set(chatId, past.map((e) => ({ ...e, chatId }) as ChatEvent))
    }
    return this.history.get(chatId) ?? []
  }

  /** Seed a chat's history (e.g. read back from the agent transcript after a restart, T24). */
  seedHistory(chatId: string, events: ChatEvent[]): void {
    if (!this.history.has(chatId)) this.history.set(chatId, events)
  }

  isRunning(chatId: string): boolean {
    return this.turns.has(chatId)
  }

  send(chatId: string, text: string): void {
    const chat = this.get(chatId)
    if (this.turns.has(chatId)) throw new UserError('chat_busy', 'Claude is still working on the last message', 409)
    if (!text.trim()) throw new UserError('empty_message', 'Type a message first')
    const adapter = this.adapters[chat.agent]
    if (!adapter) throw new UserError('agent_not_supported', `${chat.agent} is not supported yet`)
    if (!chat.accountId) throw new UserError('no_account', 'This chat has no account; pick one', 409)
    const account = getAccount(this.db, chat.accountId)
    const ws = getWorkspace(this.db, chat.workspaceId)

    this.emit({ type: 'user.message', chatId, text, at: nowIso() })
    this.setStatus(chatId, 'working')
    const turn = adapter.startTurn({
      cwd: ws.worktreePath,
      configDir: account.configDir,
      model: chat.model,
      effort: chat.effort,
      sessionId: chat.sessionId,
      prompt: text,
      context: workspaceContext(
        ws,
        getRepo(this.db, ws.repoId),
        getSettings(this.db),
        ws.workflowId ? getWorkflow(this.db, ws.workflowId) : null,
      ),
      onEvent: (event) => this.onAdapterEvent(chatId, event),
      onToolRequest: (request) => this.decide(this.get(chatId), request),
    })
    this.turns.set(chatId, turn)
    void turn.done.finally(() => this.turns.delete(chatId))
  }

  stop(chatId: string): void {
    for (const hook of this.stopHooks) hook(chatId)
    this.turns.get(chatId)?.stop()
  }

  /** Stops a running turn and removes the chat with its approvals; the agent's own transcript is left alone. */
  delete(chatId: string): void {
    const chat = this.get(chatId)
    this.stop(chatId)
    this.turns.delete(chatId)
    this.history.delete(chatId)
    this.db.exec('BEGIN')
    try {
      this.db.prepare('DELETE FROM approvals WHERE chat_id = ?').run(chatId)
      this.db.prepare('DELETE FROM chats WHERE id = ?').run(chatId)
      this.db.exec('COMMIT')
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
    for (const hook of this.deleteHooks) hook(chat.workspaceId)
  }

  onDelete(hook: (workspaceId: string) => void): void {
    this.deleteHooks.add(hook)
  }

  onStop(hook: (chatId: string) => void): void {
    this.stopHooks.add(hook)
  }

  /** Emit an event for a chat (also used by the approval manager). */
  emit(event: ChatEvent): void {
    const list = this.history.get(event.chatId) ?? []
    list.push(event)
    this.history.set(event.chatId, list)
    for (const listener of this.listeners) listener(event)
  }

  setStatus(chatId: string, status: ChatStatus): void {
    this.db.prepare('UPDATE chats SET status = ?, last_active_at = ? WHERE id = ?').run(status, nowIso(), chatId)
    this.emit({ type: 'status', chatId, status })
  }

  private onAdapterEvent(chatId: string, event: AdapterEvent): void {
    if (event.type === 'session.started') {
      // Persist the agent session id so the chat can resume after a restart (AC-C7).
      this.db.prepare('UPDATE chats SET session_id = ? WHERE id = ?').run(event.sessionId, chatId)
    }
    this.emit({ ...event, chatId } as ChatEvent)
    if (event.type === 'turn.done') {
      const hadError = (this.history.get(chatId) ?? []).at(-2)?.type === 'error'
      this.setStatus(chatId, event.ok ? 'done' : hadError ? 'error' : 'waiting')
    }
  }
}
