import { describe, expect, it } from 'vitest'
import { mapClaudeMessage } from './map'

describe('mapClaudeMessage', () => {
  it('maps init to session.started', () => {
    expect(mapClaudeMessage({ type: 'system', subtype: 'init', session_id: 's1', model: 'claude-haiku-5-5' })).toEqual([
      { type: 'session.started', sessionId: 's1', model: 'claude-haiku-5-5' },
    ])
  })

  it('maps assistant text and tool use', () => {
    const events = mapClaudeMessage({
      type: 'assistant',
      message: {
        content: [
          { type: 'text', text: 'Reading.' },
          { type: 'tool_use', id: 't1', name: 'Read', input: { file_path: '/w/hello.txt' } },
        ],
      },
    })
    expect(events).toEqual([
      { type: 'message.text', text: 'Reading.' },
      { type: 'tool.started', toolUseId: 't1', name: 'Read', summary: '/w/hello.txt' },
    ])
  })

  it('maps tool results', () => {
    expect(
      mapClaudeMessage({
        type: 'user',
        message: { content: [{ type: 'tool_result', tool_use_id: 't1', is_error: true, content: [{ type: 'text', text: 'denied' }] }] },
      }),
    ).toEqual([{ type: 'tool.result', toolUseId: 't1', isError: true, summary: 'denied' }])
  })

  it('maps results, including rate-limit errors (AC-N3)', () => {
    expect(mapClaudeMessage({ type: 'result', subtype: 'success', num_turns: 2 })).toEqual([
      { type: 'turn.done', ok: true, numTurns: 2 },
    ])
    expect(
      mapClaudeMessage({ type: 'result', subtype: 'error_during_execution', is_error: true, errors: ['Claude usage limit reached'], num_turns: 1 }),
    ).toEqual([
      { type: 'error', kind: 'rate_limit', message: 'Claude usage limit reached' },
      { type: 'turn.done', ok: false, numTurns: 1 },
    ])
    expect(mapClaudeMessage({ type: 'rate_limit_event', rate_limit_info: { status: 'rejected', rateLimitType: 'five_hour' } })[0]).toMatchObject({
      type: 'error',
      kind: 'rate_limit',
    })
    expect(mapClaudeMessage({ type: 'rate_limit_event', rate_limit_info: { status: 'allowed' } })).toEqual([])
  })

  it('maps the usage windows every turn reports', () => {
    // Shape seen from the SDK on 2026-11-11.
    const events = mapClaudeMessage({
      type: 'rate_limit_event',
      rate_limit_info: {
        status: 'allowed',
        rateLimitType: 'five_hour',
        unifiedWindows: {
          five_hour: { utilization: 0.82, resetsAt: 1794422400, status: 'allowed' },
          seven_day: { utilization: 0.46, resetsAt: 1794844800, status: 'allowed' },
        },
      },
    })
    expect(events).toEqual([
      {
        type: 'usage',
        windows: [
          { key: 'five_hour', utilization: 0.82, resetsAt: 1794422400, status: 'allowed' },
          { key: 'seven_day', utilization: 0.46, resetsAt: 1794844800, status: 'allowed' },
        ],
      },
    ])
  })

  it('ignores other message types', () => {
    expect(mapClaudeMessage({ type: 'stream_event' })).toEqual([])
  })
})
