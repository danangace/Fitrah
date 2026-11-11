import { useWorkspaces } from '../store/workspaces'
import { RepoRow } from '../components/settings/RepoSettings'
import { Notice } from '../components/ui/Field'

/** One project: its settings (base, branch prefix, scripts). */
export function ProjectPage({ id }: { id: string }) {
  const { repos, load, loaded } = useWorkspaces()
  const repo = repos.find((r) => r.id === id)
  if (!repo) return loaded ? <div className="p-6"><Notice tone="error">Project not found.</Notice></div> : null
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <h1 className="text-xl font-semibold text-white">Project settings</h1>
        <RepoRow key={repo.id} repo={repo} onChange={() => void load()} />
      </div>
    </div>
  )
}
