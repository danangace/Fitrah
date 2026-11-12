import { Plus, X } from 'lucide-react'
import { Popover } from '@base-ui/react/popover'
import { useCallback, useEffect, useState } from 'react'
import type { Account, Chat, Settings, Workspace } from '../../../shared/schemas'
import { onChatEvent } from '../../api/chat-socket'
import { api } from '../../api/fitrah'
import { cn } from '../../lib/cn'
import { describeModel, useAccountModels } from '../../lib/account-models'
import { errorText } from '../../lib/errors'
import { useChatUi } from '../../store/chat-ui'
import { useRouter } from '../../store/router'
import { Button } from '../ui/Button'
import { Notice } from '../ui/Field'
import { Select } from '../ui/Select'
import { useConfirm } from '../ui/confirm'
import { StatusDot } from '../workspace/StatusDot'
import { ChatPane } from './ChatPane'


/** "+" in the tab bar: pick account + model, start a chat (Orca's agent picker, simplified). */
function NewChatForm({ workspace, onCreated }: { workspace: Workspace; onCreated: (chat: Chat) => void }) {
  const navigate = useRouter((s) => s.navigate)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [accountId, setAccountId] = useState('')
  const [model, setModel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const offered = useAccountModels(accountId || null)

  useEffect(() => {
    Promise.all([api.listAccounts(), api.getSettings()]).then(([a, s]) => {
      const claude = a.filter((x) => x.agent === 'claude')
      setAccounts(claude)
      setSettings(s)
      setAccountId((claude.find((x) => x.isDefault) ?? claude[0])?.id ?? '')
      setModel(s.models.claude.default)
    }, (e: unknown) => setError(errorText(e)))
  }, [])

  return (
    <div className="space-y-2">
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
          <Select
            aria-label="Account"
            value={accountId}
            onValueChange={setAccountId}
            options={accounts.map((a) => ({ value: a.id, label: `Claude · ${a.label}${a.isDefault ? ' ★' : ''}` }))}
          />
          <Select
            aria-label="Model"
            value={model}
            onValueChange={setModel}
            options={settings.models.claude.list.map((m) => ({ value: m, label: describeModel(offered, m).name }))}
          />
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
  // The selected tab is kept per workspace in a store, so coming back from Settings reopens the same chat.
  const active = useChatUi((s) => s.activeChat[workspace.id] ?? null)
  const setActiveChat = useChatUi((s) => s.setActiveChat)
  const [picker, setPicker] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const confirm = useConfirm()
  const load = useCallback(
    (select?: string) =>
      api.listChats(workspace.id).then((list) => {
        setChats(list)
        const cur = useChatUi.getState().activeChat[workspace.id]
        const keep = cur && list.some((c) => c.id === cur) ? cur : undefined
        setActiveChat(workspace.id, select ?? keep ?? list.at(-1)?.id ?? null)
      }),
    [workspace.id, setActiveChat],
  )
  const setActive = (id: string | null) => setActiveChat(workspace.id, id)
  useEffect(() => {
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
    const ok = await confirm({
      title: `Delete "${chat.title}"?`,
      description: busy ? 'It is still running: it will be stopped and deleted. This cannot be undone.' : 'This chat and its history are deleted. This cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true,
    })
    if (!ok) return
    try {
      await api.deleteChat(chat.id)
      setError(null)
    } catch (e) {
      setError(errorText(e))
      return
    }
    const rest = chats.filter((c) => c.id !== chat.id)
    setChats(rest)
    if (active === chat.id) setActive(rest.at(-1)?.id ?? null)
    setDraft(chat.id, '')
  }
  const setDraft = useChatUi((s) => s.setDraft)
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
        <Popover.Root open={picker} onOpenChange={setPicker}>
          <Popover.Trigger
            aria-label="New chat"
            title="New chat"
            className="mb-1 flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-secondary hover:text-foreground data-popup-open:bg-secondary data-popup-open:text-foreground"
          >
            <Plus className="size-4" />
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner side="bottom" align="start" sideOffset={6} className="z-40">
              <Popover.Popup className="w-64 origin-[var(--transform-origin)] rounded-lg border border-border bg-popover p-3 shadow-xl shadow-black/40 outline-none transition-[scale,opacity] duration-100 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
                <NewChatForm
                  workspace={workspace}
                  onCreated={(c) => {
                    setPicker(false)
                    void load(c.id)
                  }}
                />
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      </div>
      {error && (
        <div className="px-3 pt-2">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
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
