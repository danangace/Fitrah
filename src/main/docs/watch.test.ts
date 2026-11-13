import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { AppEvent } from '../../shared/events'
import { EventBus } from '../events/bus'
import { DEFAULT_SETTINGS, saveSettings } from '../settings/store'
import { openDb } from '../sqlite/db'
import { DocsService } from './service'
import { DocsWatcher } from './watch'

describe('DocsWatcher', () => {
  it('emits docs.changed when a note is saved (AC-D6)', async () => {
    const root = mkdtempSync(join(tmpdir(), 'nakoda-vault-'))
    writeFileSync(join(root, 'note.md'), '# v1')
    const db = openDb(':memory:')
    saveSettings(db, { ...DEFAULT_SETTINGS, docsRoot: root })
    const bus = new EventBus()
    const seen: AppEvent[] = []
    bus.subscribe((e) => seen.push(e))
    const watcher = new DocsWatcher(new DocsService(db), bus, 20)
    watcher.sync()
    await new Promise((r) => setTimeout(r, 100))
    writeFileSync(join(root, 'note.md'), '# v2')
    for (let i = 0; i < 50 && seen.length === 0; i++) await new Promise((r) => setTimeout(r, 40))
    watcher.stop()
    expect(seen).toContainEqual({ type: 'docs.changed', path: 'note.md' })
  })
})
