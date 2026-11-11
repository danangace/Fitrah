import { NewWorkspaceForm } from '../components/workspace/NewWorkspaceForm'

export function HomePage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-4 p-6">
        <h1 className="text-xl font-semibold text-white">Workspaces</h1>
        <p className="text-sm text-neutral-400">
          One workspace = one piece of work: a git worktree on its own branch, with its chats.
        </p>
        <NewWorkspaceForm />
      </div>
    </div>
  )
}
