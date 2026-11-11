import { FolderPlus, Plus } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { useModal } from '../store/ui'

export function HomePage() {
  const open = useModal((s) => s.open)
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-xl font-semibold text-foreground">Start working</h1>
        <p className="text-sm text-muted-foreground">
          A workspace is a git worktree on its own branch, with its chats. Start with a free chat, or pick a workflow so Claude
          gets your PRD, Figma and other references every turn.
        </p>
        <div className="flex justify-center gap-2">
          <Button variant="primary" onClick={() => open({ kind: 'create-workspace' })}>
            <Plus size={14} /> New workspace
          </Button>
          <Button onClick={() => open({ kind: 'add-project' })}>
            <FolderPlus size={14} /> Add project
          </Button>
        </div>
      </div>
    </div>
  )
}
