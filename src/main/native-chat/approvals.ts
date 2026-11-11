import { randomUUID } from 'node:crypto'
import type { Chat } from '../../shared/schemas'
import { UserError } from '../errors'
import type { Db } from '../sqlite/db'
import { getWorkspace } from '../workspaces/service'
import { approvalRule } from './approval-rules'
import type { ChatService } from './service'
import { summarizeTool } from './summarize'
import type { ApprovalAnswer, ToolRequest } from './types'

type Pending = { chatId: string; resolve: (answer: ApprovalAnswer) => void }

/** Applies the approval rules and turns "ask" into an Approve / Deny card in the chat. */
export class ApprovalManager {
  private pending = new Map<string, Pending>()

  constructor(
    private db: Db,
    private chats: ChatService,
  ) {}

  decide = async (chat: Chat, request: ToolRequest): Promise<ApprovalAnswer> => {
    const ws = getWorkspace(this.db, chat.workspaceId)
    const rule = approvalRule(request, ws.worktreePath, chat.permissionMode)
    if (rule.action === 'allow') return 'allow'

    const approvalId = randomUUID()
    const answer = new Promise<ApprovalAnswer>((resolveAnswer) => {
      this.pending.set(approvalId, { chatId: chat.id, resolve: resolveAnswer })
    })
    this.db
      .prepare('INSERT INTO approvals (id, chat_id, tool, input_json, requested_at) VALUES (?, ?, ?, ?, ?)')
      .run(approvalId, chat.id, request.tool, JSON.stringify(request.input), new Date().toISOString())
    this.chats.emit({
      type: 'approval.requested',
      chatId: chat.id,
      approvalId,
      tool: request.tool,
      summary: summarizeTool(request.tool, request.input),
      reason: rule.reason,
    })
    this.chats.setStatus(chat.id, 'needs_approval')
    return answer
  }

  answer = (approvalId: string, decision: ApprovalAnswer): void => {
    const pending = this.pending.get(approvalId)
    if (!pending) throw new UserError('approval_not_found', 'This approval was already answered or has expired', 404)
    this.pending.delete(approvalId)
    this.db.prepare('UPDATE approvals SET decision = ?, decided_at = ? WHERE id = ?').run(decision, new Date().toISOString(), approvalId)
    this.chats.emit({ type: 'approval.resolved', chatId: pending.chatId, approvalId, decision })
    if (![...this.pending.values()].some((p) => p.chatId === pending.chatId)) this.chats.setStatus(pending.chatId, 'working')
    pending.resolve(decision)
  }

  /** Deny everything still waiting for a chat (on stop). */
  cancelChat(chatId: string): void {
    for (const [id, p] of this.pending) if (p.chatId === chatId) this.answer(id, 'deny')
  }
}
