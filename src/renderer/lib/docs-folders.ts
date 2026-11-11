import type { DocNodeT } from '../../shared/schemas'

/** All folder paths in the docs tree, for the "docs folder" field suggestions. */
export function docFolders(nodes: DocNodeT[]): string[] {
  const out: string[] = []
  const walk = (list: DocNodeT[]) => {
    for (const n of list) {
      if (!n.dir) continue
      out.push(n.path)
      if (n.children) walk(n.children)
    }
  }
  walk(nodes)
  return out
}
