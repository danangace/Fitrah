import { describe, expect, it } from 'vitest'
import { openDb } from '../sqlite/db'
import { createWorkflow, fillInstructions, getWorkflow, listWorkflows, removeWorkflow, resolveValues, updateWorkflow } from './service'

describe('workflows', () => {
  it('ships the editable Planning starter', () => {
    const db = openDb(':memory:')
    const planning = getWorkflow(db, 'planning')
    expect(planning.name).toBe('Planning')
    expect(planning.fields.map((f) => `${f.label}:${f.type}`)).toEqual([
      'PRD:link',
      'Figma:link',
      'Iteration:text',
      'Module:text',
      'Target docs:docsFolder',
      'Base branch:branch',
    ])
    const edited = updateWorkflow(db, 'planning', { ...planning, instructions: 'Only {Module}.' })
    expect(edited.instructions).toBe('Only {Module}.')
  })

  it('creates a workflow with each field type (AC-F1)', () => {
    const db = openDb(':memory:')
    const wf = createWorkflow(db, {
      name: 'Defect fix',
      fields: [
        { key: 'ticket', label: 'Ticket', type: 'link', required: true },
        { key: 'notes', label: 'Notes', type: 'text' },
        { key: 'docs', label: 'Docs', type: 'docsFolder' },
        { key: 'base', label: 'Base', type: 'branch', default: 'origin/main' },
        { key: 'env', label: 'Found on', type: 'choice', options: ['dev', 'staging', 'prod'], required: true },
      ],
      instructions: 'Fix {Ticket} found on {Found on}.',
    })
    expect(listWorkflows(db).map((w) => w.name)).toEqual(['Defect fix', 'Planning'])
    expect(wf.fields).toHaveLength(5)
  })

  it('rejects duplicate keys, empty choices and duplicate names', () => {
    const db = openDb(':memory:')
    const field = { key: 'a', label: 'A', type: 'text' as const }
    expect(() => createWorkflow(db, { name: 'X', fields: [field, field] })).toThrow(/key "a"/)
    expect(() => createWorkflow(db, { name: 'X', fields: [{ key: 'c', label: 'C', type: 'choice' }] })).toThrow(/choice/)
    expect(() => createWorkflow(db, { name: 'Planning', fields: [] })).toThrow(/already exists/)
  })

  it('applies defaults and requires required fields (AC-F2)', () => {
    const db = openDb(':memory:')
    const planning = getWorkflow(db, 'planning')
    expect(() => resolveValues(planning, { prd: 'https://p' })).toThrow(/Fill in: Figma, Iteration, Module/)
    const values = resolveValues(planning, { prd: ' https://p ', figma: 'https://f', iteration: 'i-16', module: 'm', extra: 'x' })
    expect(values).toEqual({ prd: 'https://p', figma: 'https://f', iteration: 'i-16', module: 'm', target_docs: '', base: '' })
  })

  it('fills {Label} placeholders in the instructions (AC-F3)', () => {
    const db = openDb(':memory:')
    const planning = getWorkflow(db, 'planning')
    const text = fillInstructions(planning, { prd: 'https://p', figma: 'https://f', iteration: 'i-16', module: 'kelola', target_docs: '' })
    expect(text).toContain('for kelola (i-16) from the PRD (https://p)')
    expect(text).toContain('into (not set)')
  })

  it('cannot remove a workflow in use', () => {
    const db = openDb(':memory:')
    const wf = createWorkflow(db, { name: 'Tmp', fields: [] })
    removeWorkflow(db, wf.id)
    expect(listWorkflows(db).map((w) => w.name)).toEqual(['Planning'])
  })
})
