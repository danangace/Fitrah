import { type AgentId, ModelCatalog, type ModelOption } from '../../shared/schemas'
import { UserError } from '../errors'
import { nowIso } from '../paths'
import type { Db } from '../sqlite/db'
import { getAccount } from './service'

/** How an agent lists the models a login may use (the Claude adapter's `listModels`). */
export type ModelLister = Partial<Record<AgentId, (configDir: string) => Promise<ModelOption[]>>>

const key = (accountId: string) => `models:${accountId}`

/**
 * The models each account may use, asked from the agent once and kept in Fitrah's DB (so the
 * settings page and the chat picker are instant after a restart). `refresh` asks again, e.g.
 * after a new model ships or the plan changes. Concurrent asks for one account share one call.
 */
export class ModelCatalogs {
  private pending = new Map<string, Promise<ModelCatalog>>()

  constructor(
    private db: Db,
    private listers: ModelLister,
  ) {}

  cached(accountId: string): ModelCatalog | null {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key(accountId)) as { value: string } | undefined
    if (!row) return null
    const parsed = ModelCatalog.safeParse(JSON.parse(row.value))
    return parsed.success ? parsed.data : null
  }

  async get(accountId: string, refresh = false): Promise<ModelCatalog> {
    const account = getAccount(this.db, accountId)
    const hit = refresh ? null : this.cached(accountId)
    if (hit) return hit
    const running = this.pending.get(accountId)
    if (running) return running
    const list = this.listers[account.agent]
    if (!list) throw new UserError('models_not_supported', `Listing models is not supported for ${account.agent}`)
    const task = list(account.configDir)
      .then((models) => {
        if (models.length === 0) throw new UserError('no_models', 'This account reported no models. Is it logged in?')
        const catalog: ModelCatalog = { accountId, models, fetchedAt: nowIso() }
        this.db
          .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value')
          .run(key(accountId), JSON.stringify(catalog))
        return catalog
      })
      .catch((error: unknown) => {
        if (error instanceof UserError) throw error
        const text = (error as Error).message
        throw new UserError('models_failed', /logged in|login|auth/i.test(text) ? 'This account is not logged in.' : `Could not list models: ${text}`, 409)
      })
      .finally(() => this.pending.delete(accountId))
    this.pending.set(accountId, task)
    return task
  }

  /** Forget an account's list (when the account is removed). */
  forget(accountId: string): void {
    this.db.prepare('DELETE FROM settings WHERE key = ?').run(key(accountId))
  }
}
