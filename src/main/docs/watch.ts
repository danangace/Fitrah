import { type FSWatcher, watch } from 'node:fs'
import { sep } from 'node:path'
import type { EventBus } from '../events/bus'
import type { DocsService } from './service'

/** Watches the docs root and tells open UIs which note changed (AC-D6). */
export class DocsWatcher {
  private watcher: FSWatcher | null = null
  private root: string | null = null
  private pending = new Map<string, NodeJS.Timeout>()

  constructor(
    private docs: DocsService,
    private bus: EventBus,
    private debounceMs = 250,
  ) {}

  /** (Re)start on the current docs root; call after settings change. */
  sync(): void {
    let root: string | null = null
    try {
      root = this.docs.root()
    } catch {
      root = null
    }
    if (root === this.root) return
    this.stop()
    this.root = root
    if (!root) return
    this.watcher = watch(root, { recursive: true }, (_type, file) => {
      if (!file) return
      const path = file.toString().split(sep).join('/')
      if (path.split('/').some((part) => part.startsWith('.'))) return
      clearTimeout(this.pending.get(path))
      this.pending.set(
        path,
        setTimeout(() => {
          this.pending.delete(path)
          this.docs.invalidate()
          this.bus.emit({ type: 'docs.changed', path })
        }, this.debounceMs),
      )
    })
  }

  stop(): void {
    this.watcher?.close()
    this.watcher = null
    for (const t of this.pending.values()) clearTimeout(t)
    this.pending.clear()
  }
}
