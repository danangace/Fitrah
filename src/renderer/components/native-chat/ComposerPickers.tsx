import { Check, ChevronDown, FilePen, Hand, Search, ShieldAlert, UserRound } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { Account, Chat, Effort, PermissionMode } from '../../../shared/schemas'
import { api } from '../../api/nakoda'
import { configDirName } from '../../lib/accounts'
import { describeModel, useAccountModels } from '../../lib/account-models'
import { cn } from '../../lib/cn'
import { EFFORTS, PERMISSIONS } from '../../lib/models'
import { Popover } from '../ui/Popover'

const PERMISSION_ICON: Record<PermissionMode, typeof Hand> = { ask: Hand, 'accept-edits': FilePen, full: ShieldAlert }

/** "Accept edits ▾": how much the chat may do without asking (Orca's permission menu). */
export function PermissionPicker({ chat, onChange }: { chat: Chat; onChange: (c: Chat) => void }) {
  const [open, setOpen] = useState(false)
  const current = PERMISSIONS.find((p) => p.id === chat.permissionMode) ?? PERMISSIONS[1]
  const Icon = PERMISSION_ICON[chat.permissionMode]
  const pick = (mode: PermissionMode) => {
    setOpen(false)
    void api.updateChat(chat.id, { permissionMode: mode }).then(onChange)
  }
  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Permission"
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] hover:bg-secondary',
          chat.permissionMode === 'full' ? 'text-warning' : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <Icon className="size-4" /> {current.label} <ChevronDown className="size-3.5 opacity-60" />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} className="w-80">
        {PERMISSIONS.map((p) => {
          const ItemIcon = PERMISSION_ICON[p.id]
          const active = p.id === chat.permissionMode
          return (
            <button
              key={p.id}
              type="button"
              role="menuitemradio"
              aria-checked={active}
              onClick={() => pick(p.id)}
              className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left hover:bg-secondary"
            >
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full" style={{ background: active ? 'currentColor' : 'transparent' }} />
              <ItemIcon className={cn('mt-0.5 size-4 shrink-0', p.id === 'full' ? 'text-warning' : 'text-foreground/70')} />
              <span className="min-w-0">
                <span className={cn('block text-sm', p.id === 'full' ? 'text-warning' : 'text-foreground')}>{p.label}</span>
                <span className="block text-[13px] text-muted-foreground">{p.description}</span>
              </span>
            </button>
          )
        })}
      </Popover>
    </div>
  )
}

/**
 * Which Claude login this chat runs on (e.g. `.claude` or `.claude-sid`). Read-only: the conversation
 * lives in that login's transcript, so switching account means starting a new chat.
 */
export function AccountBadge({ chat }: { chat: Chat }) {
  const [account, setAccount] = useState<Account | null>(null)
  useEffect(() => {
    if (!chat.accountId) return setAccount(null)
    let alive = true
    api.listAccounts().then(
      (list) => alive && setAccount(list.find((a) => a.id === chat.accountId) ?? null),
      () => alive && setAccount(null),
    )
    return () => {
      alive = false
    }
  }, [chat.accountId])

  const folder = account ? configDirName(account.configDir) : null
  // "Sekolahmu · .claude-sid" once renamed; just the folder while the name is still the folder.
  const name = account && folder ? (account.label === folder ? folder : `${account.label} · ${folder}`) : chat.accountId ? 'unknown account' : 'no account'
  const title = account
    ? [`Claude account: ${account.label}`, account.email, account.configDir, 'To use another account, start a new chat.'].filter(Boolean).join('\n')
    : 'This chat has no attached account.'
  return (
    <span
      aria-label={`Account ${name}`}
      title={title}
      className={cn(
        'flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-xs',
        account ? 'text-muted-foreground' : 'text-warning',
      )}
    >
      <UserRound className="size-3.5" /> {name}
    </span>
  )
}

/** "Opus 5.5 · Med ▾": model + effort for the next messages (Orca's model menu). */
export function ModelPicker({ chat, onChange }: { chat: Chat; onChange: (c: Chat) => void }) {
  const [open, setOpen] = useState(false)
  const [models, setModels] = useState<string[]>([])
  const [query, setQuery] = useState('')
  // Names, descriptions and effort levels come from the chat's account (Settings → Models).
  const offered = useAccountModels(chat.accountId)
  const describe = (id: string) => describeModel(offered, id)
  useEffect(() => {
    if (open) api.getSettings().then((s) => setModels(s.models.claude.list), () => setModels([chat.model]))
  }, [open, chat.model])
  const list = useMemo(() => {
    const all = models.includes(chat.model) ? models : [chat.model, ...models]
    const q = query.trim().toLowerCase()
    return q ? all.filter((m) => `${m} ${describe(m).name}`.toLowerCase().includes(q)) : all
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [models, chat.model, query, offered])
  const supported = offered.find((o) => o.value === chat.model)?.efforts ?? []
  const update = (patch: { model?: string; effort?: Effort | null }) => void api.updateChat(chat.id, patch).then(onChange)
  const effortInfo = EFFORTS.find((e) => e.id === chat.effort)

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Model"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-md px-2 py-1 text-[13px] hover:bg-secondary"
      >
        <span className="font-medium text-foreground/80">{describe(chat.model).name}</span>
        {effortInfo && (
          <span className="rounded px-1.5 py-px text-xs font-semibold" style={{ color: effortInfo.color, backgroundColor: `${effortInfo.color}26` }}>
            {effortInfo.label}
          </span>
        )}
        <ChevronDown className="size-3.5 opacity-60" />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} align="right" className="w-96 p-0">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
          <Search className="size-4 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search models…"
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
          />
        </div>
        <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto p-2">
          {list.map((m) => {
            const info = describe(m)
            return (
              <button
                key={m}
                type="button"
                role="menuitemradio"
                aria-checked={m === chat.model}
                onClick={() => update({ model: m })}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-secondary',
                  m === chat.model && 'bg-primary/15 ring-1 ring-primary/50',
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className={cn('block text-sm', m === chat.model ? 'font-semibold text-foreground' : 'text-foreground')}>{info.name}</span>
                  {info.description && <span className="block text-[13px] text-muted-foreground">{info.description}</span>}
                </span>
                {m === chat.model && <Check className="size-4 text-primary" />}
              </button>
            )
          })}
          {list.length === 0 && <div className="px-3 py-2 text-[13px] text-muted-foreground">No model matches. Switch models on in Settings → Models.</div>}
        </div>
        <div className="flex items-center gap-1.5 border-t border-border px-3 py-2.5">
          <span className="mr-2 text-[13px] text-muted-foreground">Effort</span>
          {EFFORTS.filter((e) => supported.length === 0 || supported.includes(e.id)).map((e) => {
            const selected = chat.effort === e.id
            return (
              <button
                key={e.id}
                type="button"
                aria-pressed={selected}
                onClick={() => update({ effort: selected ? null : e.id })}
                style={selected ? { color: e.color, backgroundColor: `${e.color}2e`, boxShadow: `inset 0 0 0 1px ${e.color}99` } : { color: e.color }}
                className={cn('rounded-md px-2 py-1 text-[13px]', selected ? 'font-semibold' : 'opacity-60 hover:opacity-100')}
              >
                {e.label}
              </button>
            )
          })}
        </div>
      </Popover>
    </div>
  )
}
