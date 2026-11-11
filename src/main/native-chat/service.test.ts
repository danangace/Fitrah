import { describe, expect, it } from 'vitest'
import { ChatService } from './service'
import { chatFixture, fakeAdapter } from './testing'

const settle = () => new Promise((r) => setTimeout(r, 10))

describe('ChatService', () => {
  it('runs a turn in the worktree with the account and model, and saves the session id', async () => {
    const { service, chat, events, adapter, ws } = await chatFixture()
    service.send(chat.id, 'hi')
    await settle()
    expect(adapter.calls[0]).toMatchObject({ cwd: ws.worktreePath, configDir: '/acc', model: 'haiku', sessionId: null, prompt: 'hi' })
    expect(adapter.calls[0]?.context).toContain(`- Branch: ${ws.branch}`)
    expect(events.map((e) => e.type)).toEqual(['user.message', 'status', 'session.started', 'message.text', 'turn.done', 'status'])
    expect(service.get(chat.id)).toMatchObject({ sessionId: 'sess-1', status: 'done' })
  })

  it('resumes the stored session on the next message (AC-C7)', async () => {
    const { service, chat, adapter } = await chatFixture()
    service.send(chat.id, 'one')
    await settle()
    service.send(chat.id, 'two')
    await settle()
    expect(adapter.calls[1]?.sessionId).toBe('sess-1')
  })

  it('refuses a second message while a turn runs', async () => {
    let release: (() => void) | undefined
    const slow = fakeAdapter(async (_o, emit) => {
      await new Promise<void>((r) => {
        release = r
      })
      emit({ type: 'turn.done', ok: true, numTurns: 1 })
    })
    const { service, chat } = await chatFixture(slow)
    service.send(chat.id, 'one')
    expect(() => service.send(chat.id, 'two')).toThrow(/still working/)
    release?.()
  })

  it('rebuilds history from the adapter after a restart and resets stale status (AC-C7)', async () => {
    const { db, service, chat, adapter } = await chatFixture()
    service.send(chat.id, 'hi')
    await settle()
    db.prepare("UPDATE chats SET status = 'working' WHERE id = ?").run(chat.id)
    const withHistory = { ...adapter, readHistory: () => [{ type: 'message.text' as const, text: 'from transcript' }] }
    const restarted = new ChatService(db, { claude: withHistory })
    expect(restarted.get(chat.id).status).toBe('waiting')
    expect(restarted.events(chat.id)).toEqual([{ type: 'message.text', text: 'from transcript', chatId: chat.id }])
  })

  it('updates model, effort and permission from the composer; next turn uses them', async () => {
    const { service, chat, adapter } = await chatFixture()
    expect(service.get(chat.id)).toMatchObject({ permissionMode: 'accept-edits', effort: null })
    service.update(chat.id, { model: 'opus', effort: 'high', permissionMode: 'full' })
    expect(service.get(chat.id)).toMatchObject({ model: 'opus', effort: 'high', permissionMode: 'full' })
    service.send(chat.id, 'go')
    await settle()
    expect(adapter.calls[0]).toMatchObject({ model: 'opus', effort: 'high' })
    expect(() => service.update(chat.id, { permissionMode: 'yolo' })).toThrow()
  })

  it('keeps several chats per workspace (multiple chats)', async () => {
    const { service, chat, account, ws } = await chatFixture()
    const second = service.create({ workspaceId: ws.id, agent: 'claude', accountId: account.id, model: 'opus', title: 'plan' })
    expect(service.list(ws.id).map((c) => c.id)).toEqual([chat.id, second.id])
    expect(second.title).toBe('plan')
  })

  it('marks the chat as error when the turn fails', async () => {
    const failing = fakeAdapter(async (_o, emit) => {
      emit({ type: 'error', kind: 'other', message: 'boom' })
      emit({ type: 'turn.done', ok: false, numTurns: 0 })
    })
    const { service, chat } = await chatFixture(failing)
    service.send(chat.id, 'x')
    await settle()
    expect(service.get(chat.id).status).toBe('error')
  })
})
