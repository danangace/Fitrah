import { useEffect, useRef } from 'react'
import { API } from '../../shared/api'
import { AppEvent } from '../../shared/events'

type Listener = (event: AppEvent) => void
const listeners = new Set<Listener>()
let source: EventSource | null = null

function connect(): void {
  if (source) return
  source = new EventSource(API.events)
  source.addEventListener('app', (e) => {
    const parsed = AppEvent.safeParse(JSON.parse((e as MessageEvent<string>).data))
    if (parsed.success) for (const l of listeners) l(parsed.data)
  })
}

/** Subscribe to app events (docs changes, workspace status…) over one shared SSE stream. */
export function useAppEvents(listener: Listener): void {
  const ref = useRef(listener)
  ref.current = listener
  useEffect(() => {
    connect()
    const l: Listener = (e) => ref.current(e)
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  }, [])
}
