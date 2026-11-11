import { BookOpen, FolderGit2, Plus, Settings } from 'lucide-react'
import type { ReactNode } from 'react'
import { APP_INFO } from '../../../shared/app-info'
import { cn } from '../../lib/cn'
import type { Route } from '../../lib/route'
import { useRouter } from '../../store/router'

function NavItem({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm',
        active ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200',
      )}
    >
      {icon}
      {label}
    </button>
  )
}

export function Sidebar({ workspaces }: { workspaces?: ReactNode }) {
  const { route, navigate } = useRouter()
  const is = (name: Route['name']) => route.name === name
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-neutral-800 bg-neutral-950">
      <div className="px-4 py-3">
        <div className="text-lg font-semibold text-white">{APP_INFO.name}</div>
        <div className="text-xs text-neutral-500">{APP_INFO.acronym}</div>
      </div>
      <div className="flex items-center justify-between px-4 pt-2 pb-1 text-xs font-semibold tracking-wide text-neutral-500 uppercase">
        <span className="flex items-center gap-1.5">
          <FolderGit2 size={14} /> Workspaces
        </span>
        <button type="button" aria-label="New workspace" className="text-neutral-400 hover:text-white" onClick={() => navigate({ name: 'home' })}>
          <Plus size={14} />
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto px-2">{workspaces}</nav>
      <div className="space-y-0.5 border-t border-neutral-800 p-2">
        <NavItem active={is('docs')} icon={<BookOpen size={16} />} label="Docs" onClick={() => navigate({ name: 'docs', path: '' })} />
        <NavItem active={is('settings')} icon={<Settings size={16} />} label="Settings" onClick={() => navigate({ name: 'settings', section: 'general' })} />
      </div>
    </aside>
  )
}
