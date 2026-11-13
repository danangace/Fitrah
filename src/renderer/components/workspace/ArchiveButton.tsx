import { Archive } from 'lucide-react'
import { useState } from 'react'
import type { Workspace } from '../../../shared/schemas'
import { ApiError } from '../../api/http-client'
import { api } from '../../api/nakoda'
import { errorText } from '../../lib/errors'
import { useRouter } from '../../store/router'
import { useWorkspaces } from '../../store/workspaces'
import { Button } from '../ui/Button'
import { Checkbox } from '../ui/Checkbox'
import { Notice } from '../ui/Field'

/** Archive a workspace. The branch is deleted only when the box is ticked (AC-W5). */
export function ArchiveButton({ workspace }: { workspace: Workspace }) {
  const [open, setOpen] = useState(false)
  const [deleteBranch, setDeleteBranch] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const navigate = useRouter((s) => s.navigate)
  const load = useWorkspaces((s) => s.load)

  const archive = async (force: boolean) => {
    setError(null)
    try {
      await api.archiveWorkspace(workspace.id, { deleteBranch, force })
      await load()
      navigate({ name: 'home' })
    } catch (e) {
      if (e instanceof ApiError && e.code === 'worktree_dirty') setDirty(true)
      else setError(errorText(e))
    }
  }

  if (!open) {
    return (
      <Button variant="ghost" onClick={() => setOpen(true)}>
        <Archive size={14} /> Archive
      </Button>
    )
  }
  return (
    <div className="space-y-2 rounded-md border border-input bg-card p-3 text-sm">
      <p className="text-foreground">Archive this workspace? Its worktree folder is removed.</p>
      <Checkbox className="text-foreground/80" checked={deleteBranch} onCheckedChange={setDeleteBranch}>
        Also delete branch <code className="text-xs">{workspace.branch}</code>
      </Checkbox>
      {error && <Notice tone="error">{error}</Notice>}
      {dirty && <Notice tone="error">The worktree has uncommitted changes. Archive anyway? They will be lost.</Notice>}
      <div className="flex gap-2">
        <Button variant="danger" onClick={() => archive(dirty)}>
          {dirty ? 'Archive and discard changes' : 'Archive'}
        </Button>
        <Button variant="ghost" onClick={() => (setOpen(false), setDirty(false))}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
