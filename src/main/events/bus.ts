import type { AppEvent } from '../../shared/events'

type Listener = (event: AppEvent) => void

/** In-process app event bus; the SSE route fans events out to every open UI tab. */
export class EventBus {
  private listeners = new Set<Listener>()

  emit(event: AppEvent): void {
    for (const listener of this.listeners) listener(event)
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
}
