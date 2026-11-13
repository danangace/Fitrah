import { copyFileSync, mkdirSync, mkdtempSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import { resolveDocPath } from '../../shared/doc-paths'
import { getSettings } from '../settings/store'
import { getWorkflow } from '../workflows/service'
import { migrate, openDb } from './db'

const MIGRATIONS = join(import.meta.dirname, 'migrations')

describe('migration 006 (Defect workflow, Bug pool path)', () => {
  it('seeds the Defect workflow with the intake fields and a links field for other references', () => {
    const wf = getWorkflow(openDb(':memory:'), 'defect')
    expect(wf.fields.map((f) => f.key)).toEqual(['defect', 'environment', 'app', 'url_page', 'steps', 'expected', 'actual', 'severity', 'handling', 'iteration', 'references'])
    expect(wf.fields.find((f) => f.key === 'references')).toMatchObject({ type: 'links', required: false })
    expect(wf.fields.find((f) => f.key === 'environment')?.options).toEqual(['dev', 'staging', 'production'])
    expect(wf.fields.find((f) => f.key === 'severity')?.options).toEqual(['critical', 'major', 'minor'])
  })

  it('adds the Bug pool path to settings saved before, once, keeping the user paths', () => {
    const dir = mkdtempSync(join(tmpdir(), 'nakoda-mig6-'))
    mkdirSync(dir, { recursive: true })
    for (const f of readdirSync(MIGRATIONS).filter((n) => n < '006')) copyFileSync(join(MIGRATIONS, f), join(dir, f))
    const db = new DatabaseSync(':memory:')
    db.exec('PRAGMA foreign_keys = ON')
    migrate(db, dir)
    db.prepare("INSERT INTO settings (key, value) VALUES ('app', ?)").run(JSON.stringify({ docsRoot: null, docPaths: [{ label: 'Mine', template: 'mine/{iteration}' }] }))
    migrate(db)
    migrate(db)
    const paths = getSettings(db).docPaths
    expect(paths.map((p) => p.label)).toEqual(['Mine', 'Bug pool'])
    expect(paths[1]?.template).toBe('frontend/bugs/pool/{iteration}/{defect}/{defect}.md')
  })

  it('resolves the Bug pool path from a defect workspace', () => {
    const db = openDb(':memory:')
    const bugPool = getSettings(db).docPaths.find((p) => p.label === 'Bug pool')
    if (!bugPool) throw new Error('missing Bug pool')
    const resolved = resolveDocPath(bugPool, { name: 'w', branch: 'b', values: { iteration: 'i-15', defect: 'link-redirect' } }, getWorkflow(db, 'defect'))
    expect(resolved.path).toBe('frontend/bugs/pool/i-15/link-redirect/link-redirect.md')
    expect(resolved.missing).toEqual([])
  })
})
