import { Bell, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Account } from '../../../shared/schemas'
import { api } from '../../api/fitrah'
import { notificationFor } from '../../lib/notify'
import { useAppEvents } from '../../store/events'
import { useRouter } from '../../store/router'
import { useWorkspaces } from '../../store/workspaces'

/** Browser notifications for workspaces that need you while the tab is hidden (AC-N2). */
export function WorkspaceNotifier() {
  const navigate = useRouter((s) => s.navigate)
  useAppEvents((e) => {
    if (e.type !== 'workspace.status' || typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    const body = notificationFor(e.status, document.hidden)
    if (!body) return
    const ws = useWorkspaces.getState().workspaces.find((w) => w.id === e.workspaceId)
    const n = new Notification(`Fitrah · ${ws?.name ?? 'workspace'}`, { body, tag: e.workspaceId })
    n.addEventListener('click', () => {
      window.focus()
      navigate({ name: 'workspace', id: e.workspaceId })
    })
  })
  return null
}

export function EnableNotifications() {
  const [permission, setPermission] = useState(typeof Notification === 'undefined' ? 'denied' : Notification.permission)
  if (permission !== 'default') return null
  return (
    <button
      type="button"
      onClick={() => void Notification.requestPermission().then(setPermission)}
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-neutral-400 hover:bg-neutral-900"
    >
      <Bell size={13} /> Enable notifications
    </button>
  )
}

/** "2 working · 1 needs you" above the workspace list. */
export function WorkingCount() {
  const workspaces = useWorkspaces((s) => s.workspaces)
  const working = workspaces.filter((w) => w.status === 'working').length
  const waiting = workspaces.filter((w) => w.status === 'needs_approval').length
  if (!working && !waiting) return null
  return (
    <div className="px-4 pb-1 text-[11px] text-neutral-500">
      {working > 0 && <span className="text-sky-400">{working} working</span>}
      {working > 0 && waiting > 0 && ' · '}
      {waiting > 0 && <span className="text-amber-400">{waiting} need you</span>}
    </div>
  )
}

/** Accounts that hit a usage limit (or have a login problem) (AC-N3). */
export function AccountWarnings() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const navigate = useRouter((s) => s.navigate)
  const load = () => api.listAccounts().then(setAccounts, () => setAccounts([]))
  useEffect(() => {
    void load()
  }, [])
  useAppEvents((e) => {
    if (e.type === 'account.warning') void load()
  })
  const warned = accounts.filter((a) => a.warning)
  if (warned.length === 0) return null
  return (
    <div className="space-y-1 px-2 pb-2">
      {warned.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={() => navigate({ name: 'settings', section: 'accounts' })}
          className="flex w-full items-start gap-1.5 rounded-md bg-amber-950/50 px-2 py-1.5 text-left text-[11px] text-amber-300"
        >
          <TriangleAlert size={12} className="mt-0.5 shrink-0" />
          <span>
            Claude · {a.label}: {a.warning}
          </span>
        </button>
      ))}
    </div>
  )
}
