import { readFileSync } from 'node:fs'
import { extname, resolve, sep } from 'node:path'
import { parse as parseYaml } from 'yaml'
import type { DocNodeT } from '../../shared/schemas'
import { UserError } from '../errors'
import { expandHome, isDirectory } from '../paths'
import { getSettings } from '../settings/store'
import type { Db } from '../sqlite/db'
import { IMAGE_EXT, buildTree, listFiles, resolveLink, wikiTargets } from './index'

export type DocFile = {
  path: string
  frontmatter: Record<string, unknown>
  body: string
  /** wiki-link / embed target → resolved docs path (null when not found). */
  links: Record<string, string | null>
}

/** Read-only access to the docs root (D-5). There is no write path in this module. */
export class DocsService {
  private cache: { root: string; files: string[] } | null = null

  constructor(private db: Db) {}

  root(): string {
    const docsRoot = getSettings(this.db).docsRoot
    if (!docsRoot) throw new UserError('docs_root_not_set', 'Set a docs root in Settings first', 409)
    const root = expandHome(docsRoot)
    if (!isDirectory(root)) throw new UserError('docs_root_missing', `Docs root does not exist: ${root}`, 409)
    return root
  }

  files(): string[] {
    const root = this.root()
    if (this.cache?.root !== root) this.cache = { root, files: listFiles(root) }
    return this.cache.files
  }

  /** Called by the watcher when files change. */
  invalidate(): void {
    this.cache = null
  }

  tree(): DocNodeT[] {
    return buildTree(this.files())
  }

  /** Resolve a relative path and refuse anything outside the docs root (AC-D4). */
  safePath(rel: string): string {
    const root = this.root()
    const full = resolve(root, rel)
    if (full !== root && !full.startsWith(root + sep)) throw new UserError('outside_docs_root', 'Path is outside the docs root', 400)
    return full
  }

  read(rel: string): DocFile {
    if (!rel.endsWith('.md')) throw new UserError('not_markdown', 'Only markdown notes can be opened')
    const full = this.safePath(rel)
    let raw: string
    try {
      raw = readFileSync(full, 'utf8')
    } catch {
      throw new UserError('doc_not_found', `Note not found: ${rel}`, 404)
    }
    const { frontmatter, body } = splitFrontmatter(raw)
    const files = this.files()
    const links: Record<string, string | null> = {}
    for (const target of wikiTargets(body)) links[target] = resolveLink(files, target, rel)
    return { path: rel, frontmatter, body, links }
  }

  asset(rel: string): { full: string; type: string } {
    const ext = extname(rel).toLowerCase()
    if (!IMAGE_EXT.has(ext)) throw new UserError('not_an_image', 'Only images can be served')
    return { full: this.safePath(rel), type: ext === '.svg' ? 'image/svg+xml' : `image/${ext.slice(1).replace('jpg', 'jpeg')}` }
  }
}

export function splitFrontmatter(raw: string): { frontmatter: Record<string, unknown>; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!match) return { frontmatter: {}, body: raw }
  try {
    const data = parseYaml(match[1] ?? '') as unknown
    return {
      frontmatter: data && typeof data === 'object' ? (data as Record<string, unknown>) : {},
      body: raw.slice(match[0].length),
    }
  } catch {
    return { frontmatter: {}, body: raw }
  }
}
