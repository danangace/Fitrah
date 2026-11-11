import { ChevronDown, ChevronRight, FileText, Folder } from 'lucide-react'
import { useState } from 'react'
import type { DocNodeT } from '../../../shared/schemas'
import { cn } from '../../lib/cn'

function Node({ node, active, onOpen, depth }: { node: DocNodeT; active: string; onOpen: (p: string) => void; depth: number }) {
  const [open, setOpen] = useState(active.startsWith(`${node.path}/`))
  const pad = { paddingLeft: 8 + depth * 14 }
  if (!node.dir) {
    return (
      <button
        type="button"
        style={pad}
        onClick={() => onOpen(node.path)}
        className={cn(
          'flex w-full items-center gap-2 truncate rounded-md py-1 pr-2 text-left text-sm',
          node.path === active ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <FileText size={16} className="shrink-0" />
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
        className="flex w-full items-center gap-1.5 truncate rounded-md py-1 pr-2 text-left text-sm font-medium text-foreground/80 hover:bg-foreground/5 hover:text-foreground"
      >
        {open ? <ChevronDown size={16} className="shrink-0" /> : <ChevronRight size={16} className="shrink-0" />}
        <Folder size={16} className="shrink-0" />
        <span className="truncate">{node.name}</span>
      </button>
      {open && node.children?.map((c) => <Node key={c.path} node={c} active={active} onOpen={onOpen} depth={depth + 1} />)}
    </div>
  )
}

export function DocTree({ nodes, active, onOpen }: { nodes: DocNodeT[]; active: string; onOpen: (path: string) => void }) {
  return (
    <div className="space-y-px">
      {nodes.map((n) => (
        <Node key={n.path} node={n} active={active} onOpen={onOpen} depth={0} />
      ))}
    </div>
  )
}
