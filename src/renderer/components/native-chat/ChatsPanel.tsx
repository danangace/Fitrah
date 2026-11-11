import { Plus, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Account, Chat, Settings, Workspace } from '../../../shared/schemas'
import { onChatEvent } from '../../api/chat-socket'
import { api } from '../../api/fitrah'
import { cn } from '../../lib/cn'
import { errorText } from '../../lib/errors'
import { useRouter } from '../../store/router'
import { Button } from '../ui/Button'
import { Notice } from '../ui/Field'
import { StatusDot } from '../workspace/StatusDot'
import { ChatPane } from './ChatPane'

const selectClass = 'h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm text-foreground'

/** "+" in the tab bar: pick account + model, start a chat (Orca's agent picker, simplified). */
function NewChatPopover({ workspace, onCreated, onClose }: { workspace: Workspace; onCreated: (chat: Chat) => void; onClose: () => void }) {
  const navigate = useRouter((s) => s.navigate)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [accountId, setAccountId] = useState('')
  const [model, setModel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    Promise.all([api.listAccounts(), api.getSettings()]).then(([a, s]) => {
      const claude = a.filter((x) => x.agent === 'claude')
      setAccounts(claude)
      setSettings(s)
      setAccountId((claude.find((x) => x.isDefault) ?? claude[0])?.id ?? '')
      setModel(s.models.claude.default)
    }, (e: unknown) => setError(errorText(e)))
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [onClose])

  return (
    <div ref={ref} className="absolute top-9 left-0 z-30 w-64 space-y-2 rounded-lg border border-border bg-popover p-3 shadow-xl shadow-black/40">
      <div className="text-xs font-semibold text-muted-foreground">New chat</div>
      {error && <Notice tone="error">{error}</Notice>}
      {settings && accounts.length === 0 && (
        <Notice tone="info">
          Attach a Claude account in{' '}
          <button type="button" className="underline" onClick={() => navigate({ name: 'settings', section: 'accounts' })}>
            Settings → Accounts
          </button>
          .
        </Notice>
      )}
      {accounts.length > 0 && settings && (
        <>
          <select aria-label="Account" className={selectClass} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                Claude · {a.label}
                {a.isDefault ? ' ★' : ''}
              </option>
            ))}
          </select>
          <select aria-label="Model" className={selectClass} value={model} onChange={(e) => setModel(e.target.value)}>
            {settings.models.claude.list.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <Button
            variant="primary"
            className="w-full"
            onClick={() =>
              api.createChat({ workspaceId: workspace.id, agent: 'claude', accountId, model }).then(onCreated, (e: unknown) => setError(errorText(e)))
            }
          >
            Start chat
          </Button>
        </>
      )}
    </div>
  )
}

/** Chats of a workspace as tabs (like Orca's tab bar) + the active chat filling the space. */
export function ChatsPanel({ workspace }: { workspace: Workspace }) {
  const [chats, setChats] = useState<Chat[]>([])
  const [active, setActive] = useState<string | null>(null)
  const [picker, setPicker] = useState(false)
  const load = useCallback(
    (select?: string) =>
      api.listChats(workspace.id).then((list) => {
        setChats(list)
        setActive((cur) => select ?? cur ?? list.at(-1)?.id ?? null)
      }),
    [workspace.id],
  )
  useEffect(() => {
    setActive(null)
    void load()
  }, [load])
  // Keep the tab dots live.
  useEffect(
    () =>
      onChatEvent((e) => {
        if (e.type === 'status') setChats((list) => list.map((c) => (c.id === e.chatId ? { ...c, status: e.status } : c)))
      }),
    [],
  )
  const remove = async (chat: Chat) => {
    const busy = chat.status === 'working' || chat.status === 'needs_approval'
    const what = busy ? `"${chat.title}" is still running. Stop and delete this chat?` : `Delete the chat "${chat.title}"? This cannot be undone.`
    if (!window.confirm(what)) return
    try {
      await api.deleteChat(chat.id)
    } catch (e) {
      window.alert(errorText(e))
      return
    }
    const rest = chats.filter((c) => c.id !== chat.id)
    setChats(rest)
    setActive((cur) => (cur === chat.id ? (rest.at(-1)?.id ?? null) : cur))
  }
  const closePicker = useCallback(() => setPicker(false), [])
  const current = chats.find((c) => c.id === active)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative flex h-9 shrink-0 items-end gap-0.5 border-b border-border bg-sidebar/40 px-2">
        {chats.map((c) => (
          <div
            key={c.id}
            className={cn(
              'group -mb-px flex h-8 max-w-52 items-center rounded-t-md border border-b-0 text-[13px]',
              c.id === active ? 'border-border bg-background text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <button type="button" onClick={() => setActive(c.id)} className="flex min-w-0 items-center gap-1.5 py-1 pr-1 pl-3">
              <StatusDot status={c.status} />
              <span className="truncate">{c.title}</span>
            </button>
            <button
              type="button"
              aria-label={`Delete chat ${c.title}`}
              title="Delete chat"
              onClick={() => void remove(c)}
              className="mr-1.5 flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground/60 hover:bg-secondary hover:text-destructive"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
        <div className="relative mb-1">
          <button
            type="button"
            aria-label="New chat"
            title="New chat"
            onClick={() => setPicker(!picker)}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <Plus className="size-4" />
          </button>
          {picker && (
            <NewChatPopover
              workspace={workspace}
              onClose={closePicker}
              onCreated={(c) => {
                setPicker(false)
                void load(c.id)
              }}
            />
          )}
        </div>
      </div>
      {current ? (
        <ChatPane key={current.id} chat={current} />
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <div className="space-y-3 text-center">
            <p className="text-sm text-muted-foreground">No chat in this workspace yet.</p>
            <Button variant="primary" onClick={() => setPicker(true)}>
              <Plus className="size-4" /> New chat
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
