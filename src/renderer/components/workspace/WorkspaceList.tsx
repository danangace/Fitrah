import { ClipboardList, Folder, FolderOpen, Loader2, MessageSquare, Plus, Settings2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Repo, Workspace } from '../../../shared/schemas'
import { accountName } from '../../lib/accounts'
import { cn } from '../../lib/cn'
import { modelInfo } from '../../lib/models'
import { useAppEvents } from '../../store/events'
import { useRouter } from '../../store/router'
import { useModal } from '../../store/ui'
import { useWorkspaces } from '../../store/workspaces'
import { StatusDot } from './StatusDot'

function WorkspaceRow({ ws, active, onClick }: { ws: Workspace; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      data-testid={`workspace-row-${ws.name}`}
      onClick={onClick}
      className={cn(
        'group flex w-full items-center gap-2 rounded-md py-1.5 pr-2 pl-6 text-left transition-colors',
        active ? 'bg-secondary text-foreground' : 'text-foreground/70 hover:bg-foreground/5 hover:text-foreground',
      )}
    >
      {ws.workflowId ? (
        <ClipboardList className={cn('size-3.5 shrink-0', active ? 'text-info' : 'text-foreground/30')} />
      ) : (
        <MessageSquare className={cn('size-3.5 shrink-0', active ? 'text-foreground/70' : 'text-foreground/30')} />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm leading-snug">{ws.name}</span>
        <span className="flex items-center gap-1 truncate text-xs leading-snug text-muted-foreground/70">
          {ws.agent ? (
            <>
              <span className="size-1.5 shrink-0 rounded-full bg-[#d97757]" />
              <span className="truncate" title={ws.agent.configDir ?? undefined}>
                {modelInfo(ws.agent.model).name}
                {ws.agent.configDir && <span> · {accountName(ws.agent.accountLabel, ws.agent.configDir)}</span>}
              </span>
            </>
          ) : (
            <span className="truncate text-muted-foreground/50">No chat yet</span>
          )}
        </span>
      </span>
      {ws.status === 'working' ? (
        <Loader2 aria-label="Working" className="size-3.5 shrink-0 animate-spin text-info" />
      ) : (
        <StatusDot status={ws.status} />
      )}
    </button>
  )
}

function ProjectGroup({ repo, workspaces }: { repo: Repo; workspaces: Workspace[] }) {
  const { route, navigate } = useRouter()
  const open = useModal((s) => s.open)
  const [collapsed, setCollapsed] = useState(false)
  const active = route.name === 'project' && route.id === repo.id
  return (
    <div>
      <div className={cn('group flex h-7 items-center gap-1 rounded-md pr-1 pl-1', active && 'bg-secondary')}>
        <button
          type="button"
          aria-label={collapsed ? `Expand ${repo.name}` : `Collapse ${repo.name}`}
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'Show workspaces' : 'Hide workspaces'}
          className="flex size-5 items-center justify-center text-foreground/40 hover:text-foreground/80"
        >
          {collapsed ? <Folder className="size-3.5" /> : <FolderOpen className="size-3.5" />}
        </button>
        <button
          type="button"
          onClick={() => navigate({ name: 'project', id: repo.id })}
          className="min-w-0 flex-1 truncate text-left text-sm font-medium tracking-tight text-foreground/80 hover:text-foreground"
        >
          {repo.name}
        </button>
        <button
          type="button"
          aria-label={`Project settings for ${repo.name}`}
          title="Project settings"
          onClick={() => navigate({ name: 'project', id: repo.id })}
          className="flex size-5 items-center justify-center rounded text-foreground/30 opacity-0 group-hover:opacity-100 hover:bg-foreground/10 hover:text-foreground"
        >
          <Settings2 className="size-3.5" />
        </button>
        <button
          type="button"
          aria-label={`New workspace in ${repo.name}`}
          title="New workspace"
          onClick={() => open({ kind: 'create-workspace', projectId: repo.id })}
          className="flex size-5 items-center justify-center rounded text-foreground/40 hover:bg-foreground/10 hover:text-foreground"
        >
          <Plus className="size-3.5" />
        </button>
      </div>
      {!collapsed && (
        <div className="mt-0.5 space-y-0.5">
          {workspaces.length === 0 && <div className="py-1 pl-7 text-xs text-muted-foreground/50">No workspaces</div>}
          {workspaces.map((w) => (
            <WorkspaceRow key={w.id} ws={w} active={route.name === 'workspace' && route.id === w.id} onClick={() => navigate({ name: 'workspace', id: w.id })} />
          ))}
        </div>
      )}
    </div>
  )
}

/** Sidebar: projects → their workspaces, each with its status dot (D-14), styled like Orca. */
export function WorkspaceList() {
  const { workspaces, repos, load, patch } = useWorkspaces()
  const open = useModal((s) => s.open)
  useEffect(() => {
    void load()
  }, [load])
  useAppEvents((e) => {
    if (e.type === 'workspace.status') {
      patch(e.workspaceId, { status: e.status })
      // A turn started / ended: refresh the agent + model shown under the name.
      void load()
    }
    if (e.type === 'workspace.setup' && e.done) void load()
  })

  if (repos.length === 0) {
    return (
      <button
        type="button"
        onClick={() => open({ kind: 'add-project' })}
        className="flex w-full items-center gap-2 rounded-md border border-dashed border-input px-2 py-2 text-[13px] text-muted-foreground hover:text-foreground"
      >
        <Plus className="size-3.5" /> Add your first project
      </button>
    )
  }
  return (
    <div className="space-y-2">
      {repos.map((repo) => (
        <ProjectGroup key={repo.id} repo={repo} workspaces={workspaces.filter((w) => w.repoId === repo.id)} />
      ))}
    </div>
  )
}
