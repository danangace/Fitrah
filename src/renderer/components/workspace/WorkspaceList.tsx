import { ClipboardList, FolderGit2, MessageSquare, Plus, Settings2 } from 'lucide-react'
import { useEffect } from 'react'
import { cn } from '../../lib/cn'
import { useAppEvents } from '../../store/events'
import { useRouter } from '../../store/router'
import { useModal } from '../../store/ui'
import { useWorkspaces } from '../../store/workspaces'
import { StatusDot } from './StatusDot'

/** Sidebar: projects → their workspaces, each with its status dot (D-14). */
export function WorkspaceList() {
  const { workspaces, repos, load, patch } = useWorkspaces()
  const { route, navigate } = useRouter()
  const open = useModal((s) => s.open)
  useEffect(() => {
    void load()
  }, [load])
  useAppEvents((e) => {
    if (e.type === 'workspace.status') patch(e.workspaceId, { status: e.status })
    if (e.type === 'workspace.setup' && e.done) void load()
  })

  if (repos.length === 0) {
    return (
      <button
        type="button"
        onClick={() => open({ kind: 'add-project' })}
        className="mx-2 flex w-[calc(100%-1rem)] items-center gap-1.5 rounded-md border border-dashed border-neutral-700 px-2 py-2 text-xs text-neutral-400 hover:text-white"
      >
        <Plus size={13} /> Add your first project
      </button>
    )
  }
  return (
    <div className="space-y-3">
      {repos.map((repo) => (
          <div key={repo.id}>
            <div className="group flex items-center gap-1 px-2 pb-0.5">
              <FolderGit2 size={12} className="shrink-0 text-neutral-500" />
              <button
                type="button"
                onClick={() => navigate({ name: 'project', id: repo.id })}
                className="min-w-0 flex-1 truncate text-left text-[12px] font-medium text-neutral-400 hover:text-white"
              >
                {repo.name}
              </button>
              <button
                type="button"
                aria-label={`Project settings for ${repo.name}`}
                title="Project settings"
                onClick={() => navigate({ name: 'project', id: repo.id })}
                className="text-neutral-600 opacity-0 group-hover:opacity-100 hover:text-white"
              >
                <Settings2 size={12} />
              </button>
              <button
                type="button"
                aria-label={`New workspace in ${repo.name}`}
                title="New workspace"
                onClick={() => open({ kind: 'create-workspace', projectId: repo.id })}
                className="text-neutral-500 hover:text-white"
              >
                <Plus size={13} />
              </button>
            </div>
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
