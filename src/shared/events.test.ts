import { describe, expect, it } from 'vitest'
import { ChatEvent, ClientMessage } from './events'
import { Settings, WorkspaceInput } from './schemas'

describe('contracts', () => {
  it('parses a chat event and rejects an unknown type', () => {
    expect(ChatEvent.safeParse({ type: 'status', chatId: 'c', status: 'working' }).success).toBe(true)
    expect(ChatEvent.safeParse({ type: 'sdk.raw', chatId: 'c' }).success).toBe(false)
  })

  it('validates client messages', () => {
    expect(ClientMessage.safeParse({ type: 'send', chatId: 'c', text: '' }).success).toBe(false)
    expect(ClientMessage.safeParse({ type: 'approve', approvalId: 'a', decision: 'allow' }).success).toBe(true)
  })

  it('requires a base branch and a slug name for workspaces', () => {
    const ok = { repoId: 'r', kind: 'defect', name: 'invoice-total-null', base: 'origin/main' }
    expect(WorkspaceInput.safeParse(ok).success).toBe(true)
    expect(WorkspaceInput.safeParse({ ...ok, base: '' }).success).toBe(false)
    expect(WorkspaceInput.safeParse({ ...ok, name: 'Invoice Total' }).success).toBe(false)
  })

  it('requires a claude model list in settings', () => {
    const base = { docsRoot: null, paths: { moduleDocs: '', plans: '', oqFile: '' }, workspacesDir: '/w' }
    expect(Settings.safeParse({ ...base, models: { claude: { list: ['sonnet'], default: 'sonnet' } } }).success).toBe(true)
    expect(Settings.safeParse({ ...base, models: {} }).success).toBe(false)
  })
})
