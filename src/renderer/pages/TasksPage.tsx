import { ExternalTasks } from '../components/tasks/ExternalTasks'
import { cn } from '../lib/cn'
import { TASK_TABS, resolveTaskTab } from '../lib/tasks-tabs'
import { useRouter } from '../store/router'

/** Tasks: our board (next step) and the External tab, where tickets from Helix and others are read. */
export function TasksPage({ tab }: { tab: string }) {
  const navigate = useRouter((s) => s.navigate)
  const active = resolveTaskTab(tab)
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-4 p-6">
        <h1 className="text-xl font-semibold text-foreground">Tasks</h1>
        <div role="tablist" aria-label="Task sources" className="flex gap-1 border-b border-border">
          {TASK_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={t.id === active}
              onClick={() => navigate({ name: 'tasks', tab: t.id })}
              className={cn(
                '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                t.id === active ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        {active === 'external' ? (
          <ExternalTasks />
        ) : (
          <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Our board is coming next. For now, open the External tab to read your tickets from Helix.
          </div>
        )}
      </div>
    </div>
  )
}
