import { ArrowLeft } from 'lucide-react'
import { cn } from '../../lib/cn'
import { SETTINGS_SECTIONS, resolveSettingsSection } from '../../lib/settings-sections'
import { useRouter } from '../../store/router'

/** Replaces the main sidebar content while Settings is open: a back button, then the section list. */
export function SettingsSidebar({ section }: { section: string }) {
  const navigate = useRouter((s) => s.navigate)
  const active = resolveSettingsSection(section)
  return (
    <>
      <div className="px-2 pb-1">
        <button
          type="button"
          onClick={() => navigate({ name: 'home' })}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium text-foreground/70 transition-colors hover:bg-foreground/5 hover:text-foreground"
        >
          <ArrowLeft className="size-4 shrink-0" />
          <span>Back to Nakoda</span>
        </button>
      </div>
      <div className="mt-2 flex h-8 items-center px-2">
        <span className="pl-2 text-xs font-semibold text-muted-foreground/80 select-none">Settings</span>
      </div>
      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-2">
        {SETTINGS_SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => navigate({ name: 'settings', section: s.id })}
            className={cn(
              'rounded-md px-2 py-1.5 text-left text-sm font-medium tracking-tight transition-colors',
              s.id === active ? 'bg-secondary text-foreground' : 'text-foreground/60 hover:bg-foreground/5 hover:text-foreground',
            )}
          >
            {s.label}
          </button>
        ))}
      </nav>
    </>
  )
}
