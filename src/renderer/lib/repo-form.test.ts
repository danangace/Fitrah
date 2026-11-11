import { describe, expect, it } from 'vitest'
import type { Repo } from '../../shared/schemas'
import { formFromRepo, isDirty, setupState } from './repo-form'

const repo: Repo = {
  id: 'r',
  name: 'website-cf-monorepo',
  path: '/x',
  setupScript: 'pnpm install',
  archiveScript: '',
  featureBase: 'origin/dev/tribe-2',
  sharedDirs: [],
  createdAt: 't',
}

describe('repo form', () => {
  it('detects unsaved changes', () => {
    expect(isDirty(formFromRepo(repo), repo)).toBe(false)
    expect(isDirty({ ...formFromRepo(repo), setupScript: 'pnpm install\n' }, repo)).toBe(false)
    expect(isDirty({ ...formFromRepo(repo), featureBase: 'origin/main' }, repo)).toBe(true)
  })

  it('describes whether the repo is ready for workspaces', () => {
    expect(setupState(repo)).toEqual({ label: 'Ready · setup script', tone: 'ok' })
    expect(setupState({ ...repo, setupScript: '' }).label).toBe('Ready · no setup script')
    expect(setupState({ ...repo, featureBase: '' }).tone).toBe('warn')
  })
})
