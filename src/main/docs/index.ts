import { readdirSync } from 'node:fs'
import { basename, extname, join, relative, sep } from 'node:path'
import type { DocNodeT } from '../../shared/schemas'

const SKIP = new Set(['.git', '.obsidian', '.trash', 'node_modules'])
export const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'])

/** All files under the docs root (relative, `/`-separated), hidden folders skipped. */
export function listFiles(root: string, dir = root, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || SKIP.has(entry.name)) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) listFiles(root, full, out)
    else out.push(relative(root, full).split(sep).join('/'))
  }
  return out
}

/** Markdown tree: folders first, then notes; folders without notes are dropped. */
export function buildTree(files: string[]): DocNodeT[] {
  const root: DocNodeT = { name: '', path: '', dir: true, children: [] }
  for (const file of files.filter((f) => f.endsWith('.md'))) {
    const parts = file.split('/')
    let node = root
    parts.forEach((part, i) => {
      const path = parts.slice(0, i + 1).join('/')
      const isDir = i < parts.length - 1
      node.children ??= []
      let child = node.children.find((c) => c.name === part)
      if (!child) {
        child = isDir ? { name: part, path, dir: true, children: [] } : { name: part, path, dir: false }
        node.children.push(child)
      }
      node = child
    })
  }
  const sort = (nodes: DocNodeT[]): DocNodeT[] =>
    nodes
      .map((n) => (n.children ? { ...n, children: sort(n.children) } : n))
      .toSorted((a, b) => Number(b.dir) - Number(a.dir) || a.name.localeCompare(b.name))
  return sort(root.children ?? [])
}

/**
 * Obsidian-style link resolution: a path relative to the note, then from the root, then a
 * basename match anywhere (shortest path wins). `.md` is implied for wiki-links.
 */
export function resolveLink(files: string[], target: string, fromNote: string): string | null {
  const clean = target.split('#')[0]?.trim() ?? ''
  if (!clean) return null
  const candidates = extname(clean) ? [clean] : [`${clean}.md`, clean]
  const noteDir = fromNote.includes('/') ? fromNote.slice(0, fromNote.lastIndexOf('/')) : ''
  const set = new Set(files)
  for (const c of candidates) {
    const rel = noteDir ? `${noteDir}/${c}` : c
    if (set.has(rel)) return rel
    if (set.has(c)) return c
  }
  for (const c of candidates) {
    const name = basename(c)
    const hits = files.filter((f) => basename(f) === name).toSorted((a, b) => a.length - b.length)
    if (hits[0]) return hits[0]
  }
  return null
}

/** Every `[[target|alias]]` and `![[target|size]]` in a note. */
export function wikiTargets(body: string): string[] {
  return [...body.matchAll(/!?\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)].map((m) => (m[1] ?? '').trim())
}
