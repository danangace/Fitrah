import { ClipboardList, MessageSquare } from 'lucide-react'
import { useEffect } from 'react'
import { cn } from '../../lib/cn'
import { useAppEvents } from '../../store/events'
import { useRouter } from '../../store/router'
import { useWorkspaces } from '../../store/workspaces'
import { StatusDot } from './StatusDot'

/** Sidebar: repo → workspaces, each with its status dot. */
export function WorkspaceList() {
  const { workspaces, repos, load, patch } = useWorkspaces()
  const { route, navigate } = useRouter()
  useEffect(() => {
    void load()
  }, [load])
  useAppEvents((e) => {
    if (e.type === 'workspace.status') patch(e.workspaceId, { status: e.status })
    if (e.type === 'workspace.setup' && e.done) void load()
  })

  if (workspaces.length === 0) return <p className="px-2 py-1 text-xs text-neutral-600">No workspaces yet.</p>
  return (
    <div className="space-y-3">
      {repos
        .filter((r) => workspaces.some((w) => w.repoId === r.id))
        .map((repo) => (
          <div key={repo.id}>
            <div className="px-2 pb-0.5 text-[11px] text-neutral-500">{repo.name}</div>
            {workspaces
              .filter((w) => w.repoId === repo.id)
              .map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => navigate({ name: 'workspace', id: w.id })}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm',
                    route.name === 'workspace' && route.id === w.id
                      ? 'bg-neutral-800 text-white'
                      : 'text-neutral-300 hover:bg-neutral-900',
                  )}
                >
                  {w.workflowId ? (
                    <ClipboardList size={13} className="shrink-0 text-sky-400" />
                  ) : (
                    <MessageSquare size={13} className="shrink-0 text-emerald-400" />
                  )}
                  <span className="min-w-0 flex-1 truncate">{w.name}</span>
                  <StatusDot status={w.status} />
                </button>
              ))}
          </div>
        ))}
    </div>
  )
}
