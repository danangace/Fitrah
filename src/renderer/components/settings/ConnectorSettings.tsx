import { useEffect, useState, type ReactNode } from 'react'
import type { Connector, TestResult } from '../../../shared/connectors'
import { api } from '../../api/nakoda'
import { errorText } from '../../lib/errors'
import { toast } from '../../store/toast'
import { Button } from '../ui/Button'
import { Field, Input, Notice, TextArea } from '../ui/Field'
import { Modal } from '../ui/Modal'
import { Select } from '../ui/Select'
import { useConfirm } from '../ui/confirm'
import { formatMap, parseMap } from '../../lib/mapping-text'
import { PLATFORMS, connectionState, platformById, type ConnectionState, type PlatformId } from '../../lib/connector-platforms'
import { cn } from '../../lib/cn'

const DEFAULT_URL = 'https://project.sid.id'

type Source = 'paste' | 'env'
type Draft = { id: string | null; pendingKey: string | null; label: string; baseUrl: string; source: Source; token: string; envName: string; severityMap: string; envMap: string }

const blank: Draft = { id: null, pendingKey: null, label: 'Helix', baseUrl: DEFAULT_URL, source: 'paste', token: '', envName: '', severityMap: '', envMap: '' }

function ConnectorForm({ draft, envNames, onChange, onSave, onCancel }: {
  draft: Draft
  envNames: string[]
  onChange: (d: Draft) => void
  onSave: () => void
  onCancel: () => void
}) {
  const editing = draft.id !== null
  const ready = draft.label.trim() && draft.baseUrl.trim() && (draft.source === 'env' ? draft.envName : editing || draft.token.trim())
  return (
    <div className="space-y-4">
      <Field label="Label">
        <Input value={draft.label} onChange={(e) => onChange({ ...draft, label: e.target.value })} />
      </Field>
      <Field label="Helix address" hint="Must start with https://">
        <Input value={draft.baseUrl} onChange={(e) => onChange({ ...draft, baseUrl: e.target.value })} />
      </Field>
      <fieldset className="space-y-2">
        <legend className="text-[13px] font-medium text-muted-foreground">Token</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="token-source" checked={draft.source === 'paste'} onChange={() => onChange({ ...draft, source: 'paste' })} />
          Paste a token
        </label>
        {draft.source === 'paste' && (
          <Field label="Read-only token" hint={`Create it in Helix under Settings → API Tokens with the read_only scope. Saved in ~/.nakoda/secrets.json, never shown again.${editing ? ' Leave empty to keep the saved token.' : ''}`}>
            <Input type="password" autoComplete="off" placeholder="sidpjm_…" value={draft.token} onChange={(e) => onChange({ ...draft, token: e.target.value })} />
          </Field>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="token-source" checked={draft.source === 'env'} onChange={() => onChange({ ...draft, source: 'env' })} />
          Use an existing environment variable
        </label>
        {draft.source === 'env' && (
          <Field label="Variable" hint="Only the name is saved; the token stays where it is.">
            {envNames.length === 0 ? (
              <Notice tone="info">No SIDPJM_… variables are set in the environment Nakoda runs in.</Notice>
            ) : (
              <Select aria-label="Variable" value={draft.envName} onValueChange={(v) => onChange({ ...draft, envName: v })} options={envNames.map((n) => ({ value: n, label: n }))} placeholder="Choose a variable…" />
            )}
          </Field>
        )}
      </fieldset>
      {editing && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Severity mapping" hint="Helix severity=ours (critical, major or minor), one per line. Used when a defect is transferred.">
            <TextArea aria-label="Severity mapping" rows={4} className="font-mono text-xs" value={draft.severityMap} onChange={(e) => onChange({ ...draft, severityMap: e.target.value })} />
          </Field>
          <Field label="Environment mapping" hint="Helix ticket type=environment (dev, staging or production). Empty means someone chooses it.">
            <TextArea aria-label="Environment mapping" rows={4} className="font-mono text-xs" value={draft.envMap} onChange={(e) => onChange({ ...draft, envMap: e.target.value })} />
          </Field>
        </div>
      )}
      <div className="flex gap-2">
        <Button variant="primary" disabled={!ready} onClick={onSave}>
          {editing ? 'Save connection' : 'Add connection'}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

function TestReport({ result }: { result: TestResult }) {
  return (
    <div className="space-y-2" data-testid="connection-test">
      <Notice tone="ok">
        Connected as {result.owner.name} ({result.owner.username}). Scope: {result.scope}
        {result.expiresAt ? `, expires ${result.expiresAt.slice(0, 10)}` : ', no expiry'}.
      </Notice>
      {result.warnings.map((w) => (
        <Notice key={w} tone="error">
          {w}
        </Notice>
      ))}
    </div>
  )
}

const STATUS: Record<ConnectionState, { label: string; dot: string }> = {
  connected: { label: 'Connected', dot: 'bg-success' },
  failed: { label: 'Connection failed', dot: 'bg-destructive' },
  untested: { label: 'Not tested', dot: 'bg-warning' },
  unconfigured: { label: 'Not configured', dot: 'bg-muted-foreground/50' },
}

function StatusBadge({ state }: { state: ConnectionState }) {
  const { label, dot } = STATUS[state]
  return (
    <span role="status" data-state={state} className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span aria-hidden className={cn('size-2 rounded-full', dot, state === 'connected' && 'shadow-[0_0_6px] shadow-success/70')} />
      {label}
    </span>
  )
}

function PlatformCard({ platformId, title, subtitle, state, actions, children }: {
  platformId: PlatformId
  title: string
  subtitle: string
  state: ConnectionState
  actions: ReactNode
  children?: ReactNode
}) {
  const platform = platformById(platformId)
  return (
    <section className="rounded-lg border border-border bg-card" aria-label={`${title} connector`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <div aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary text-sm font-semibold text-foreground">
          {platform.name[0]}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h2 className="truncate text-sm font-semibold text-foreground">{title}</h2>
            <StatusBadge state={state} />
          </div>
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex shrink-0 gap-1.5">{actions}</div>
      </div>
      {children && <div className="space-y-3 border-t border-border px-4 py-3">{children}</div>}
    </section>
  )
}

/** Task-source connections. Pick a platform to add a card; each card opens its own setup. Tokens are saved on this computer only. */
export function ConnectorSettings() {
  const confirm = useConfirm()
  const [connectors, setConnectors] = useState<Connector[] | null>(null)
  const [envNames, setEnvNames] = useState<string[]>([])
  const [draft, setDraft] = useState<Draft | null>(null)
  /** Cards the user added but has not configured yet. They only live on this screen. */
  const [pending, setPending] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [testing, setTesting] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, TestResult | string>>({})

  const load = () => api.listConnectors().then(setConnectors, (e: unknown) => setError(errorText(e)))
  useEffect(() => {
    void load()
    api.connectorEnvVars().then(setEnvNames, () => setEnvNames([]))
  }, [])

  const addCard = (platformId: string) => {
    if (platformId !== 'helix') return
    setPending((p) => [...p, crypto.randomUUID()])
  }

  const closeForm = () => {
    setDraft(null)
    setError(null)
  }

  const save = async () => {
    if (!draft) return
    const input = {
      kind: 'helix' as const,
      label: draft.label,
      baseUrl: draft.baseUrl,
      ...(draft.id ? { mappings: { severity: parseMap(draft.severityMap), environment: parseMap(draft.envMap) } } : {}),
      ...(draft.source === 'paste' ? (draft.token.trim() ? { token: draft.token.trim() } : {}) : { envName: draft.envName }),
    }
    try {
      const saved = draft.id ? await api.updateConnector(draft.id, input) : await api.createConnector(input)
      if (draft.pendingKey) setPending((p) => p.filter((k) => k !== draft.pendingKey))
      closeForm()
      toast.success(draft.id ? 'Connection saved' : 'Connection added')
      await load()
      void test(saved.id)
    } catch (e) {
      setError(errorText(e))
    }
  }

  const test = async (id: string) => {
    setTesting(id)
    try {
      const result = await api.testConnector(id)
      setResults((r) => ({ ...r, [id]: result }))
    } catch (e) {
      setResults((r) => ({ ...r, [id]: errorText(e) }))
    } finally {
      setTesting(null)
      void load()
    }
  }

  const remove = async (c: Connector) => {
    if (!(await confirm({ title: `Remove ${c.label}?`, description: 'Its saved token is deleted from this computer. Tickets already moved into Nakoda stay.', confirmLabel: 'Remove', destructive: true }))) return
    try {
      await api.removeConnector(c.id)
      await load()
    } catch (e) {
      setError(errorText(e))
    }
  }

  const edit = (c: Connector) =>
    setDraft({ id: c.id, pendingKey: null, label: c.label, baseUrl: c.baseUrl, source: c.tokenSource.kind === 'env' ? 'env' : 'paste', token: '', envName: c.tokenSource.kind === 'env' ? c.tokenSource.name : '', severityMap: formatMap(c.mappings.severity), envMap: formatMap(c.mappings.environment) })

  const options = PLATFORMS.map((p) => ({
    value: p.id,
    disabled: !p.available,
    label: (
      <span className="flex w-full items-center justify-between gap-3">
        {p.name}
        {!p.available && <span className="text-xs text-muted-foreground">Soon</span>}
      </span>
    ),
  }))
  const empty = connectors?.length === 0 && pending.length === 0

  return (
    <section className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">Connect outside task systems to bring tickets into Nakoda. Nakoda only reads.</p>
        <div className="w-44 shrink-0">
          <Select aria-label="Add connector" value="" onValueChange={addCard} options={options} placeholder="Add connector…" />
        </div>
      </div>
      {error && !draft && <Notice tone="error">{error}</Notice>}
      {empty && <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No connectors yet. Choose a platform above to add one.</div>}
      {pending.map((key) => (
        <PlatformCard
          key={key}
          platformId="helix"
          title="Helix"
          subtitle={platformById('helix').method}
          state="unconfigured"
          actions={
            <>
              <Button onClick={() => setDraft({ ...blank, pendingKey: key })}>Configure</Button>
              <Button variant="ghost" onClick={() => setPending((p) => p.filter((k) => k !== key))}>
                Remove
              </Button>
            </>
          }
        />
      ))}
      {connectors?.map((c) => {
        const result = results[c.id]
        const state = connectionState({ configured: true, lastCheckedAt: c.lastCheckedAt, testError: typeof result === 'string' })
        return (
          <PlatformCard
            key={c.id}
            platformId={c.kind}
            title={c.label.toLowerCase().includes('helix') ? c.label : `${c.label} · Helix`}
            subtitle={c.baseUrl}
            state={state}
            actions={
              <>
                <Button disabled={testing === c.id} onClick={() => void test(c.id)}>
                  {testing === c.id ? 'Testing…' : 'Test connection'}
                </Button>
                <Button variant="ghost" onClick={() => edit(c)}>
                  Edit
                </Button>
                <Button variant="ghost" onClick={() => void remove(c)}>
                  Remove
                </Button>
              </>
            }
          >
            <dl className="grid grid-cols-[8rem_1fr] gap-y-1 text-sm">
              <dt className="text-muted-foreground">Token</dt>
              <dd className="font-mono text-xs">
                {c.tokenSource.kind === 'env' ? `from ${c.tokenSource.name}` : 'saved in ~/.nakoda/secrets.json'}
                {c.tokenHint ? ` (${c.tokenHint})` : ' (missing)'}
              </dd>
              <dt className="text-muted-foreground">Last checked</dt>
              <dd className="text-xs">{c.lastCheckedAt ? new Date(c.lastCheckedAt).toLocaleString() : 'never'}</dd>
            </dl>
            {typeof result === 'string' ? <Notice tone="error">{result}</Notice> : result && <TestReport result={result} />}
          </PlatformCard>
        )
      })}
      {draft && (
        <Modal title={draft.id ? 'Edit Helix connection' : 'Configure Helix'} onClose={closeForm} width="max-w-xl">
          {error && <Notice tone="error">{error}</Notice>}
          <ConnectorForm draft={draft} envNames={envNames} onChange={setDraft} onSave={() => void save()} onCancel={closeForm} />
        </Modal>
      )}
    </section>
  )
}
