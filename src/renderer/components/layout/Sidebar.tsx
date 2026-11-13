import { BookOpen, FolderPlus, Settings } from 'lucide-react'
import { type PointerEvent, type ReactNode, useState } from 'react'
import { APP_INFO } from '../../../shared/app-info'
import { cn } from '../../lib/cn'
import { readNumber, writeNumber } from '../../lib/local-pref'
import type { Route } from '../../lib/route'
import { useRouter } from '../../store/router'
import { useModal } from '../../store/ui'
import { DocsSidebar } from '../docs-browser/DocsSidebar'
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
        'group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium tracking-tight transition-colors',
        active ? 'bg-secondary text-foreground' : strong ? 'bg-foreground/5 text-foreground/80 hover:bg-foreground/10' : 'text-foreground/60 hover:bg-foreground/5 hover:text-foreground',
      )}
    >
      <span className={cn('shrink-0 [&>svg]:size-4', active ? 'text-foreground/70' : 'text-foreground/30 group-hover:text-foreground/60')}>{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {hint && <span className="hidden text-[11px] text-muted-foreground/60 group-hover:inline">{hint}</span>}
    </button>
  )
}

const MIN_WIDTH = 240
const MAX_WIDTH = 480

export function Sidebar({ workspaces }: { workspaces?: ReactNode }) {
  const { route, navigate } = useRouter()
  const open = useModal((s) => s.open)
  const is = (name: Route['name']) => route.name === name
  // Resizable like Orca: drag the right edge; width remembered per browser.
  const [width, setWidth] = useState(() => readNumber('sidebar-width', 300))
  const startResize = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = width
    let latest = startWidth
    const move = (ev: globalThis.PointerEvent) => {
      latest = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + ev.clientX - startX))
      setWidth(latest)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      document.body.style.cursor = ''
      writeNumber('sidebar-width', latest)
    }
    document.body.style.cursor = 'col-resize'
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  return (
    <aside style={{ width }} className="relative flex shrink-0 flex-col border-r border-border bg-sidebar">
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        onPointerDown={startResize}
        onDoubleClick={() => {
          setWidth(300)
          writeNumber('sidebar-width', 300)
        }}
        className="absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize hover:bg-foreground/10"
      />
      <div className="flex flex-col items-start gap-1.5 px-4 pt-4 pb-3 text-left" title={`${APP_INFO.name}: ${APP_INFO.tagline}`}>
        <div className="flex items-center justify-start gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">{APP_INFO.name.charAt(0)}</span>
          <span className="text-base font-semibold tracking-tight text-foreground">{APP_INFO.name}</span>
        </div>
        <div className="text-[11px] leading-tight text-muted-foreground">{APP_INFO.tagline}</div>
      </div>
      {route.name === 'docs' ? (
        <DocsSidebar path={route.path} />
      ) : (
        <>
        <nav className="flex flex-col gap-0.5 px-2 pb-1">
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
        </>
      )}
    </aside>
  )
}
