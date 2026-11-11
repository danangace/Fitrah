import { Check, ChevronDown, FilePen, Hand, Search, ShieldAlert } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { Chat, Effort, PermissionMode } from '../../../shared/schemas'
import { api } from '../../api/fitrah'
import { cn } from '../../lib/cn'
import { EFFORTS, PERMISSIONS, modelInfo } from '../../lib/models'
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

/** "Claude Sonnet · Med ▾": model + effort for the next messages (Orca's model menu). */
export function ModelPicker({ chat, onChange }: { chat: Chat; onChange: (c: Chat) => void }) {
  const [open, setOpen] = useState(false)
  const [models, setModels] = useState<string[]>([])
  const [query, setQuery] = useState('')
  useEffect(() => {
    if (open) api.getSettings().then((s) => setModels(s.models.claude.list), () => setModels([chat.model]))
  }, [open, chat.model])
  const list = useMemo(() => {
    const all = models.includes(chat.model) ? models : [chat.model, ...models]
    const q = query.trim().toLowerCase()
    return q ? all.filter((m) => `${m} ${modelInfo(m).name}`.toLowerCase().includes(q)) : all
  }, [models, chat.model, query])
  const update = (patch: { model?: string; effort?: Effort | null }) => void api.updateChat(chat.id, patch).then(onChange)
  const effortLabel = EFFORTS.find((e) => e.id === chat.effort)?.label

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Model"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] text-foreground/80 hover:bg-secondary hover:text-foreground"
      >
        {modelInfo(chat.model).name}
        {effortLabel && <span className="text-muted-foreground">{effortLabel}</span>}
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
        <div className="max-h-64 overflow-y-auto p-1">
          {list.map((m) => {
            const info = modelInfo(m)
            return (
              <button
                key={m}
                type="button"
                role="menuitemradio"
                aria-checked={m === chat.model}
                onClick={() => update({ model: m })}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-secondary"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-foreground">{info.name}</span>
                  {info.description && <span className="block text-[13px] text-muted-foreground">{info.description}</span>}
                </span>
                {m === chat.model && <Check className="size-4 text-foreground/80" />}
              </button>
            )
          })}
          {list.length === 0 && <div className="px-3 py-2 text-[13px] text-muted-foreground">No model matches. Add models in Settings → Models.</div>}
        </div>
        <div className="flex items-center gap-1 border-t border-border px-3 py-2">
          <span className="mr-2 text-[13px] text-muted-foreground">Effort</span>
          {EFFORTS.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => update({ effort: chat.effort === e.id ? null : e.id })}
              className={cn(
                'rounded-md px-2 py-1 text-[13px]',
                chat.effort === e.id ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {e.label}
            </button>
          ))}
        </div>
      </Popover>
    </div>
  )
}
