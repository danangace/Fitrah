import { BookOpen, FolderPlus, Plus, Settings } from 'lucide-react'
import type { ReactNode } from 'react'
import { APP_INFO } from '../../../shared/app-info'
import { cn } from '../../lib/cn'
import type { Route } from '../../lib/route'
import { useRouter } from '../../store/router'
import { useModal } from '../../store/ui'
import { AccountWarnings, EnableNotifications, WorkingCount } from './Attention'

/** Orca-style nav row: 13px, icon at 30% until hover. */
export function NavRow({
  active,
  icon,
  label,
  onClick,
  strong,
  hint,
}: {
  active?: boolean
  icon: ReactNode
  label: string
  onClick: () => void
  strong?: boolean
  hint?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-medium tracking-tight transition-colors',
        active ? 'bg-secondary text-foreground' : strong ? 'bg-foreground/5 text-foreground/80 hover:bg-foreground/10' : 'text-foreground/60 hover:bg-foreground/5 hover:text-foreground',
      )}
    >
      <span className={cn('shrink-0 [&>svg]:size-4', active ? 'text-foreground/70' : 'text-foreground/30 group-hover:text-foreground/60')}>{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {hint && <span className="hidden text-[10px] text-muted-foreground/60 group-hover:inline">{hint}</span>}
    </button>
  )
}

export function Sidebar({ workspaces }: { workspaces?: ReactNode }) {
  const { route, navigate } = useRouter()
  const open = useModal((s) => s.open)
  const is = (name: Route['name']) => route.name === name
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="flex h-11 items-center gap-2 px-4" title={APP_INFO.acronym}>
        <span className="flex size-5 items-center justify-center rounded-md bg-primary text-[11px] font-bold text-primary-foreground">F</span>
        <span className="text-[13px] font-semibold tracking-tight text-foreground">{APP_INFO.name}</span>
      </div>
      <nav className="flex flex-col gap-0.5 px-2 pb-1">
        <NavRow strong icon={<Plus />} label="New workspace" onClick={() => open({ kind: 'create-workspace' })} />
        <NavRow icon={<FolderPlus />} label="Add project" onClick={() => open({ kind: 'add-project' })} />
        <NavRow active={is('docs')} icon={<BookOpen />} label="Docs" onClick={() => navigate({ name: 'docs', path: '' })} />
      </nav>
      <div className="mt-2 flex h-8 items-center justify-between px-2">
        <span className="pl-2 text-xs font-semibold text-muted-foreground/80 select-none">Projects</span>
        <WorkingCount />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">{workspaces}</div>
      <AccountWarnings />
      <div className="flex flex-col gap-0.5 border-t border-border p-2">
        <EnableNotifications />
        <NavRow active={is('settings')} icon={<Settings />} label="Settings" onClick={() => navigate({ name: 'settings', section: 'general' })} />
      </div>
    </aside>
  )
}
