import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, saveSettings } from '../settings/store'
import { openDb } from '../sqlite/db'
import { buildTree, listFiles, resolveLink } from './index'
import { DocsService, splitFrontmatter } from './service'

function vault() {
  const root = mkdtempSync(join(tmpdir(), 'nakoda-vault-'))
  const w = (rel: string, content = '') => {
    mkdirSync(join(root, rel, '..'), { recursive: true })
    writeFileSync(join(root, rel), content)
  }
  w('brainstorm/agent-orchestrator/README.md', '---\ntags: [brainstorm]\n---\n# Hi\nSee [[Design - Nakoda]] and ![[_sources/figma/1-2.png|600]] and [[Missing]].')
  w('brainstorm/agent-orchestrator/Design - Nakoda.md', '# Design')
  w('brainstorm/agent-orchestrator/_sources/figma/1-2.png', 'png')
  w('frontend/modules/README.md', '# Modules')
  w('.obsidian/workspace.json', '{}')
  w('empty-dir/image.png', 'png')
  return root
}

describe('docs index', () => {
  it('lists files without hidden folders and builds a markdown tree', () => {
    const root = vault()
    const files = listFiles(root)
    expect(files.some((f) => f.startsWith('.obsidian'))).toBe(false)
    const tree = buildTree(files)
    expect(tree.map((n) => n.name)).toEqual(['brainstorm', 'frontend'])
  })

  it('resolves wiki-links and embeds Obsidian-style (AC-D2, AC-D3)', () => {
    const files = listFiles(vault())
    const from = 'brainstorm/agent-orchestrator/README.md'
    expect(resolveLink(files, 'Design - Nakoda', from)).toBe('brainstorm/agent-orchestrator/Design - Nakoda.md')
    expect(resolveLink(files, '_sources/figma/1-2.png', from)).toBe('brainstorm/agent-orchestrator/_sources/figma/1-2.png')
    // basename match anywhere: the shortest path wins
    expect(resolveLink(files, 'README', 'frontend/x.md')).toBe('frontend/modules/README.md')
    expect(resolveLink(files, 'Missing', from)).toBeNull()
  })
})

function service() {
  const db = openDb(':memory:')
  saveSettings(db, { ...DEFAULT_SETTINGS, docsRoot: vault() })
  return new DocsService(db)
}

describe('DocsService', () => {
  it('leaves hidden folders out of the tree, but not out of the all-folders view', () => {
    const db = openDb(':memory:')
    saveSettings(db, { ...DEFAULT_SETTINGS, docsRoot: vault(), docsHidden: ['brainstorm'] })
    const docs = new DocsService(db)
    expect(docs.tree().map((n) => n.name)).toEqual(['frontend'])
    expect(docs.tree(true).map((n) => n.name)).toEqual(['brainstorm', 'frontend'])
    // Display only: a hidden note still opens and still resolves.
    expect(docs.read('brainstorm/agent-orchestrator/README.md').path).toBe('brainstorm/agent-orchestrator/README.md')
  })

  it('drops a folder whose children are all hidden', () => {
    const db = openDb(':memory:')
    saveSettings(db, { ...DEFAULT_SETTINGS, docsRoot: vault(), docsHidden: ['frontend/modules'] })
    expect(new DocsService(db).tree().map((n) => n.name)).toEqual(['brainstorm'])
  })

  it('reads a note with frontmatter and resolved links', () => {
    const doc = service().read('brainstorm/agent-orchestrator/README.md')
    expect(doc.frontmatter).toEqual({ tags: ['brainstorm'] })
    expect(doc.body.startsWith('# Hi')).toBe(true)
    expect(doc.links).toEqual({
      'Design - Nakoda': 'brainstorm/agent-orchestrator/Design - Nakoda.md',
      '_sources/figma/1-2.png': 'brainstorm/agent-orchestrator/_sources/figma/1-2.png',
      Missing: null,
    })
  })

  it('refuses paths outside the docs root (AC-D4)', () => {
    const docs = service()
    expect(() => docs.read('../outside.md')).toThrow(/outside the docs root/)
    expect(() => docs.asset('../../etc/x.png')).toThrow(/outside the docs root/)
    expect(() => docs.asset('brainstorm/agent-orchestrator/README.md')).toThrow(/Only images/)
  })

  it('needs a docs root', () => {
    expect(() => new DocsService(openDb(':memory:')).tree()).toThrow(/Set a docs root/)
  })
})

describe('splitFrontmatter', () => {
  it('keeps a body without frontmatter intact', () => {
    expect(splitFrontmatter('# Title\n---\nx')).toEqual({ frontmatter: {}, body: '# Title\n---\nx' })
  })
})
