import { Loader2, RefreshCw, Star } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { Account, ModelCatalog, ModelOption, Settings } from '../../../shared/schemas'
import { api } from '../../api/nakoda'
import { accountName } from '../../lib/accounts'
import { cn } from '../../lib/cn'
import { errorText } from '../../lib/errors'
import { timeAgo } from '../../lib/usage'
import { toast } from '../../store/toast'
import { Button } from '../ui/Button'
import { Card, Notice } from '../ui/Field'
import { Select } from '../ui/Select'
import { Switch } from '../ui/Switch'

/** One row: switch on / off, ★ default, name + description from the account. */
function ModelRow({
  model,
  on,
  isDefault,
  onToggle,
  onDefault,
}: {
  model: Pick<ModelOption, 'value' | 'displayName' | 'description'> & { missing?: boolean }
  on: boolean
  isDefault: boolean
  onToggle: (on: boolean) => void
  onDefault: () => void
}) {
  return (
    <li className={cn('flex items-center gap-3 rounded-md border border-border/60 px-3 py-2', on ? 'bg-card' : 'bg-transparent')}>
      <Switch aria-label={`Show ${model.displayName}`} checked={on} onCheckedChange={onToggle} />
      <div className="min-w-0 flex-1">
        <div className={cn('text-sm', on ? 'text-foreground' : 'text-foreground/60')}>
          {model.displayName} <span className="font-mono text-xs text-muted-foreground">{model.value}</span>
        </div>
        <div className={cn('truncate text-xs', model.missing ? 'text-warning' : 'text-muted-foreground')}>
          {model.missing ? 'Not offered by this account any more' : model.description}
        </div>
      </div>
      <button
        type="button"
        aria-label={`Make ${model.displayName} the default`}
        title={isDefault ? 'Default for new chats' : on ? 'Make default' : 'Turn it on first'}
        disabled={!on}
        onClick={onDefault}
        className={cn('rounded p-1 disabled:opacity-30', isDefault ? 'text-warning' : 'text-muted-foreground/60 hover:text-foreground/80')}
      >
        <Star size={14} fill={isDefault ? 'currentColor' : 'none'} />
      </button>
    </li>
  )
}

/**
 * Settings → Models: the models an account may use come from Claude Code itself; you only switch
 * them on or off. Switched-on models are what the chat's model picker offers; ★ = default.
 */
export function ModelSettings() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountId, setAccountId] = useState('')
  const [catalog, setCatalog] = useState<ModelCatalog | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([api.getSettings(), api.listAccounts()]).then(([s, a]) => {
      setSettings(s)
      const claude = a.filter((x) => x.agent === 'claude')
      setAccounts(claude)
      setAccountId((claude.find((x) => x.isDefault) ?? claude[0])?.id ?? '')
    }, (e: unknown) => setMessage(errorText(e)))
  }, [])

  const loadModels = useCallback((id: string, refresh = false) => {
    if (!id) return
    setLoading(true)
    setMessage(null)
    api.accountModels(id, refresh).then(
      (c) => {
        setCatalog(c)
        if (refresh) toast.success('Models refreshed', `${c.models.length} models from this account.`)
      },
      (e: unknown) => setMessage(errorText(e)),
    ).finally(() => setLoading(false))
  }, [])
  useEffect(() => loadModels(accountId), [accountId, loadModels])

  if (!settings) return message ? <Notice tone="error">{message}</Notice> : null

  const claude = settings.models.claude
  const setModels = (list: string[], def: string) => setSettings({ ...settings, models: { ...settings.models, claude: { list, default: def } } })
  const toggle = (value: string, on: boolean) => {
    if (on) return setModels([...claude.list.filter((m) => m !== value), value], claude.default)
    const list = claude.list.filter((m) => m !== value)
    if (list.length === 0) return setMessage('Keep at least one model on.')
    setModels(list, claude.default === value ? (list[0] ?? value) : claude.default)
  }
  const save = async () => {
    try {
      setSettings(await api.saveSettings(settings))
      setMessage(null)
      toast.success('Models saved', 'The chat model picker shows the models that are on.')
    } catch (e) {
      setMessage(errorText(e))
    }
  }

  const offered = catalog?.models ?? []
  // Models switched on earlier that this account no longer lists: shown so you can turn them off.
  const missing = claude.list.filter((m) => !offered.some((o) => o.value === m))
  const account = accounts.find((a) => a.id === accountId)

  return (
    <Card
      title="Models · Claude"
      actions={
        <Button variant="primary" onClick={save}>
          Save
        </Button>
      }
    >
      {message && <Notice tone="error">{message}</Notice>}
      <p className="text-xs text-muted-foreground">
        The list comes from your Claude account. Switch on the models you want in the chat's model picker; ★ is the default for new
        chats.
      </p>
      {accounts.length === 0 ? (
        <Notice tone="info">Attach a Claude account in Settings → Accounts to see its models.</Notice>
      ) : (
        <div className="flex items-center gap-2">
          {accounts.length > 1 && (
            <Select
              aria-label="Account"
              className="w-64"
              value={accountId}
              onValueChange={setAccountId}
              options={accounts.map((a) => ({ value: a.id, label: `${accountName(a.label, a.configDir)}${a.isDefault ? ' ★' : ''}` }))}
            />
          )}
          {accounts.length === 1 && account && <span className="text-sm text-foreground/80">{accountName(account.label, account.configDir)}</span>}
          <span className="ml-auto text-xs text-muted-foreground">{catalog && !loading && `Updated ${timeAgo(catalog.fetchedAt, Date.now())}`}</span>
          <Button variant="ghost" disabled={loading || !accountId} onClick={() => loadModels(accountId, true)} title="Ask Claude Code again">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
          </Button>
        </div>
      )}
      {loading && !catalog && <p className="text-sm text-muted-foreground">Asking Claude Code which models this account can use…</p>}
      <ul className="space-y-1.5">
        {offered.map((m) => (
          <ModelRow
            key={m.value}
            model={m}
            on={claude.list.includes(m.value)}
            isDefault={claude.default === m.value}
            onToggle={(on) => toggle(m.value, on)}
            onDefault={() => setModels(claude.list, m.value)}
          />
        ))}
        {catalog &&
          missing.map((value) => (
            <ModelRow
              key={value}
              model={{ value, displayName: value, description: '', missing: true }}
              on
              isDefault={claude.default === value}
              onToggle={(on) => toggle(value, on)}
              onDefault={() => setModels(claude.list, value)}
            />
          ))}
      </ul>
    </Card>
  )
}
