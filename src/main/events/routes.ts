import type { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { API } from '../../shared/api'
import type { AppEvent } from '../../shared/events'
import type { EventBus } from './bus'

export function registerEventRoutes(app: Hono, bus: EventBus): void {
  app.get(API.events, (c) =>
    streamSSE(c, async (stream) => {
      const queue: AppEvent[] = []
      let wake: (() => void) | null = null
      const unsubscribe = bus.subscribe((event) => {
        queue.push(event)
        wake?.()
      })
      stream.onAbort(unsubscribe)
      await stream.writeSSE({ event: 'ready', data: '{}' })
      while (!stream.aborted) {
        const event = queue.shift()
        if (event) {
          await stream.writeSSE({ event: 'app', data: JSON.stringify(event) })
          continue
        }
        // Wait for the next event, or send a keep-alive comment every 25 s.
        await new Promise<void>((resolveWait) => {
          wake = resolveWait
          setTimeout(resolveWait, 25_000)
        })
        wake = null
        if (queue.length === 0 && !stream.aborted) await stream.write(': ping\n\n')
      }
      unsubscribe()
    }),
  )
}
