import { Check, Pencil, RefreshCw, Star, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { Account, DetectedLogin } from '../../../shared/schemas'
import { api } from '../../api/fitrah'
import { configDirName } from '../../lib/accounts'
import { cn } from '../../lib/cn'
import { errorText } from '../../lib/errors'
import { Button } from '../ui/Button'
import { Card, Input, Notice } from '../ui/Field'
import { toast } from '../../store/toast'
import { useConfirm } from '../ui/confirm'
import { ClaudeSignIn } from './ClaudeSignIn'

const statusStyle: Record<Account['loginStatus'], string> = {
  logged_in: 'bg-success/10 text-success',
  logged_out: 'bg-warning/10 text-warning',
  unknown: 'bg-secondary text-foreground/80',
  error: 'bg-destructive/10 text-destructive',
}

function StatusBadge({ status }: { status: Account['loginStatus'] }) {
  return <span className={cn('rounded px-1.5 py-0.5 text-xs', statusStyle[status])}>{status.replace('_', ' ')}</span>
}

function AccountRow({ account, onChange, onError }: { account: Account; onChange: () => void; onError: (e: unknown) => void }) {
  const act = (fn: () => Promise<unknown>) => () => fn().then(onChange, onError)
  const confirm = useConfirm()
  const remove = async () => {
    const managed = account.kind === 'managed'
    const ok = await confirm({
      title: managed ? `Sign out ${account.label}?` : `Forget ${account.label}?`,
      description: managed ? 'This signs out and deletes the Fitrah-managed login folder.' : 'Your login folder is not touched.',
      confirmLabel: managed ? 'Sign out' : 'Forget',
      destructive: true,
    })
    if (ok) act(() => api.removeAccount(account.id))()
  }
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(account.label)
  const folder = configDirName(account.configDir)
  const saveName = () => {
    if (name.trim() === account.label) return setEditing(false)
    api.renameAccount(account.id, name).then(() => {
      setEditing(false)
      onChange()
    }, onError)
  }
  return (
    <li className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          {editing ? (
            <form
              className="flex items-center gap-1"
              onSubmit={(e) => {
                e.preventDefault()
                saveName()
              }}
            >
              <Input
                autoFocus
                aria-label="Account name"
                className="h-7 w-48"
                value={name}
                placeholder="e.g. Sekolahmu, Personal"
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setName(account.label)
                    setEditing(false)
                  }
                }}
              />
              <Button variant="ghost" type="submit" aria-label="Save name" title="Save (Enter)">
                <Check size={14} />
              </Button>
            </form>
          ) : (
            <>
              {account.label}
              {account.label !== folder && <span className="font-mono text-xs font-normal text-muted-foreground">{folder}</span>}
              <button
                type="button"
                aria-label={`Rename ${account.label}`}
                title="Rename"
                onClick={() => setEditing(true)}
                className="rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <Pencil size={12} />
              </button>
            </>
          )}
          <StatusBadge status={account.loginStatus} />
          <span className="text-xs text-muted-foreground">{account.kind}</span>
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {account.configDir}
          {account.email && ` · ${account.email}`}
          {account.loginExpiresAt && ` · login until ${new Date(account.loginExpiresAt).toLocaleDateString()}`}
        </div>
        {account.warning && <div className="mt-1 text-xs text-warning">⚠ {account.warning}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          aria-label="Make default"
          title={account.isDefault ? 'Default account' : 'Make default'}
          onClick={act(() => api.setDefaultAccount(account.id))}
          className={account.isDefault ? 'text-warning' : ''}
        >
          <Star size={14} fill={account.isDefault ? 'currentColor' : 'none'} />
        </Button>
        <Button variant="ghost" aria-label="Re-check login" title="Re-check login" onClick={act(() => api.checkAccount(account.id).then((a) => toast.success('Account refreshed', `${a.label}: login is ${a.loginStatus.replace('_', ' ')}.`)))}>
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
export function AccountSettings() {
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
          <div className="text-xs font-semibold text-muted-foreground/80">Found existing logins</div>
          <ul className="space-y-1">
            {found.map((f) => (
              <li key={f.configDir} className="flex items-center justify-between rounded-md bg-card px-3 py-1.5 text-sm">
                <span className="text-foreground/80">{f.configDir}</span>
                <Button onClick={() => api.attachAccount(f.agent, f.configDir).then(load, onError)}>Attach</Button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground/80">Accounts</div>
        {accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No account yet. Attach a login above or sign in a new account.</p>
        ) : (
          <ul className="space-y-1.5">
            {accounts.map((a) => (
              <AccountRow key={a.id} account={a} onChange={load} onError={onError} />
            ))}
          </ul>
        )}
      </div>
      <ClaudeSignIn onDone={load} />
    </Card>
  )
}
