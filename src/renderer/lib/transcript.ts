import type { ChatEvent } from '../../shared/events'

export type ToolItem = { kind: 'tool'; id: string; name: string; summary: string; result: { isError: boolean; summary: string } | null }
export type ApprovalItem = {
  kind: 'approval'
  id: string
  tool: string
  summary: string
  reason: string
  decision: 'allow' | 'deny' | null
}
export type Item =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; text: string }
  | ToolItem
  | ApprovalItem
  | { kind: 'error'; message: string; errorKind: string }
  | { kind: 'turn'; ok: boolean }

/** Fold a chat's event stream into the list of things the chat pane shows. */
export function toItems(events: ChatEvent[]): Item[] {
  const items: Item[] = []
  const tools = new Map<string, ToolItem>()
  const approvals = new Map<string, ApprovalItem>()
  for (const e of events) {
    switch (e.type) {
      case 'user.message':
        items.push({ kind: 'user', text: e.text })
        break
      case 'message.text':
        items.push({ kind: 'assistant', text: e.text })
        break
      case 'tool.started': {
        const item: ToolItem = { kind: 'tool', id: e.toolUseId, name: e.name, summary: e.summary, result: null }
        tools.set(e.toolUseId, item)
        items.push(item)
        break
      }
      case 'tool.result': {
        const tool = tools.get(e.toolUseId)
        if (tool) tool.result = { isError: e.isError, summary: e.summary }
        break
      }
      case 'approval.requested': {
        const item: ApprovalItem = { kind: 'approval', id: e.approvalId, tool: e.tool, summary: e.summary, reason: e.reason, decision: null }
        approvals.set(e.approvalId, item)
        items.push(item)
        break
      }
      case 'approval.resolved': {
        const a = approvals.get(e.approvalId)
        if (a) a.decision = e.decision
        break
      }
      case 'error':
        items.push({ kind: 'error', message: e.message, errorKind: e.kind })
        break
      case 'turn.done':
        items.push({ kind: 'turn', ok: e.ok })
        break
      default:
        break
    }
  }
  return items
}
