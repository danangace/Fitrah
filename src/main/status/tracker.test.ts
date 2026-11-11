import { describe, expect, it } from 'vitest'
import type { AppEvent } from '../../shared/events'
import { getAccount } from '../accounts/service'
import { EventBus } from '../events/bus'
import { chatFixture, fakeAdapter } from '../native-chat/testing'
import { StatusTracker, aggregate } from './tracker'

describe('aggregate', () => {
  it('shows the most urgent chat state (AC-N1)', () => {
    expect(aggregate([])).toBe('idle')
    expect(aggregate(['done', 'working'])).toBe('working')
    expect(aggregate(['working', 'needs_approval', 'error'])).toBe('needs_approval')
    expect(aggregate(['done', 'waiting'])).toBe('waiting')
  })
})

describe('StatusTracker', () => {
  it('emits workspace status changes as a turn runs (AC-N1)', async () => {
    const { db, service, chat, ws } = await chatFixture()
    const bus = new EventBus()
    const seen: AppEvent[] = []
    bus.subscribe((e) => seen.push(e))
    const tracker = new StatusTracker(db, bus, service)
    service.send(chat.id, 'hi')
    await new Promise((r) => setTimeout(r, 10))
    expect(tracker.statusOf(ws.id)).toBe('done')
    expect(seen).toEqual([
      { type: 'workspace.status', workspaceId: ws.id, status: 'working' },
      { type: 'workspace.status', workspaceId: ws.id, status: 'done' },
    ])
  })

  it('warns on the account when it hits a rate limit, other chats unaffected (AC-N3)', async () => {
    const limited = fakeAdapter(async (_o, emit) => {
      emit({ type: 'error', kind: 'rate_limit', message: 'Usage limit reached (five_hour).' })
      emit({ type: 'turn.done', ok: false, numTurns: 0 })
    })
    const { db, service, chat, account } = await chatFixture(limited)
    const bus = new EventBus()
    const seen: AppEvent[] = []
    bus.subscribe((e) => seen.push(e))
    const tracker = new StatusTracker(db, bus, service)
    service.send(chat.id, 'hi')
    await new Promise((r) => setTimeout(r, 10))
    const warning = 'Rate limit: Usage limit reached (five_hour).'
    expect(getAccount(db, account.id).warning).toBe(warning)
    expect(seen).toContainEqual({ type: 'account.warning', accountId: account.id, warning })
    expect(tracker.statusOf(chat.workspaceId)).toBe('error')
  })
})

describe('usage', () => {
  it('saves the windows a turn reports on the account and tells the UI', async () => {
    const reporting = fakeAdapter(async (_o, emit) => {
      emit({ type: 'usage', windows: [{ key: 'five_hour', utilization: 0.82, resetsAt: 1794422400, status: 'allowed' }] })
      emit({ type: 'usage', windows: [{ key: 'seven_day', utilization: 0.46, resetsAt: 1794844800, status: 'allowed' }] })
      emit({ type: 'turn.done', ok: true, numTurns: 1 })
    })
    const { db, service, chat, account } = await chatFixture(reporting)
    const bus = new EventBus()
    const seen: AppEvent[] = []
    bus.subscribe((e) => seen.push(e))
    const tracker = new StatusTracker(db, bus, service)
    service.send(chat.id, 'hi')
    await new Promise((r) => setTimeout(r, 10))
    expect(tracker).toBeTruthy()
    expect(getAccount(db, account.id).usage?.windows.map((w) => [w.key, w.utilization])).toEqual([
      ['five_hour', 0.82],
      ['seven_day', 0.46],
    ])
    expect(seen.filter((e) => e.type === 'account.usage')).toHaveLength(2)
  })
})
