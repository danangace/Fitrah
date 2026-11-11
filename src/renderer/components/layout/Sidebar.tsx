import { BookOpen, FolderPlus, Plus, Settings } from 'lucide-react'
import type { ReactNode } from 'react'
import { APP_INFO } from '../../../shared/app-info'
import { cn } from '../../lib/cn'
import type { Route } from '../../lib/route'
import { useRouter } from '../../store/router'
import { useModal } from '../../store/ui'
import { AccountWarnings, EnableNotifications, WorkingCount } from './Attention'

function NavItem({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm',
        active ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
      )}
    >
      {icon}
      {label}
    </button>
  )
}

export function Sidebar({ workspaces }: { workspaces?: ReactNode }) {
  const { route, navigate } = useRouter()
  const open = useModal((s) => s.open)
  const is = (name: Route['name']) => route.name === name
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-background">
      <div className="px-4 py-3">
        <div className="text-lg font-semibold text-foreground">{APP_INFO.name}</div>
        <div className="text-xs text-muted-foreground">{APP_INFO.acronym}</div>
      </div>
      <div className="space-y-0.5 px-2 pb-2">
        <button
          type="button"
          onClick={() => open({ kind: 'create-workspace' })}
          className="flex w-full items-center gap-2 rounded-md bg-secondary px-2 py-1.5 text-left text-sm font-medium text-foreground hover:bg-secondary"
        >
          <Plus size={15} /> New workspace
        </button>
        <button
          type="button"
          onClick={() => open({ kind: 'add-project' })}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <FolderPlus size={15} /> Add project
        </button>
      </div>
      <div className="px-4 pt-1 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Projects</div>
      <WorkingCount />
      <nav className="flex-1 overflow-y-auto px-2">{workspaces}</nav>
      <AccountWarnings />
      <div className="space-y-0.5 border-t border-border p-2">
        <EnableNotifications />
        <NavItem active={is('docs')} icon={<BookOpen size={16} />} label="Docs" onClick={() => navigate({ name: 'docs', path: '' })} />
        <NavItem active={is('settings')} icon={<Settings size={16} />} label="Settings" onClick={() => navigate({ name: 'settings', section: 'general' })} />
      </div>
    </aside>
  )
}
