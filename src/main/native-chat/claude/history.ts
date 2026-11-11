import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { AdapterEvent } from '../types'
import { type SdkLike, mapClaudeMessage } from './map'

/** `<configDir>/projects/<cwd-slug>/<sessionId>.jsonl`; the slug is found by scanning. */
export function findTranscript(configDir: string, sessionId: string): string | null {
  const projects = join(configDir, 'projects')
  if (!existsSync(projects)) return null
  for (const dir of readdirSync(projects)) {
    const file = join(projects, dir, `${sessionId}.jsonl`)
    if (existsSync(file)) return file
  }
  return null
}

type Line = SdkLike & { isSidechain?: boolean; isMeta?: boolean; timestamp?: string }

/**
 * Rebuild a chat's events from Claude's own transcript after a Fitrah restart (AC-C7).
 * Conversations are never copied into Fitrah; the transcript stays the source.
 */
export function readClaudeHistory(configDir: string, sessionId: string): AdapterEvent[] {
  const file = findTranscript(configDir, sessionId)
  if (!file) return []
  const events: AdapterEvent[] = []
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    if (!raw.trim()) continue
    let line: Line
    try {
      line = JSON.parse(raw) as Line
    } catch {
      continue
    }
    if (line.isSidechain || line.isMeta) continue
    if (line.type === 'user') {
      const content = line.message?.content
      const text =
        typeof content === 'string'
          ? content
          : Array.isArray(content)
            ? content.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('\n')
            : ''
      if (text.trim() && !text.startsWith('<')) events.push({ type: 'user.message', text, at: line.timestamp ?? '' })
      events.push(...mapClaudeMessage(line))
    } else if (line.type === 'assistant') {
      events.push(...mapClaudeMessage(line))
    }
  }
  return events
}
