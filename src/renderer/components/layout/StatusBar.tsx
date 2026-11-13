import { RefreshCw, Sparkles, UserCog } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { Account, UsageWindow } from '../../../shared/schemas'
import { api } from '../../api/nakoda'
import { cn } from '../../lib/cn'
import { formatReset, liveWindows, percent, timeAgo, usageTone, windowLabel } from '../../lib/usage'
import { useAppEvents } from '../../store/events'
import { toast } from '../../store/toast'
import { useRouter } from '../../store/router'
import { Popover } from '../ui/Popover'

const TONE = { ok: 'bg-foreground/70', warn: 'bg-warning', high: 'bg-destructive' }

function Bar({ w, className }: { w: UsageWindow; className?: string }) {
  return (
    <span className={cn('relative block overflow-hidden rounded-full bg-foreground/10', className)}>
      <span className={cn('absolute inset-y-0 left-0 rounded-full', TONE[usageTone(w)])} style={{ width: `${Math.min(100, percent(w))}%` }} />
    </span>
  )
}

function AccountUsageCard({ account, now }: { account: Account; now: number }) {
  const windows = liveWindows(account.usage?.windows ?? [], now)
  return (
    <div className="rounded-lg border border-border bg-background/60 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <Sparkles className="size-3.5 text-[#d97757]" /> {account.label}
          {account.isDefault && <span className="text-xs text-muted-foreground">★</span>}
        </span>
        {account.usage && <span className="text-xs text-muted-foreground">Updated {timeAgo(account.usage.updatedAt, now)}</span>}
      </div>
      {windows.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">No usage yet. It shows up after this account's first message in Nakoda.</p>
      ) : (
        <div className="space-y-3">
          {windows.map((w) => (
            <div key={w.key} data-testid={`usage-${w.key}`}>
              <div className="mb-1 text-[13px] font-medium text-foreground">{windowLabel(w.key).long}</div>
              <Bar w={w} className="h-1.5" />
              <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                <span>{percent(w)}% used</span>
                {w.resetsAt && <span>Resets in {formatReset(w.resetsAt, now)}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Bottom status bar with Claude quota, like Orca's / the Claude statusline. Numbers come from
 * what each chat turn reports; Nakoda never reads the login token.
 */
export function StatusBar() {
  const navigate = useRouter((s) => s.navigate)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [open, setOpen] = useState(false)
  const [now, setNow] = useState(Date.now())
  const load = useCallback(() => api.listAccounts().then(setAccounts, () => setAccounts([])), [])
  useEffect(() => {
    void load()
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [load])
  useAppEvents((e) => {
    if (e.type === 'account.usage' || e.type === 'account.warning') void load()
  })
  const refresh = () =>
    api.listAccounts().then(
      (list) => {
        setAccounts(list)
        setNow(Date.now())
        toast.success('Usage refreshed', 'Showing the latest limits Claude reported.')
      },
      () => toast.error('Could not refresh usage', 'The Nakoda runtime did not answer. Try again.'),
    )
  const claude = accounts.filter((a) => a.agent === 'claude')
  const main = claude.find((a) => a.isDefault && a.usage) ?? claude.find((a) => a.usage) ?? claude.find((a) => a.isDefault)
  const windows = liveWindows(main?.usage?.windows ?? [], now).slice(0, 2)

  return (
    <footer className="relative flex h-7 shrink-0 items-center gap-3 border-t border-border bg-sidebar px-3 text-xs text-muted-foreground">
      <button type="button" aria-label="Usage" onClick={() => setOpen(!open)} className="flex items-center gap-2 rounded px-1.5 py-0.5 hover:bg-secondary hover:text-foreground">
        <span>Used</span>
        <Sparkles className="size-3.5 text-[#d97757]" />
        {windows.length === 0 ? (
          <span>{claude.length === 0 ? 'no Claude account' : 'after your first message'}</span>
        ) : (
          windows.map((w) => (
            <span key={w.key} className="flex items-center gap-1.5">
              <Bar w={w} className="h-1.5 w-10" />
              <span className={cn(usageTone(w) !== 'ok' && (usageTone(w) === 'high' ? 'text-destructive' : 'text-warning'))}>
                {percent(w)}%
              </span>
              <span className="text-muted-foreground/70">{w.resetsAt ? formatReset(w.resetsAt, now) : windowLabel(w.key).short}</span>
            </span>
          ))
        )}
      </button>
      <Popover open={open} onClose={() => setOpen(false)} className="w-[22rem] p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">Usage</span>
          <button type="button" aria-label="Refresh usage" title="Refresh" onClick={() => void refresh()} className="text-muted-foreground hover:text-foreground">
            <RefreshCw className="size-3.5" />
          </button>
        </div>
        <div className="space-y-2">
          {claude.map((a) => (
            <AccountUsageCard key={a.id} account={a} now={now} />
          ))}
          {claude.length === 0 && <p className="text-[13px] text-muted-foreground">Attach a Claude account to see its usage.</p>}
        </div>
        <p className="mt-2 text-xs text-muted-foreground/70">From the limits Claude reports with each message. Nakoda never reads your login token.</p>
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            navigate({ name: 'settings', section: 'accounts' })
          }}
          className="mt-2 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-foreground/80 hover:bg-secondary"
        >
          <UserCog className="size-4" /> Manage accounts…
        </button>
      </Popover>
    </footer>
  )
}
