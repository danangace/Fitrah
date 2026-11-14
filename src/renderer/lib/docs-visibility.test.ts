import { describe, expect, it } from 'vitest'
import type { DocNodeT } from '../../shared/schemas'
import { folderRows, setFolderShown } from './docs-visibility'

const tree: DocNodeT[] = [
  { name: 'frontend', path: 'frontend', dir: true, children: [{ name: 'bugs', path: 'frontend/bugs', dir: true, children: [{ name: 'a.md', path: 'frontend/bugs/a.md', dir: false }] }] },
  { name: 'plans', path: 'plans', dir: true, children: [{ name: 'p.md', path: 'plans/p.md', dir: false }] },
  { name: 'README.md', path: 'README.md', dir: false },
]

describe('docs visibility', () => {
  it('lists folders only, nested, all on by default', () => {
    expect(folderRows(tree, []).map((r) => [r.path, r.depth, r.on])).toEqual([['frontend', 0, true], ['frontend/bugs', 1, true], ['plans', 0, true]])
  })

  it('a hidden folder turns its children off and locks them', () => {
    const rows = folderRows(tree, ['frontend'])
    expect(rows.map((r) => [r.path, r.on, r.inherited])).toEqual([['frontend', false, false], ['frontend/bugs', false, true], ['plans', true, false]])
  })

  it('toggles without duplicates', () => {
    expect(setFolderShown([], 'plans', false)).toEqual(['plans'])
    expect(setFolderShown(['plans'], 'plans', false)).toEqual(['plans'])
    expect(setFolderShown(['plans', 'x'], 'plans', true)).toEqual(['x'])
  })
})
