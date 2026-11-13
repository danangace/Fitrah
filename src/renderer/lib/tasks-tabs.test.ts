import { describe, expect, it } from 'vitest'
import { TASK_TABS, resolveTaskTab, statusLabel } from './tasks-tabs'

describe('tasks tabs', () => {
  it('has unique ids, the board first', () => {
    expect(new Set(TASK_TABS.map((t) => t.id)).size).toBe(TASK_TABS.length)
    expect(TASK_TABS[0].id).toBe('board')
  })
  it('falls back to the board for an unknown tab', () => {
    expect(resolveTaskTab('external')).toBe('external')
    expect(resolveTaskTab('nope')).toBe('board')
  })
  it('makes a status readable', () => {
    expect(statusLabel('ready_to_test')).toBe('Ready to test')
    expect(statusLabel('')).toBe('—')
  })
})
