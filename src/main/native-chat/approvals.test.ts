import { describe, expect, it } from 'vitest'
import { ApprovalManager } from './approvals'
import { chatFixture, fakeAdapter } from './testing'

describe('ApprovalManager', () => {
  it('shows a card for a command and resolves it from the user answer (AC-C4)', async () => {
    let answer: string | undefined
    const adapter = fakeAdapter(async (o, emit) => {
      answer = await o.onToolRequest({ tool: 'Bash', input: { command: 'touch x' } })
      emit({ type: 'turn.done', ok: true, numTurns: 1 })
    })
    const { db, service, chat, events } = await chatFixture(adapter)
    service.update(chat.id, { permissionMode: 'ask' })
    const approvals = new ApprovalManager(db, service)
    service.setDecider(approvals.decide)
    service.send(chat.id, 'go')
    await new Promise((r) => setTimeout(r, 10))
    const card = events.find((e) => e.type === 'approval.requested')
    expect(card).toMatchObject({ tool: 'Bash', summary: 'touch x', reason: 'Runs a command' })
    expect(service.get(chat.id).status).toBe('needs_approval')
    approvals.answer((card as { approvalId: string }).approvalId, 'deny')
    await new Promise((r) => setTimeout(r, 10))
    expect(answer).toBe('deny')
    expect(events.some((e) => e.type === 'approval.resolved' && e.decision === 'deny')).toBe(true)
    expect(db.prepare('SELECT decision FROM approvals').get()).toEqual({ decision: 'deny' })
  })

  it('allows an edit inside the worktree without a card (AC-C3)', async () => {
    let answer: string | undefined
    const { db, service, chat, events, ws } = await chatFixture(
      fakeAdapter(async (o, emit) => {
        answer = await o.onToolRequest({ tool: 'Edit', input: { file_path: `${o.cwd}/README.md` } })
        emit({ type: 'turn.done', ok: true, numTurns: 1 })
      }),
    )
    service.setDecider(new ApprovalManager(db, service).decide)
    service.send(chat.id, 'edit')
    await new Promise((r) => setTimeout(r, 10))
    expect(ws.worktreePath).toBeTruthy()
    expect(answer).toBe('allow')
    expect(events.some((e) => e.type === 'approval.requested')).toBe(false)
  })
})
