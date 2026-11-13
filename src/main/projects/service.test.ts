import { mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { listRepos } from '../settings/store'
import { openDb } from '../sqlite/db'
import { gitOut, makeRepoWithOrigin } from '../workspaces/testing'
import { cloneProject, createProject, inspectFolder, listDirs, repoNameFromUrl } from './service'

describe('projects', () => {
  it('lists folders only, marks git repos, hides dot-folders (AC-P1)', () => {
    const { repo } = makeRepoWithOrigin()
    const parent = join(repo, '..')
    mkdirSync(join(parent, '.hidden'))
    const listing = listDirs(parent)
    expect(listing.dirs.map((d) => [d.name, d.isGitRepo])).toEqual([
      ['origin.git', false],
      ['repo', true],
    ])
    expect(listDirs(parent, true).dirs.some((d) => d.name === '.hidden')).toBe(true)
    expect(listing.parent).toBeTruthy()
  })

  it('inspects a folder: git repo + default base from origin (AC-P1)', async () => {
    const { repo } = makeRepoWithOrigin()
    // A normal clone records origin's default branch; the fixture cloned an empty origin, so set it.
    gitOut(repo, 'remote', 'set-head', 'origin', 'main')
    expect(await inspectFolder(repo)).toMatchObject({ name: 'repo', isGitRepo: true, defaultBase: 'origin/main' })
    expect(await inspectFolder(mkdtempSync(join(tmpdir(), 'nakoda-plain-')))).toMatchObject({ isGitRepo: false, defaultBase: null })
  })

  it('clones from a URL and adds the project (AC-P2)', async () => {
    const db = openDb(':memory:')
    const { origin } = makeRepoWithOrigin()
    const parent = mkdtempSync(join(tmpdir(), 'nakoda-clone-'))
    const project = await cloneProject(db, { url: origin, parentDir: parent })
    expect(project).toMatchObject({ name: 'origin', path: join(parent, 'origin'), featureBase: 'origin/main' })
    expect(listRepos(db)).toHaveLength(1)
    await expect(cloneProject(db, { url: origin, parentDir: parent })).rejects.toThrow(/already exists/)
    await expect(cloneProject(db, { url: join(parent, 'nope.git'), parentDir: parent, name: 'x' })).rejects.toThrow(/clone failed/)
  })

  it('creates a new project with a first commit (AC-P3)', async () => {
    const db = openDb(':memory:')
    const parent = mkdtempSync(join(tmpdir(), 'nakoda-new-'))
    const project = await createProject(db, { parentDir: parent, name: 'side-project' })
    expect(project).toMatchObject({ name: 'side-project', featureBase: 'main' })
    expect(gitOut(project.path, 'log', '--oneline').split('\n')).toHaveLength(1)
    await expect(createProject(db, { parentDir: parent, name: 'bad name' })).rejects.toThrow(/letters/)
  })

  it('reads a folder name from clone URLs', () => {
    expect(repoNameFromUrl('git@github.com:danangace/Fitrah.git')).toBe('Fitrah')
    expect(repoNameFromUrl('https://gitlab.com/group/sub/website-cf-monorepo/')).toBe('website-cf-monorepo')
  })
})
