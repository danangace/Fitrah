import { ArrowDown, ArrowUp, CheckCircle2, ChevronRight, CircleX, Loader2, Sparkles, Square, Wrench } from 'lucide-react'
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'
import type { ChatEvent } from '../../../shared/events'
import type { Chat } from '../../../shared/schemas'
import { onChatEvent } from '../../api/chat-socket'
import { api } from '../../api/nakoda'
import { cn } from '../../lib/cn'
import { errorText } from '../../lib/errors'
import { type ToolItem, toItems } from '../../lib/transcript'
import { useChatUi } from '../../store/chat-ui'
import { useRouter } from '../../store/router'
import { Markdown } from '../docs-browser/Markdown'
import { ApprovalCard } from './ApprovalCard'
import { AccountBadge, ModelPicker, PermissionPicker } from './ComposerPickers'

function ToolRow({ item }: { item: ToolItem }) {
  const [open, setOpen] = useState(false)
  const icon = !item.result ? (
    <Loader2 className="size-3 animate-spin text-info" />
  ) : item.result.isError ? (
    <CircleX className="size-3 text-destructive" />
  ) : (
    <CheckCircle2 className="size-3 text-success/80" />
  )
  return (
    <div className="text-[13px]">
      <button type="button" onClick={() => setOpen(!open)} className="group flex w-full items-center gap-1.5 rounded py-0.5 text-left text-muted-foreground hover:text-foreground">
        <ChevronRight className={cn('size-3 shrink-0 text-muted-foreground/50 transition-transform', open && 'rotate-90')} />
        <Wrench className="size-3 shrink-0 text-muted-foreground/60" />
        <span className="font-medium text-foreground/80">{item.name}</span>
        <span className="min-w-0 flex-1 truncate font-mono text-xs">{item.summary}</span>
        {icon}
      </button>
      {open && item.result && (
        <pre className="mt-1 ml-[18px] max-h-48 overflow-auto rounded-md border border-border bg-card px-2.5 py-1.5 text-xs whitespace-pre-wrap text-muted-foreground">
          {item.result.summary || '(no output)'}
        </pre>
      )}
    </div>
  )
}

function AssistantRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-secondary text-foreground/70">
        <Sparkles className="size-3.5" />
      </div>
      <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">{children}</div>
    </div>
  )
}

/** One chat, laid out like Orca's native chat: centered column, bubbles, quiet tool rows, composer. */
export function ChatPane({ chat: initial }: { chat: Chat }) {
  const [chat, setChat] = useState(initial)
  const navigate = useRouter((s) => s.navigate)
  const [events, setEvents] = useState<ChatEvent[]>([])
  const [status, setStatus] = useState(chat.status)
  // The unsent text lives in a store so it survives leaving the page (e.g. opening Settings).
  const text = useChatUi((s) => s.drafts[chat.id] ?? '')
  const setDraft = useChatUi((s) => s.setDraft)
  const setText = (value: string) => setDraft(chat.id, value)
  const [error, setError] = useState<string | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const column = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)

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

  // Stick to the bottom: while you are at (or near) the bottom, follow everything that makes the
  // transcript taller — new items, "Claude is working…", tool results, long replies, diagrams that
  // render late. Scroll up to read and it stops following until you scroll back down.
  const stick = useRef(true)
  const [away, setAway] = useState(false)
  const scrollToBottom = () => {
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
  }
  const onScroll = () => {
    const el = scroller.current
    if (!el) return
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    setAway(!stick.current)
  }
  useEffect(() => {
    const content = column.current
    const viewport = scroller.current
    if (!content || !viewport) return
    const observer = new ResizeObserver(() => {
      if (stick.current) scrollToBottom()
    })
    observer.observe(content) // the transcript grows
    observer.observe(viewport) // the composer grows and the visible area shrinks
    return () => observer.disconnect()
  }, [])
  const jumpToLatest = () => {
    stick.current = true
    setAway(false)
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
  }
  // A new chat (tab switch) opens at the bottom.
  useEffect(() => {
    stick.current = true
    setAway(false)
    scrollToBottom()
  }, [chat.id])
  // Auto-grow the composer up to ~10 lines.
  useEffect(() => {
    const el = input.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`
  }, [text])

  const running = status === 'working' || status === 'needs_approval'
  const send = () => {
    if (!text.trim() || running) return
    setError(null)
    const chatId = chat.id
    // Sending a message always jumps back to the bottom to follow the answer.
    stick.current = true
    setAway(false)
    scrollToBottom()
    api.sendMessage(chatId, text).then(() => setDraft(chatId, ''), (e: unknown) => setError(errorText(e)))
  }
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  // Group consecutive assistant / tool / approval items under one avatar.
  const blocks: { kind: 'user' | 'assistant'; items: typeof items }[] = []
  for (const item of items) {
    const kind = item.kind === 'user' ? 'user' : 'assistant'
    if (item.kind === 'turn') continue
    const last = blocks.at(-1)
    if (last && last.kind === kind && kind === 'assistant') last.items.push(item)
    else blocks.push({ kind, items: [item] })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scroller} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto">
        <div ref={column} className="mx-auto max-w-3xl space-y-5 px-6 py-6">
          {blocks.length === 0 && (
            <div className="pt-[18vh] text-center">
              <div className="mx-auto mb-3 flex size-9 items-center justify-center rounded-lg bg-secondary text-foreground/70">
                <Sparkles className="size-4" />
              </div>
              <p className="text-sm text-muted-foreground">Say what Claude should do in this workspace.</p>
            </div>
          )}
          {blocks.map((block, i) =>
            block.kind === 'user' ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[80%] rounded-xl border border-white/10 bg-chat-user px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                  {block.items[0]?.kind === 'user' ? block.items[0].text : ''}
                </div>
              </div>
            ) : (
              <AssistantRow key={i}>
                {block.items.map((item, j) => {
                  switch (item.kind) {
                    case 'assistant':
                      return <Markdown key={j} source={item.text} onOpenDoc={(path) => navigate({ name: 'docs', path })} />
                    case 'tool':
                      return <ToolRow key={j} item={item} />
                    case 'approval':
                      return <ApprovalCard key={j} item={item} />
                    case 'error':
                      return (
                        <div key={j} className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-red-200">
                          {item.errorKind === 'rate_limit' ? '⏳ ' : ''}
                          {item.message}
                        </div>
                      )
                    default:
                      return null
                  }
                })}
              </AssistantRow>
            ),
          )}
          {running && status === 'working' && (
            <div className="flex items-center gap-2 pl-9 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" /> Claude is working…
            </div>
          )}
        </div>
      </div>

      <div className="relative shrink-0 px-6 pb-4">
        {away && (
          <button
            type="button"
            onClick={jumpToLatest}
            className="absolute -top-11 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-popover px-3 py-1.5 text-xs text-foreground shadow-lg shadow-black/30 hover:bg-secondary"
          >
            <ArrowDown className="size-3.5" /> {running ? 'Claude is working · jump to latest' : 'Jump to latest'}
          </button>
        )}
        <div className="mx-auto max-w-3xl">
          {error && <div className="mb-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-red-200">{error}</div>}
          <div className="rounded-xl border border-input bg-card shadow-lg shadow-black/20 focus-within:border-ring">
            <textarea
              ref={input}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKey}
              rows={2}
              placeholder={running ? 'Claude is working…' : 'Message Claude (Enter to send, Shift+Enter for a new line)'}
              className="block max-h-60 min-h-14 w-full resize-none bg-transparent px-3.5 pt-3 pb-1 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
            />
            <div className="flex items-center gap-2 px-2.5 pb-2.5">
              <PermissionPicker chat={chat} onChange={setChat} />
              <span className="ml-auto" />
              <AccountBadge chat={chat} />
              <ModelPicker chat={chat} onChange={setChat} />
              {running ? (
                <button
                  key="stop"
                  type="button"
                  aria-label="Stop"
                  title="Stop"
                  onClick={() => void api.stopChat(chat.id)}
                  className="flex size-8 items-center justify-center rounded-full bg-secondary text-foreground hover:bg-accent"
                >
                  <Square className="size-3.5 fill-current" />
                </button>
              ) : (
                <button
                  key="send"
                  type="button"
                  aria-label="Send"
                  title="Send (Enter)"
                  disabled={!text.trim()}
                  onClick={send}
                  className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30"
                >
                  <ArrowUp className="size-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
