import { mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const MIGRATIONS_DIR = join(import.meta.dirname, 'migrations')

export type Db = DatabaseSync

/** Open (and create) the database file, then apply pending migrations. */
export function openDb(file: string): Db {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true })
  const db = new DatabaseSync(file)
  db.exec('PRAGMA foreign_keys = ON')
  if (file !== ':memory:') db.exec('PRAGMA journal_mode = WAL')
  migrate(db)
  return db
}

/** Apply `migrations/NNN_name.sql` files in order, each once, inside a transaction. */
export function migrate(db: Db, dir = MIGRATIONS_DIR): number[] {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)')
  const applied = new Set(
    (db.prepare('SELECT version FROM schema_migrations').all() as { version: number }[]).map((r) => r.version),
  )
  const files = readdirSync(dir)
    .filter((f) => /^\d{3}_.+\.sql$/.test(f))
    .sort()
  const ran: number[] = []
  for (const file of files) {
    const version = Number(file.slice(0, 3))
    if (applied.has(version)) continue
    const sql = readFileSync(join(dir, file), 'utf8')
    db.exec('BEGIN')
    try {
      db.exec(sql)
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(version, new Date().toISOString())
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw new Error(`Migration ${file} failed: ${(error as Error).message}`)
    }
    ran.push(version)
  }
  return ran
}
