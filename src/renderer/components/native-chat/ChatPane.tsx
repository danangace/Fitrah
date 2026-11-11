import { CheckCircle2, ChevronRight, CircleX, Loader2, Send, Square, Wrench } from 'lucide-react'
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'
import type { ChatEvent } from '../../../shared/events'
import type { Chat } from '../../../shared/schemas'
import { onChatEvent } from '../../api/chat-socket'
import { api } from '../../api/fitrah'
import { cn } from '../../lib/cn'
import { errorText } from '../../lib/errors'
import { type ToolItem, toItems } from '../../lib/transcript'
import { useRouter } from '../../store/router'
import { Markdown } from '../docs-browser/Markdown'
import { Button } from '../ui/Button'
import { Notice } from '../ui/Field'
import { ApprovalCard } from './ApprovalCard'

function ToolRow({ item }: { item: ToolItem }) {
  const [open, setOpen] = useState(false)
  const icon = !item.result ? (
    <Loader2 size={12} className="animate-spin text-info" />
  ) : item.result.isError ? (
    <CircleX size={12} className="text-destructive" />
  ) : (
    <CheckCircle2 size={12} className="text-success" />
  )
  return (
    <div className="rounded border border-border bg-card text-xs">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center gap-1.5 px-2 py-1 text-left">
        <ChevronRight size={12} className={cn('transition-transform', open && 'rotate-90')} />
        <Wrench size={12} className="text-muted-foreground" />
        <span className="font-medium text-foreground/80">{item.name}</span>
        <span className="min-w-0 flex-1 truncate text-muted-foreground">{item.summary}</span>
        {icon}
      </button>
      {open && item.result && (
        <pre className="max-h-48 overflow-auto border-t border-border px-2 py-1 whitespace-pre-wrap text-muted-foreground">
          {item.result.summary || '(no output)'}
        </pre>
      )}
    </div>
  )
}

/** One chat: streaming messages, collapsed tool calls, approval cards, input. */
export function ChatPane({ chat }: { chat: Chat }) {
  const navigate = useRouter((s) => s.navigate)
  const [events, setEvents] = useState<ChatEvent[]>([])
  const [status, setStatus] = useState(chat.status)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const bottom = useRef<HTMLDivElement>(null)

  // Load once per chat; live events append. (Status changes must not reload the history.)
  useEffect(() => {
    setEvents([])
    api.chatEvents(chat.id).then(setEvents, (e: unknown) => setError(errorText(e)))
    return onChatEvent((e) => {
      if (e.chatId !== chat.id) return
      if (e.type === 'status') setStatus(e.status)
      setEvents((list) => [...list, e])
    })
  }, [chat.id])

  const items = useMemo(() => toItems(events), [events])
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' })
  }, [items.length])

  const running = status === 'working' || status === 'needs_approval'
  const send = () => {
    if (!text.trim() || running) return
    setError(null)
    api.sendMessage(chat.id, text).then(() => setText(''), (e: unknown) => setError(errorText(e)))
  }
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="flex h-[70vh] flex-col rounded-lg border border-border">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {items.length === 0 && <p className="text-sm text-muted-foreground">Say what Claude should do in this workspace.</p>}
        {items.map((item, i) => {
          switch (item.kind) {
            case 'user':
              return (
                <div key={i} className="ml-auto max-w-[85%] rounded-lg bg-emerald-900/40 px-3 py-2 text-sm whitespace-pre-wrap text-foreground">
                  {item.text}
                </div>
              )
            case 'assistant':
              return <Markdown key={i} source={item.text} onOpenDoc={(path) => navigate({ name: 'docs', path })} />
            case 'tool':
              return <ToolRow key={i} item={item} />
            case 'approval':
              return <ApprovalCard key={i} item={item} />
            case 'error':
              return (
                <Notice key={i} tone="error">
                  {item.errorKind === 'rate_limit' ? '⏳ ' : ''}
                  {item.message}
                </Notice>
              )
            case 'turn':
              return <div key={i} className="border-t border-border" />
          }
        })}
        <div ref={bottom} />
      </div>
      {error && <div className="px-4 pb-2"><Notice tone="error">{error}</Notice></div>}
      <div className="flex items-end gap-2 border-t border-border p-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          rows={2}
          placeholder={running ? 'Claude is working…' : 'Message Claude (Enter to send, Shift+Enter for a new line)'}
          className="min-h-[2.5rem] flex-1 resize-y rounded-md border border-input bg-card px-3 py-2 text-sm focus:border-ring focus:outline-none"
        />
        {running ? (
          <Button key="stop" variant="danger" onClick={() => void api.stopChat(chat.id)}>
            <Square size={14} /> Stop
          </Button>
        ) : (
          <Button key="send" variant="primary" disabled={!text.trim()} onClick={send}>
            <Send size={14} /> Send
          </Button>
        )}
      </div>
    </div>
  )
}
