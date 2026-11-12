import { describe, expect, it } from 'vitest'
import { resolveDocPath } from './doc-paths'

const ws = { name: 'flow-aktivasi', branch: 'feat/tribe-2/flow-aktivasi', values: { iteration: 'i-15', module: 'detail', notes: '' } }
const workflow = {
  fields: [
    { key: 'iteration', label: 'Iteration', type: 'text' as const, required: true },
    { key: 'module', label: 'Module', type: 'text' as const, required: true },
    { key: 'notes', label: 'Notes', type: 'text' as const, required: false },
  ],
}
const now = new Date(2026, 10, 3)

describe('resolveDocPath', () => {
  it('fills workflow fields by label or key, case-insensitive', () => {
    const r = resolveDocPath({ label: 'OQ', template: 'frontend/modules/{Iteration}/{module}/Open Questions.md' }, ws, workflow, now)
    expect(r.path).toBe('frontend/modules/i-15/detail/Open Questions.md')
    expect(r.missing).toEqual([])
  })

  it('fills the built-in date and workspace placeholders', () => {
    const r = resolveDocPath({ label: 'Log', template: '{yyyy}/{yyyy-mm}/{yyyy-mm-dd}-{workspace}' }, ws, null, now)
    expect(r.path).toBe('2026/2026-11/2026-11-03-flow-aktivasi')
  })

  it('leaves unknown and empty placeholders in place and reports them once', () => {
    const r = resolveDocPath({ label: 'Plan', template: 'plans/{feature}/{feature}-{notes}.md' }, ws, workflow, now)
    expect(r.path).toBe('plans/{feature}/{feature}-{notes}.md')
    expect(r.missing).toEqual(['feature', 'notes'])
  })
})
