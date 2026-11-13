import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { migrate, openDb } from './db'

const tables = (db: ReturnType<typeof openDb>) =>
  (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as { name: string }[]).map(
    (r) => r.name,
  )

describe('openDb', () => {
  it('creates the file with every table (AC-F3)', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'nakoda-db-')), 'nested', 'nakoda.db')
    const db = openDb(file)
    expect(tables(db)).toEqual(
      expect.arrayContaining(['accounts', 'approvals', 'chats', 'repos', 'schema_migrations', 'settings', 'workspaces']),
    )
  })

  it('applies migrations once', () => {
    const db = openDb(':memory:')
    expect(migrate(db)).toEqual([])
  })

  it('accepts codex as an agent already (codex-ready seam)', () => {
    const db = openDb(':memory:')
    db.prepare(
      "INSERT INTO accounts (id, agent, label, kind, config_dir, created_at) VALUES ('a', 'codex', 'x', 'attached', '/x', 'now')",
    ).run()
    expect(() =>
      db
        .prepare(
          "INSERT INTO accounts (id, agent, label, kind, config_dir, created_at) VALUES ('b', 'gpt', 'x', 'attached', '/y', 'now')",
        )
        .run(),
    ).toThrow()
  })

  it('enforces foreign keys', () => {
    const db = openDb(':memory:')
    expect(() =>
      db
        .prepare(
          "INSERT INTO chats (id, workspace_id, agent, model, title, created_at) VALUES ('c', 'missing', 'claude', 'm', 't', 'now')",
        )
        .run(),
    ).toThrow()
  })
})
