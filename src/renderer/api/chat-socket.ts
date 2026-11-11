import { API } from '../../shared/api'
import { ChatEvent } from '../../shared/events'

type Listener = (event: ChatEvent) => void
const listeners = new Set<Listener>()
let socket: WebSocket | null = null
let retry = 0

function connect(): void {
  if (socket) return
  const url = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}${API.chatSocket}`
  socket = new WebSocket(url)
  socket.addEventListener('open', () => {
    retry = 0
  })
  socket.addEventListener('message', (message) => {
    const parsed = ChatEvent.safeParse(JSON.parse(String(message.data)))
    if (parsed.success) for (const l of listeners) l(parsed.data)
  })
  socket.addEventListener('close', () => {
    socket = null
    // Reconnect with a capped backoff while anything is listening.
    if (listeners.size > 0) setTimeout(connect, Math.min(5000, 500 * 2 ** retry++))
  })
}

/** Live chat events from the runtime (one shared WebSocket). */
export function onChatEvent(listener: Listener): () => void {
  listeners.add(listener)
  connect()
  return () => listeners.delete(listener)
}
