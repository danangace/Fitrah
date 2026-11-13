import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { z } from 'zod/v4'
import { nakodaHome } from '../config'

/**
 * Tokens live in `~/.nakoda/secrets.json` (mode 600), never in the database (that file is 644) and
 * never in anything sent to the browser. Shape: `{ "connections": { "<id>": { "token": "…" } } }`.
 */
const SecretsFile = z.object({ connections: z.record(z.string(), z.object({ token: z.string() })).default({}) })
type Secrets = z.infer<typeof SecretsFile>

export class SecretStore {
  readonly file: string

  constructor(dir = nakodaHome()) {
    this.file = join(dir, 'secrets.json')
  }

  private read(): Secrets {
    if (!existsSync(this.file)) return { connections: {} }
    // A looser mode (copied from a backup, say) gets tightened before we trust or extend the file.
    if ((statSync(this.file).mode & 0o077) !== 0) chmodSync(this.file, 0o600)
    try {
      const parsed = SecretsFile.safeParse(JSON.parse(readFileSync(this.file, 'utf8')))
      return parsed.success ? parsed.data : { connections: {} }
    } catch {
      return { connections: {} }
    }
  }

  /** Atomic: write a 600 temp file next to it, then rename over the real one. */
  private write(secrets: Secrets): void {
    mkdirSync(dirname(this.file), { recursive: true, mode: 0o700 })
    const tmp = `${this.file}.${process.pid}.tmp`
    writeFileSync(tmp, `${JSON.stringify(secrets, null, 2)}\n`, { mode: 0o600 })
    renameSync(tmp, this.file)
  }

  getToken(connectionId: string): string | null {
    return this.read().connections[connectionId]?.token ?? null
  }

  setToken(connectionId: string, token: string): void {
    const secrets = this.read()
    secrets.connections[connectionId] = { token }
    this.write(secrets)
  }

  deleteToken(connectionId: string): void {
    const secrets = this.read()
    if (!(connectionId in secrets.connections)) return
    delete secrets.connections[connectionId]
    this.write(secrets)
  }
}

const TOKEN_PATTERN = /sidpjm_[a-f0-9]{64}/g

/** Hide any Helix token inside text that may be logged or shown. */
export function redactTokens(text: string): string {
  return text.replace(TOKEN_PATTERN, 'sidpjm_…')
}

/** `sidpjm_…a1b2`: the last four characters only. */
export function tokenHint(token: string): string {
  return `sidpjm_…${token.slice(-4)}`
}
