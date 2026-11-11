import { RefreshCw, Star, Trash2 } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useState } from 'react'
import type { Account, DetectedLogin } from '../../../shared/schemas'
import { api } from '../../api/fitrah'
import { cn } from '../../lib/cn'
import { errorText } from '../../lib/errors'
import { Button } from '../ui/Button'
import { Card, Notice } from '../ui/Field'

const statusStyle: Record<Account['loginStatus'], string> = {
  logged_in: 'bg-emerald-950 text-emerald-300',
  logged_out: 'bg-amber-950 text-amber-300',
  unknown: 'bg-neutral-800 text-neutral-300',
  error: 'bg-red-950 text-red-300',
}

function StatusBadge({ status }: { status: Account['loginStatus'] }) {
  return <span className={cn('rounded px-1.5 py-0.5 text-xs', statusStyle[status])}>{status.replace('_', ' ')}</span>
}

function AccountRow({ account, onChange, onError }: { account: Account; onChange: () => void; onError: (e: unknown) => void }) {
  const act = (fn: () => Promise<unknown>) => () => fn().then(onChange, onError)
  const remove = () => {
    const what =
      account.kind === 'managed'
        ? 'Sign out and delete this Fitrah-managed login folder?'
        : 'Forget this account? Your login folder is not touched.'
    if (window.confirm(what)) act(() => api.removeAccount(account.id))()
  }
  return (
    <li className="flex items-center justify-between gap-3 rounded-md border border-neutral-800 px-3 py-2">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm font-medium text-white">
          {account.label}
          <StatusBadge status={account.loginStatus} />
          <span className="text-xs text-neutral-500">{account.kind}</span>
        </div>
        <div className="truncate text-xs text-neutral-500">
          {account.configDir}
          {account.email && ` · ${account.email}`}
          {account.loginExpiresAt && ` · login until ${new Date(account.loginExpiresAt).toLocaleDateString()}`}
        </div>
        {account.warning && <div className="mt-1 text-xs text-amber-400">⚠ {account.warning}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          aria-label="Make default"
          title={account.isDefault ? 'Default account' : 'Make default'}
          onClick={act(() => api.setDefaultAccount(account.id))}
          className={account.isDefault ? 'text-amber-400' : ''}
        >
          <Star size={14} fill={account.isDefault ? 'currentColor' : 'none'} />
        </Button>
        <Button variant="ghost" aria-label="Re-check login" title="Re-check login" onClick={act(() => api.checkAccount(account.id))}>
          <RefreshCw size={14} />
        </Button>
        <Button variant="ghost" aria-label="Remove account" title="Remove" onClick={remove}>
          <Trash2 size={14} />
        </Button>
      </div>
    </li>
  )
}

/** Settings → Accounts (D-11). V1: Claude only; Codex comes after the beta (D-13). */
export function AccountSettings({ signIn }: { signIn?: ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [found, setFound] = useState<DetectedLogin[]>([])
  const [error, setError] = useState<string | null>(null)
  const onError = (e: unknown) => setError(errorText(e))

  const load = useCallback(() => {
    setError(null)
    Promise.all([api.listAccounts(), api.detectLogins()]).then(([a, d]) => {
      setAccounts(a)
      setFound(d.filter((x) => !x.attached))
    }, onError)
  }, [])
  useEffect(load, [load])

  return (
    <Card title="Accounts · Claude">
      {error && <Notice tone="error">{error}</Notice>}
      {found.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">Found existing logins</div>
          <ul className="space-y-1">
            {found.map((f) => (
              <li key={f.configDir} className="flex items-center justify-between rounded-md bg-neutral-900 px-3 py-1.5 text-sm">
                <span className="text-neutral-300">{f.configDir}</span>
                <Button onClick={() => api.attachAccount(f.agent, f.configDir).then(load, onError)}>Attach</Button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="space-y-2">
        <div className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">Accounts</div>
        {accounts.length === 0 ? (
          <p className="text-sm text-neutral-500">No account yet. Attach a login above or sign in a new account.</p>
        ) : (
          <ul className="space-y-1.5">
            {accounts.map((a) => (
              <AccountRow key={a.id} account={a} onChange={load} onError={onError} />
            ))}
          </ul>
        )}
      </div>
      {signIn}
    </Card>
  )
}
