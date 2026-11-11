import { upgradeWebSocket } from '@hono/node-server'
import type { Hono } from 'hono'
import { z } from 'zod/v4'
import { API } from '../../shared/api'
import { ClientMessage } from '../../shared/events'
import { UserError } from '../errors'
import type { ChatService } from './service'

export type ApprovalHandler = (approvalId: string, decision: 'allow' | 'deny') => void

export function registerChatRoutes(app: Hono, chats: ChatService, approve: ApprovalHandler): void {
  app.get(API.chats, (c) => {
    const workspaceId = c.req.query('workspaceId')
    if (!workspaceId) throw new UserError('missing_workspace', 'Missing ?workspaceId=')
    return c.json(chats.list(workspaceId))
  })
  app.post(API.chats, async (c) => c.json(chats.create(await c.req.json()), 201))
  app.get(`${API.chats}/:id`, (c) => c.json(chats.get(c.req.param('id'))))
  app.patch(`${API.chats}/:id`, async (c) => c.json(chats.update(c.req.param('id'), await c.req.json())))
  app.delete(`${API.chats}/:id`, (c) => {
    chats.delete(c.req.param('id'))
    return c.json({ ok: true })
  })
  app.get(`${API.chats}/:id/events`, (c) => c.json(chats.events(c.req.param('id'))))
  app.post(`${API.chats}/:id/messages`, async (c) => {
    const body = z.object({ text: z.string() }).safeParse(await c.req.json())
    if (!body.success) throw new UserError('invalid_message', 'Missing text')
    chats.send(c.req.param('id'), body.data.text)
    return c.json({ ok: true }, 202)
  })
  app.post(`${API.chats}/:id/stop`, (c) => {
    chats.stop(c.req.param('id'))
    return c.json({ ok: true })
  })
  app.post('/api/approvals/:id', async (c) => {
    const body = z.object({ decision: z.enum(['allow', 'deny']) }).safeParse(await c.req.json())
    if (!body.success) throw new UserError('invalid_decision', 'decision must be allow or deny')
    approve(c.req.param('id'), body.data.decision)
    return c.json({ ok: true })
  })

  // Live chat stream: every chat event goes to every open UI; the UI filters by chatId.
  app.get(
    API.chatSocket,
    upgradeWebSocket(() => {
      let unsubscribe: (() => void) | null = null
      return {
        onOpen(_event, ws) {
          unsubscribe = chats.subscribe((e) => ws.send(JSON.stringify(e)))
        },
        onMessage(event, ws) {
          const parsed = ClientMessage.safeParse(JSON.parse(String(event.data)))
          if (!parsed.success) return
          try {
            const msg = parsed.data
            if (msg.type === 'send') chats.send(msg.chatId, msg.text)
            else if (msg.type === 'stop') chats.stop(msg.chatId)
            else approve(msg.approvalId, msg.decision)
          } catch (error) {
            ws.send(JSON.stringify({ type: 'socket.error', message: (error as Error).message }))
          }
        },
        onClose() {
          unsubscribe?.()
        },
      }
    }),
  )
}
