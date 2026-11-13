import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Connector, TestResult } from '../../../shared/connectors'
import { api } from '../../api/nakoda'
import { errorText } from '../../lib/errors'
import { toast } from '../../store/toast'
import { Button } from '../ui/Button'
import { Card, Field, Input, Notice } from '../ui/Field'
import { Select } from '../ui/Select'
import { useConfirm } from '../ui/confirm'

const DEFAULT_URL = 'https://project.sid.id'

type Source = 'paste' | 'env'
type Draft = { id: string | null; label: string; baseUrl: string; source: Source; token: string; envName: string }

const blank: Draft = { id: null, label: 'Helix', baseUrl: DEFAULT_URL, source: 'paste', token: '', envName: '' }

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
    <Card title={editing ? 'Edit Helix connection' : 'Add a Helix connection'}>
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
      <div className="flex gap-2">
        <Button variant="primary" disabled={!ready} onClick={onSave}>
          {editing ? 'Save connection' : 'Add connection'}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </Card>
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

/** Task-source connections (Helix first; Jira, Trello and Lark come later). Tokens are saved on this computer only. */
export function ConnectorSettings() {
  const confirm = useConfirm()
  const [connectors, setConnectors] = useState<Connector[] | null>(null)
  const [envNames, setEnvNames] = useState<string[]>([])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [testing, setTesting] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, TestResult | string>>({})

  const load = () => api.listConnectors().then(setConnectors, (e: unknown) => setError(errorText(e)))
  useEffect(() => {
    void load()
    api.connectorEnvVars().then(setEnvNames, () => setEnvNames([]))
  }, [])

  const save = async () => {
    if (!draft) return
    const input = {
      kind: 'helix' as const,
      label: draft.label,
      baseUrl: draft.baseUrl,
      ...(draft.source === 'paste' ? (draft.token.trim() ? { token: draft.token.trim() } : {}) : { envName: draft.envName }),
    }
    try {
      const saved = draft.id ? await api.updateConnector(draft.id, input) : await api.createConnector(input)
      setDraft(null)
      setError(null)
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
    setDraft({ id: c.id, label: c.label, baseUrl: c.baseUrl, source: c.tokenSource.kind === 'env' ? 'env' : 'paste', token: '', envName: c.tokenSource.kind === 'env' ? c.tokenSource.name : '' })

  return (
    <section className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Connect outside task systems (Helix now; Jira, Trello and Lark later) to bring tickets into Nakoda. Nakoda only reads.</p>
        </div>
        {!draft && (
          <Button onClick={() => setDraft({ ...blank })}>
            <Plus className="size-4" /> Add Helix
          </Button>
        )}
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {draft && <ConnectorForm draft={draft} envNames={envNames} onChange={setDraft} onSave={() => void save()} onCancel={() => { setDraft(null); setError(null) }} />}
      {connectors?.length === 0 && !draft && (
        <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No connectors yet.</div>
      )}
      {connectors?.map((c) => {
        const result = results[c.id]
        return (
          <Card
            key={c.id}
            title={c.label.toLowerCase().includes('helix') ? c.label : `${c.label} · Helix`}
            actions={
              <div className="flex gap-1.5">
                <Button disabled={testing === c.id} onClick={() => void test(c.id)}>
                  {testing === c.id ? 'Testing…' : 'Test connection'}
                </Button>
                <Button variant="ghost" onClick={() => edit(c)}>
                  Edit
                </Button>
                <Button variant="ghost" onClick={() => void remove(c)}>
                  Remove
                </Button>
              </div>
            }
          >
            <dl className="grid grid-cols-[8rem_1fr] gap-y-1 text-sm">
              <dt className="text-muted-foreground">Address</dt>
              <dd className="font-mono text-xs">{c.baseUrl}</dd>
              <dt className="text-muted-foreground">Token</dt>
              <dd className="font-mono text-xs">
                {c.tokenSource.kind === 'env' ? `from ${c.tokenSource.name}` : 'saved in ~/.nakoda/secrets.json'}
                {c.tokenHint ? ` (${c.tokenHint})` : ' (missing)'}
              </dd>
              <dt className="text-muted-foreground">Last checked</dt>
              <dd className="text-xs">{c.lastCheckedAt ? new Date(c.lastCheckedAt).toLocaleString() : 'never'}</dd>
            </dl>
            {typeof result === 'string' ? <Notice tone="error">{result}</Notice> : result && <TestReport result={result} />}
          </Card>
        )
      })}
    </section>
  )
}
