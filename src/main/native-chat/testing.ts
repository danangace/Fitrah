import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ChatEvent } from '../../shared/events'
import { insertAccount } from '../accounts/service'
import { DEFAULT_SETTINGS, addRepo, saveSettings } from '../settings/store'
import { openDb } from '../sqlite/db'
import { createWorkspace } from '../workspaces/service'
import { makeRepoWithOrigin } from '../workspaces/testing'
import { ChatService } from './service'
import type { AdapterEvent, AgentAdapter, TurnOptions } from './types'

/** Scriptable fake agent for tests: runs `script` with the turn options. */
export function fakeAdapter(script: (o: TurnOptions, emit: (e: AdapterEvent) => void) => Promise<void>): AgentAdapter & {
  calls: TurnOptions[]
} {
  const calls: TurnOptions[] = []
  return {
    agent: 'claude',
    calls,
    startTurn(options) {
      calls.push(options)
      let stopped = false
      const done = (async () => {
        await script(options, (e) => {
          if (!stopped) options.onEvent(e)
        })
      })()
      return {
        stop: () => {
          stopped = true
          options.onEvent({ type: 'turn.done', ok: false, numTurns: 0 })
        },
        done,
      }
    },
  }
}

/** A workspace + account + chat on a fake agent. */
export async function chatFixture(adapter = fakeAdapter(async (_o, emit) => {
  emit({ type: 'session.started', sessionId: 'sess-1', model: 'claude-haiku-5-5' })
  emit({ type: 'message.text', text: 'hello' })
  emit({ type: 'turn.done', ok: true, numTurns: 1 })
})) {
  const db = openDb(':memory:')
  const { repo } = makeRepoWithOrigin()
  saveSettings(db, { ...DEFAULT_SETTINGS, workspacesDir: mkdtempSync(join(tmpdir(), 'fitrah-ws-')) })
  const r = await addRepo(db, { path: repo, featureBase: 'origin/dev/tribe-2' })
  const ws = await createWorkspace(db, { repoId: r.id, kind: 'feature', name: 'w', base: 'origin/dev/tribe-2' })
  const account = insertAccount(db, { agent: 'claude', label: 'sid', kind: 'attached', configDir: '/acc' })
  const service = new ChatService(db, { claude: adapter })
  const events: ChatEvent[] = []
  service.subscribe((e) => events.push(e))
  const chat = service.create({ workspaceId: ws.id, agent: 'claude', accountId: account.id, model: 'haiku' })
  return { db, ws, account, service, chat, events, adapter }
}

