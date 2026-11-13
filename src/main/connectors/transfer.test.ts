import { describe, expect, it } from 'vitest'
import { DEFECT, STORY } from './fixtures/helix'
import { HelixClient } from './helix'
import { DEFAULT_MAPPINGS, slug, toTaskInput } from './transfer'

const ids = { planning: 'planning', defect: 'defect' }
const ticket = async (body: unknown) =>
  new HelixClient({ baseUrl: 'https://helix.test', token: 'sidpjm_x', fetch: (async () => new Response(JSON.stringify(body))) as typeof fetch }).ticket('T2-1')

describe('toTaskInput', () => {
  it('turns a story into a Planning ticket: PRD, Figma and iteration filled, module left for a person, extra links kept in the text', async () => {
    const input = toTaskInput(await ticket(STORY), DEFAULT_MAPPINGS, ids, 'repo1')
    expect(input).toMatchObject({ kind: 'task', workflowId: 'planning', repoId: 'repo1', priority: 'high', title: 'Invoice Management - Phase 1' })
    expect(input.values).toEqual({ prd: 'https://docs.example.test/prd-1', figma: 'https://www.figma.com/design/abc/invoices', iteration: 'i-14b', module: '' })
    expect(input.description).toContain('## Objective')
    expect(input.description).toContain('## Other references\n\n- https://docs.example.test/prd-2')
    expect(input.description).toContain('## Subtasks (2)')
  })

  it('turns a defect into a Defect ticket with its steps, expected, actual and mapped severity and environment', async () => {
    const input = toTaskInput(await ticket(DEFECT), DEFAULT_MAPPINGS, ids, null)
    expect(input).toMatchObject({ kind: 'defect', workflowId: 'defect', repoId: null })
    expect(input.values).toMatchObject({
      defect: 'fe-link-redirect-after-login',
      environment: 'staging',
      severity: 'minor',
      iteration: 'i-15',
      steps: '1. Open the emailed link while logged out',
      expected: 'Land on the page after login',
      actual: 'Land on the dashboard',
      references: '',
    })
  })

  it('uses the edited mappings, and leaves a value empty when nothing maps', async () => {
    const raw = { data: { ...DEFECT.data, severity: 'high', type: 'defect_production' } }
    const custom = { severity: { high: 'critical' }, environment: { defect_production: 'production' } }
    expect(toTaskInput(await ticket(raw), custom, ids, null).values).toMatchObject({ severity: 'critical', environment: 'production' })
    expect(toTaskInput(await ticket(raw), { severity: {}, environment: {} }, ids, null).values).toMatchObject({ severity: '', environment: '' })
  })

  it('keeps every link on a defect, and has no workflow when the workflow is missing', async () => {
    const raw = { data: { ...DEFECT.data, fields: STORY.data.fields } }
    const input = toTaskInput(await ticket(raw), DEFAULT_MAPPINGS, { planning: null, defect: null }, null)
    expect(input.workflowId).toBeNull()
    expect(input.values.references?.split('\n')).toHaveLength(3)
  })
})

describe('slug', () => {
  it('makes a folder-safe name', () => expect(slug('[FE] Link  redirect!!')).toBe('fe-link-redirect'))
})
