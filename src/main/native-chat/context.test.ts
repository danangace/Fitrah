import { describe, expect, it } from 'vitest'
import type { Repo, Workspace } from '../../shared/schemas'
import { DEFAULT_SETTINGS } from '../settings/store'
import { openDb } from '../sqlite/db'
import { getWorkflow } from '../workflows/service'
import { workspaceContext } from './context'

const ws: Workspace = {
  id: 'w',
  repoId: 'r',
  name: 'flow-aktivasi',
  workflowId: 'planning',
  values: { prd: 'https://prd.example/doc', figma: 'https://figma.example/x', iteration: 'i-15', module: 'detail', target_docs: 'frontend/modules/i-15/detail', base: '' },
  branch: 'feat/tribe-2/flow-aktivasi',
  base: 'origin/dev/tribe-2',
  worktreePath: '/ws/repo/flow',
  stage: 'intake',
  setupStatus: 'done',
  status: 'idle',
  agent: null,
  createdAt: 't',
  archivedAt: null,
}
const repo: Repo = {
  id: 'r',
  name: 'website-cf-monorepo',
  path: '/repo',
  setupScript: '',
  archiveScript: '',
  featureBase: 'origin/dev/tribe-2',
  branchPrefix: 'feat/tribe-2/',
  sharedDirs: [],
  createdAt: 't',
}

describe('workspaceContext', () => {
  it('gives Claude the workflow values and filled instructions (AC-F3)', () => {
    const planning = getWorkflow(openDb(':memory:'), 'planning')
    const text = workspaceContext(ws, repo, { ...DEFAULT_SETTINGS, docsRoot: '/vault' }, planning)
    expect(text).toContain('## Workflow: Planning')
    expect(text).toContain('- PRD: https://prd.example/doc')
    expect(text).toContain('- Iteration: i-15')
    expect(text).toContain('- Target docs: frontend/modules/i-15/detail (/vault/frontend/modules/i-15/detail)')
    expect(text).toContain('- Base branch: not set')
    expect(text).toContain('Write the implementation plan for detail (i-15) from the PRD (https://prd.example/doc)')
    expect(text).toContain('- Branch: feat/tribe-2/flow-aktivasi (created from origin/dev/tribe-2)')
  })

  it('free chat gets only project and branch facts', () => {
    const text = workspaceContext({ ...ws, workflowId: null, values: {} }, repo, DEFAULT_SETTINGS, null)
    expect(text).toContain('free chat')
    expect(text).not.toContain('Workflow')
  })
})
