import { describe, expect, it } from 'vitest'
import type { Repo, Workspace } from '../../shared/schemas'
import { DEFAULT_SETTINGS } from '../settings/store'
import { fillPattern, workspaceContext } from './context'

const ws: Workspace = {
  id: 'w',
  repoId: 'r',
  kind: 'defect',
  name: 'flow-aktivasi-subscription',
  base: 'origin/dev/tribe-2',
  iteration: 'i-15',
  module: 'kelola-subscription-detail',
  prdUrl: 'https://prd.example/doc',
  figmaUrl: 'https://www.figma.com/design/abc?node-id=1-2',
  branch: 'fix/tribe-2/flow-aktivasi-subscription',
  worktreePath: '/ws/repo/flow',
  stage: 'intake',
  setupStatus: 'done',
  status: 'idle',
  createdAt: 't',
  archivedAt: null,
}
const repo: Repo = { id: 'r', name: 'website-cf-monorepo', path: '/repo', setupScript: '', archiveScript: '', featureBase: 'origin/dev/tribe-2', sharedDirs: [], createdAt: 't' }

describe('workspaceContext', () => {
  it('gives the agent the PRD, Figma, iteration, module and branch', () => {
    const text = workspaceContext(ws, repo, { ...DEFAULT_SETTINGS, docsRoot: '/vault' })
    expect(text).toContain('- PRD: https://prd.example/doc')
    expect(text).toContain('- Figma: https://www.figma.com/design/abc?node-id=1-2')
    expect(text).toContain('- Iteration: i-15')
    expect(text).toContain('- Branch: fix/tribe-2/flow-aktivasi-subscription (created from origin/dev/tribe-2)')
    expect(text).toContain('- Kind: defect (bug fix)')
    expect(text).toContain('/vault/frontend/modules/i-15/kelola-subscription-detail')
  })

  it('says "not set" instead of inventing missing fields', () => {
    const text = workspaceContext({ ...ws, prdUrl: undefined, iteration: undefined }, repo, DEFAULT_SETTINGS)
    expect(text).toContain('- PRD: not set')
    expect(text).not.toContain('Module docs folder')
  })

  it('fills docs path patterns only when all values exist', () => {
    expect(fillPattern('frontend/modules/{iteration}/{module}', ws)).toBe('frontend/modules/i-15/kelola-subscription-detail')
    expect(fillPattern('frontend/modules/{iteration}/{module}', { iteration: 'i-15' })).toBeNull()
  })
})
