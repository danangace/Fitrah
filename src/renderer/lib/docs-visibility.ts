import type { DocNodeT } from '../../shared/schemas'

export type FolderRow = { path: string; name: string; depth: number; on: boolean; /** Inside a hidden folder, so it is hidden whatever its own switch says. */ inherited: boolean }

/** Every folder of the docs tree, in order, with whether it shows. A folder inside a hidden one is off but not switchable. */
export function folderRows(nodes: DocNodeT[], hidden: readonly string[]): FolderRow[] {
  const off = new Set(hidden)
  const out: FolderRow[] = []
  const walk = (list: DocNodeT[], depth: number, inherited: boolean) => {
    for (const n of list) {
      if (!n.dir) continue
      const own = off.has(n.path)
      out.push({ path: n.path, name: n.name, depth, on: !own && !inherited, inherited })
      walk(n.children ?? [], depth + 1, inherited || own)
    }
  }
  walk(nodes, 0, false)
  return out
}

/** Switch one folder; the result has no duplicates. */
export function setFolderShown(hidden: readonly string[], path: string, shown: boolean): string[] {
  const rest = hidden.filter((p) => p !== path)
  return shown ? rest : [...rest, path]
}
