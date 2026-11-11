import { describe, expect, it } from 'vitest'
import { toItems } from './transcript'

describe('toItems', () => {
  it('folds tool results and approval decisions into their items', () => {
    const items = toItems([
      { type: 'user.message', chatId: 'c', text: 'hi', at: 't' },
      { type: 'tool.started', chatId: 'c', toolUseId: 't1', name: 'Bash', summary: 'touch x' },
      { type: 'approval.requested', chatId: 'c', approvalId: 'a1', tool: 'Bash', summary: 'touch x', reason: 'command' },
      { type: 'approval.resolved', chatId: 'c', approvalId: 'a1', decision: 'deny' },
      { type: 'tool.result', chatId: 'c', toolUseId: 't1', isError: true, summary: 'denied' },
      { type: 'message.text', chatId: 'c', text: 'It was denied.' },
      { type: 'turn.done', chatId: 'c', ok: true, numTurns: 2 },
    ])
    expect(items).toEqual([
      { kind: 'user', text: 'hi' },
      { kind: 'tool', id: 't1', name: 'Bash', summary: 'touch x', result: { isError: true, summary: 'denied' } },
      { kind: 'approval', id: 'a1', tool: 'Bash', summary: 'touch x', reason: 'command', decision: 'deny' },
      { kind: 'assistant', text: 'It was denied.' },
      { kind: 'turn', ok: true },
    ])
  })
})
