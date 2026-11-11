import type { ChatEvent } from '../../shared/events'
import type { ChatStatus, WorkspaceStatus } from '../../shared/schemas'
import { saveAccountUsage, setAccountWarning } from '../accounts/service'
import type { EventBus } from '../events/bus'
import type { ChatService } from '../native-chat/service'
import type { Db } from '../sqlite/db'

export const RATE_LIMIT_PREFIX = 'Rate limit: '

/** Most urgent first: a workspace shows the most urgent state of its chats (AC-N1). */
const PRIORITY: WorkspaceStatus[] = ['needs_approval', 'working', 'error', 'waiting', 'done', 'idle']

export function aggregate(statuses: ChatStatus[]): WorkspaceStatus {
  for (const status of PRIORITY) if (statuses.includes(status)) return status
  return 'idle'
}

/**
 * Derives each workspace's status from its chats, pushes changes to the UI over SSE, and
 * marks an account when it hits its usage limit (AC-N3).
 */
export class StatusTracker {
  private last = new Map<string, WorkspaceStatus>()

  constructor(
    private db: Db,
    private bus: EventBus,
    chats: ChatService,
  ) {
    chats.subscribe((event) => this.onChatEvent(event))
    chats.onDelete((workspaceId) => this.refresh(workspaceId))
  }

  statusOf = (workspaceId: string): WorkspaceStatus => {
    const rows = this.db.prepare('SELECT status FROM chats WHERE workspace_id = ?').all(workspaceId) as { status: ChatStatus }[]
    return aggregate(rows.map((r) => r.status))
  }

  private refresh(workspaceId: string): void {
    const status = this.statusOf(workspaceId)
    if (this.last.get(workspaceId) === status) return
    this.last.set(workspaceId, status)
    this.bus.emit({ type: 'workspace.status', workspaceId, status })
  }

  private onChatEvent(event: ChatEvent): void {
    const chat = this.db.prepare('SELECT workspace_id, account_id FROM chats WHERE id = ?').get(event.chatId) as
      | { workspace_id: string; account_id: string | null }
      | undefined
    if (!chat) return

    if (event.type === 'status') {
      const status = this.statusOf(chat.workspace_id)
      if (this.last.get(chat.workspace_id) !== status) {
        this.last.set(chat.workspace_id, status)
        this.bus.emit({ type: 'workspace.status', workspaceId: chat.workspace_id, status })
      }
    }
    if (chat.account_id && event.type === 'usage') {
      const usage = saveAccountUsage(this.db, chat.account_id, event.windows)
      if (usage) this.bus.emit({ type: 'account.usage', accountId: chat.account_id, usage })
    }
    if (chat.account_id && event.type === 'error' && event.kind === 'rate_limit') {
      const warning = `${RATE_LIMIT_PREFIX}${event.message}`
      setAccountWarning(this.db, chat.account_id, warning)
      this.bus.emit({ type: 'account.warning', accountId: chat.account_id, warning })
    }
    // A successful turn clears a rate-limit warning (but never a login warning).
    if (chat.account_id && event.type === 'turn.done' && event.ok) {
      const row = this.db.prepare('SELECT warning FROM accounts WHERE id = ?').get(chat.account_id) as { warning: string | null } | undefined
      if (row?.warning?.startsWith(RATE_LIMIT_PREFIX)) {
        setAccountWarning(this.db, chat.account_id, null)
        this.bus.emit({ type: 'account.warning', accountId: chat.account_id, warning: null })
      }
    }
  }
}
