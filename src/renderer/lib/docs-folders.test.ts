import { describe, expect, it } from 'vitest'
import { docFolders } from './docs-folders'

describe('docFolders', () => {
  it('lists folder paths depth-first', () => {
    expect(
      docFolders([
        { name: 'frontend', path: 'frontend', dir: true, children: [{ name: 'modules', path: 'frontend/modules', dir: true, children: [] }, { name: 'a.md', path: 'frontend/a.md', dir: false }] },
        { name: 'README.md', path: 'README.md', dir: false },
      ]),
    ).toEqual(['frontend', 'frontend/modules'])
  })
})
