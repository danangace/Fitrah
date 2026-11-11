import { ChevronDown, ChevronRight, FileText, Folder } from 'lucide-react'
import { useState } from 'react'
import type { DocNodeT } from '../../../shared/schemas'
import { cn } from '../../lib/cn'

function Node({ node, active, onOpen, depth }: { node: DocNodeT; active: string; onOpen: (p: string) => void; depth: number }) {
  const [open, setOpen] = useState(active.startsWith(`${node.path}/`))
  const pad = { paddingLeft: 8 + depth * 12 }
  if (!node.dir) {
    return (
      <button
        type="button"
        style={pad}
        onClick={() => onOpen(node.path)}
        className={cn(
          'flex w-full items-center gap-1.5 truncate rounded py-0.5 pr-2 text-left text-xs',
          node.path === active ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <FileText size={12} className="shrink-0" />
        <span className="truncate">{node.name.replace(/\.md$/, '')}</span>
      </button>
    )
  }
  return (
    <div>
      <button
        type="button"
        style={pad}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1 truncate py-0.5 pr-2 text-left text-xs text-foreground/80 hover:text-foreground"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <Folder size={12} className="shrink-0" />
        <span className="truncate">{node.name}</span>
      </button>
      {open && node.children?.map((c) => <Node key={c.path} node={c} active={active} onOpen={onOpen} depth={depth + 1} />)}
    </div>
  )
}

export function DocTree({ nodes, active, onOpen }: { nodes: DocNodeT[]; active: string; onOpen: (path: string) => void }) {
  return (
    <div className="space-y-0.5">
      {nodes.map((n) => (
        <Node key={n.path} node={n} active={active} onOpen={onOpen} depth={0} />
      ))}
    </div>
  )
}
