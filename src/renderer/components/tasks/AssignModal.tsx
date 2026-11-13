import { useState } from 'react'
import type { Workflow } from '../../../shared/schemas'
import { checkReady } from '../../../shared/readiness'
import type { Task } from '../../../shared/tasks'
import { api } from '../../api/nakoda'
import { errorText } from '../../lib/errors'
import { activeTaskIn } from '../../lib/tasks-board'
import { useWorkspaces } from '../../store/workspaces'
import { useModal } from '../../store/ui'
import { Button } from '../ui/Button'
import { Notice } from '../ui/Field'
import { Modal } from '../ui/Modal'
import { StatusDot } from '../workspace/StatusDot'

/** Give a ticket a workspace: an existing one of its project, or a new one. Disabled until the ticket is ready. */
export function AssignModal({ task, tasks, workflows, onClose, onChanged }: {
  task: Task
  tasks: Task[]
  workflows: Workflow[]
  onClose: () => void
  onChanged: () => void
}) {
  const { workspaces, repos } = useWorkspaces()
  const openModal = useModal((s) => s.open)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const workflow = workflows.find((w) => w.id === task.workflowId)
  const missing = checkReady(task, workflow?.fields)
  const repo = repos.find((r) => r.id === task.repoId)
  const candidates = workspaces.filter((w) => w.repoId === task.repoId && !w.archivedAt)

  const assign = async (workspaceId: string) => {
    setBusy(true)
    try {
      await api.assignTask(task.id, workspaceId)
      onChanged()
      onClose()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Assign to a workspace" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-foreground/80">{task.title}</p>
        {error && <Notice tone="error">{error}</Notice>}
        {missing.length > 0 ? (
          <Notice tone="info">Not ready yet. Fill in: {missing.join(', ')}.</Notice>
        ) : (
          <>
            <div className="space-y-1.5">
              <div className="text-[13px] font-medium text-muted-foreground">Existing workspaces in {repo?.name ?? 'the project'}</div>
              {candidates.length === 0 && <p className="text-xs text-muted-foreground">None yet.</p>}
              <ul className="space-y-1.5">
                {candidates.map((w) => {
                  const blocking = activeTaskIn(tasks, w.id, task.id)
                  return (
                    <li key={w.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2" data-testid="assign-candidate">
                      <StatusDot status={w.status} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{w.name}</span>
                        {blocking && <span className="block truncate text-xs text-warning">Busy with "{blocking.title}". Move it to Review or Done first.</span>}
                      </span>
                      <Button disabled={busy || Boolean(blocking)} onClick={() => void assign(w.id)}>
                        Assign
                      </Button>
                    </li>
                  )
                })}
              </ul>
            </div>
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => {
                onClose()
                openModal({ kind: 'create-workspace', projectId: task.repoId ?? undefined, taskId: task.id })
              }}
            >
              Create a new workspace
            </Button>
          </>
        )}
      </div>
    </Modal>
  )
}
