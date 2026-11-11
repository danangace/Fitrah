import { useEffect, useState } from 'react'
import { api } from '../../api/fitrah'
import { cn } from '../../lib/cn'
import { errorText } from '../../lib/errors'
import { useRouter } from '../../store/router'
import { useWorkspaces } from '../../store/workspaces'
import { Button } from '../ui/Button'
import { Card, Field, Input, Notice } from '../ui/Field'

const DEFECT_BASES = ['origin/dev/tribe-2', 'origin/main']
const opt = (v: string) => (v.trim() ? v.trim() : undefined)

export function NewWorkspaceForm() {
  const { repos, load } = useWorkspaces()
  const navigate = useRouter((s) => s.navigate)
  const [repoId, setRepoId] = useState('')
  const [kind, setKind] = useState<'feature' | 'defect'>('feature')
  const [name, setName] = useState('')
  const [base, setBase] = useState('')
  const [meta, setMeta] = useState({ iteration: '', module: '', prdUrl: '', figmaUrl: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Always start from the latest repos (they may have been added in Settings since the app opened).
  useEffect(() => {
    void load()
  }, [load])

  const repo = repos.find((r) => r.id === repoId)
  useEffect(() => {
    if (!repoId && repos[0]) setRepoId(repos[0].id)
  }, [repoId, repos])
  // Features start from the repo's feature base; a defect base is always chosen by hand (OQ-13).
  useEffect(() => {
    setBase(kind === 'feature' ? (repo?.featureBase ?? '') : '')
  }, [kind, repo])

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const ws = await api.createWorkspace({
        repoId,
        name: opt(name),
        base: opt(base),
      })
      await load()
      navigate({ name: 'workspace', id: ws.id })
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  if (repos.length === 0) {
    return (
      <Notice tone="info">
        Add a repo first in{' '}
        <button type="button" className="underline" onClick={() => navigate({ name: 'settings', section: 'repos' })}>
          Settings → Repos
        </button>
        .
      </Notice>
    )
  }

  return (
    <Card title="New workspace">
      {error && <Notice tone="error">{error}</Notice>}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Repo">
          <select
            value={repoId}
            onChange={(e) => setRepoId(e.target.value)}
            className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-sm"
          >
            {repos.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Kind">
          <div className="flex gap-1">
            {(['feature', 'defect'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm',
                  kind === k ? 'bg-emerald-700 text-white' : 'bg-neutral-800 text-neutral-300',
                )}
              >
                {k}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Name" hint={`Branch: ${kind === 'feature' ? 'feat' : 'fix'}/…/${name || '<name>'}`}>
          <Input value={name} placeholder="kelola-xyz" onChange={(e) => setName(e.target.value.toLowerCase())} />
        </Field>
        <Field
          label="Base branch"
          hint={kind === 'defect' ? 'Pick the base from the defect-case table. Fitrah never guesses it.' : 'From the repo settings.'}
        >
          {kind === 'defect' ? (
            <div className="flex gap-2">
              <select
                value={DEFECT_BASES.includes(base) ? base : base ? '__custom' : ''}
                onChange={(e) => setBase(e.target.value === '__custom' ? 'refs/tags/' : e.target.value)}
                className="rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-sm"
              >
                <option value="">Choose…</option>
                {DEFECT_BASES.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
                <option value="__custom">tag / other…</option>
              </select>
              {base && !DEFECT_BASES.includes(base) && <Input value={base} onChange={(e) => setBase(e.target.value)} />}
            </div>
          ) : (
            <Input value={base} onChange={(e) => setBase(e.target.value)} />
          )}
        </Field>
        <Field label="Iteration">
          <Input value={meta.iteration} placeholder="i-16" onChange={(e) => setMeta({ ...meta, iteration: e.target.value })} />
        </Field>
        <Field label="Module">
          <Input value={meta.module} onChange={(e) => setMeta({ ...meta, module: e.target.value })} />
        </Field>
        <Field label="PRD link">
          <Input value={meta.prdUrl} onChange={(e) => setMeta({ ...meta, prdUrl: e.target.value })} />
        </Field>
        <Field label="Figma node">
          <Input value={meta.figmaUrl} onChange={(e) => setMeta({ ...meta, figmaUrl: e.target.value })} />
        </Field>
      </div>
      <Button variant="primary" disabled={busy || !repoId || !name.trim() || !base.trim()} onClick={submit}>
        {busy ? 'Creating worktree…' : 'Create workspace'}
      </Button>
    </Card>
  )
}
