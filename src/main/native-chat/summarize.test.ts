import { describe, expect, it } from 'vitest'
import { summarizeTool } from './summarize'

describe('summarizeTool', () => {
  it('shows the most useful field per tool', () => {
    expect(summarizeTool('Bash', { command: 'pnpm test' })).toBe('pnpm test')
    expect(summarizeTool('Edit', { file_path: '/w/a.ts', old_string: 'x' })).toBe('/w/a.ts')
    expect(summarizeTool('Grep', { pattern: 'useAuth' })).toBe('useAuth')
    expect(summarizeTool('Other', { a: 'x'.repeat(300) }).endsWith('…')).toBe(true)
  })
})
