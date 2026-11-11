import { serve } from '@hono/node-server'
import { afterEach, describe, expect, it } from 'vitest'
import { WebSocket, WebSocketServer } from 'ws'
import type { ChatEvent } from '../../shared/events'
import { createRuntimeApp } from '../server/app'
import { localHosts } from '../server/security'
import { ChatService } from './service'
import { chatFixture } from './testing'

const token = 'c'.repeat(64)
let close: (() => void) | null = null
afterEach(() => close?.())

async function startServer() {
  const fx = await chatFixture()
  const chats = new ChatService(fx.db, { claude: fx.adapter })
  const port = 40_000 + Math.floor(Math.random() * 10_000)
  const { app } = createRuntimeApp({ security: { token, allowedHosts: localHosts(port) }, db: fx.db, chats })
  const wss = new WebSocketServer({ noServer: true })
  const server = await new Promise<ReturnType<typeof serve>>((resolveServe) => {
    const s = serve({ fetch: app.fetch, port, hostname: '127.0.0.1', websocket: { server: wss } }, () => resolveServe(s))
  })
  close = () => server.close()
  return { ...fx, chats, base: `http://127.0.0.1:${port}`, port }
}

describe('chat routes', () => {
  it('streams chat events over the websocket (token required)', async () => {
    const { base, port, chat } = await startServer()
    // Without a token the upgrade is refused.
    const denied = new WebSocket(`ws://127.0.0.1:${port}/ws/chat`)
    const deniedResult = await new Promise((r) => {
      denied.on('unexpected-response', (_req, res) => r(res.statusCode))
      denied.on('open', () => r('open'))
    })
    expect(deniedResult).toBe(401)

    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/chat`, { headers: { 'x-fitrah-token': token } })
    const received: ChatEvent[] = []
    ws.on('message', (data) => received.push(JSON.parse(String(data)) as ChatEvent))
    await new Promise((r) => ws.on('open', r))

    const res = await fetch(`${base}/api/chats/${chat.id}/messages`, {
      method: 'POST',
      headers: { 'x-fitrah-token': token, 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'hi' }),
    })
    expect(res.status).toBe(202)
    for (let i = 0; i < 50 && !received.some((e) => e.type === 'turn.done'); i++) await new Promise((r) => setTimeout(r, 20))
    expect(received.map((e) => e.type)).toContain('message.text')
    expect(received.every((e) => e.chatId === chat.id)).toBe(true)
    ws.close()
  })
})
