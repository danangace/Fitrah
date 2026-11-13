import { describe, expect, it } from 'vitest'
import { checkReady } from './readiness'
import type { WorkflowField } from './schemas'

const planning: WorkflowField[] = [
  { key: 'prd', label: 'PRD', type: 'link', required: true },
  { key: 'iteration', label: 'Iteration', type: 'text', required: true },
  { key: 'base', label: 'Base branch', type: 'branch', required: false },
  { key: 'kind', label: 'Kind', type: 'text', required: true, default: 'feature' },
]
const full = { title: 'T', description: 'D', repoId: 'r1', values: { prd: 'https://x.test', iteration: 'i-1' } }

describe('checkReady', () => {
  it('is empty when everything required is there', () => expect(checkReady(full, planning)).toEqual([]))

  it('asks for title, description and project first', () => {
    expect(checkReady({ title: ' ', description: '', repoId: null, values: {} })).toEqual(['Title', 'Description', 'Project'])
  })

  it('adds the required fields of the workflow, by label, skipping optional ones', () => {
    expect(checkReady({ ...full, values: {} }, planning)).toEqual(['PRD', 'Iteration'])
  })

  it('treats blank values as missing but accepts a field default', () => {
    expect(checkReady({ ...full, values: { prd: '   ', iteration: 'i-1' } }, planning)).toEqual(['PRD'])
  })

  it('needs no workflow fields when the ticket has no workflow', () => expect(checkReady(full)).toEqual([]))
})
