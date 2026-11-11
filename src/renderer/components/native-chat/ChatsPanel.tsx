import { MessageSquarePlus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { Account, Chat, Settings, Workspace } from '../../../shared/schemas'
import { onChatEvent } from '../../api/chat-socket'
import { api } from '../../api/fitrah'
import { cn } from '../../lib/cn'
import { errorText } from '../../lib/errors'
import { useRouter } from '../../store/router'
import { StatusDot } from '../workspace/StatusDot'
import { Button } from '../ui/Button'
import { Card, Notice } from '../ui/Field'
import { ChatPane } from './ChatPane'

const selectClass = 'rounded-md border border-input bg-card px-2 py-1.5 text-sm'

function NewChat({ workspace, onCreated }: { workspace: Workspace; onCreated: (chat: Chat) => void }) {
  const navigate = useRouter((s) => s.navigate)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [accountId, setAccountId] = useState('')
  const [model, setModel] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([api.listAccounts(), api.getSettings()]).then(([a, s]) => {
      const claude = a.filter((x) => x.agent === 'claude')
      setAccounts(claude)
      setSettings(s)
      setAccountId((claude.find((x) => x.isDefault) ?? claude[0])?.id ?? '')
      setModel(s.models.claude.default)
    }, (e: unknown) => setError(errorText(e)))
  }, [])

  if (error) return <Notice tone="error">{error}</Notice>
  if (!settings) return null
  if (accounts.length === 0) {
    return (
      <Notice tone="info">
        Attach a Claude account first in{' '}
        <button type="button" className="underline" onClick={() => navigate({ name: 'settings', section: 'accounts' })}>
          Settings → Accounts
        </button>
        .
      </Notice>
    )
  }
  const create = () =>
    api.createChat({ workspaceId: workspace.id, agent: 'claude', accountId, model }).then(onCreated, (e: unknown) => setError(errorText(e)))

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-foreground/80">Claude</span>
      <select aria-label="Account" value={accountId} onChange={(e) => setAccountId(e.target.value)} className={selectClass}>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.label}
            {a.isDefault ? ' ★' : ''}
            {a.loginStatus !== 'logged_in' ? ` (${a.loginStatus.replace('_', ' ')})` : ''}
          </option>
        ))}
      </select>
      <select aria-label="Model" value={model} onChange={(e) => setModel(e.target.value)} className={selectClass}>
        {settings.models.claude.list.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      <Button variant="primary" onClick={create}>
        <MessageSquarePlus size={14} /> New chat
      </Button>
    </div>
  )
}

/** All chats of a workspace as tabs + the active chat (several chats per workspace, T24). */
export function ChatsPanel({ workspace }: { workspace: Workspace }) {
  const [chats, setChats] = useState<Chat[]>([])
  const [active, setActive] = useState<string | null>(null)
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

  const current = chats.find((c) => c.id === active)
  return (
    <Card title="Chats" actions={<NewChat workspace={workspace} onCreated={(c) => void load(c.id)} />}>
      {chats.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {chats.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActive(c.id)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs',
                c.id === active ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary',
              )}
            >
              <StatusDot status={c.status} />
              {c.title}
            </button>
          ))}
        </div>
      )}
      {current ? <ChatPane key={current.id} chat={current} /> : <p className="text-sm text-muted-foreground">No chat yet.</p>}
    </Card>
  )
}
