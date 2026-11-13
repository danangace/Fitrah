import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readClaudeHistory } from './history'

describe('readClaudeHistory', () => {
  it('rebuilds user, assistant and tool events from a transcript (AC-C7)', () => {
    const configDir = mkdtempSync(join(tmpdir(), 'nakoda-claude-'))
    const dir = join(configDir, 'projects', '-ws-repo-w')
    mkdirSync(dir, { recursive: true })
    const lines = [
      { type: 'session-owner', sessionId: 's1' },
      { type: 'user', timestamp: 't1', message: { content: [{ type: 'text', text: 'append a line' }] } },
      { type: 'assistant', message: { content: [{ type: 'tool_use', id: 'u1', name: 'Edit', input: { file_path: '/ws/README.md' } }] } },
      { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'u1', content: 'ok' }] } },
      { type: 'assistant', isSidechain: true, message: { content: [{ type: 'text', text: 'subagent noise' }] } },
      { type: 'assistant', message: { content: [{ type: 'text', text: 'Done.' }] } },
    ]
    writeFileSync(join(dir, 's1.jsonl'), `${lines.map((l) => JSON.stringify(l)).join('\n')}\n`)
    expect(readClaudeHistory(configDir, 's1')).toEqual([
      { type: 'user.message', text: 'append a line', at: 't1' },
      { type: 'tool.started', toolUseId: 'u1', name: 'Edit', summary: '/ws/README.md' },
      { type: 'tool.result', toolUseId: 'u1', isError: false, summary: 'ok' },
      { type: 'message.text', text: 'Done.' },
    ])
  })

  it('returns nothing when the transcript is missing', () => {
    expect(readClaudeHistory(mkdtempSync(join(tmpdir(), 'nakoda-claude-')), 'nope')).toEqual([])
  })
})
