import { Check, Loader2, Trash2 } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import type { Repo } from '../../../shared/schemas'
import { api } from '../../api/fitrah'
import { useWorkspaces } from '../../store/workspaces'
import { cn } from '../../lib/cn'
import { errorText } from '../../lib/errors'
import { type RepoForm, formFromRepo, isDirty, setupState } from '../../lib/repo-form'
import { Button } from '../ui/Button'
import { Card, Field, Input, Notice, ScriptArea } from '../ui/Field'

const emptyForm = { path: '', setupScript: '', archiveScript: '', featureBase: '' }

const SETUP_HINT = 'Runs once in each new workspace, line by line; stops at the first failing line. Keep long-running commands (dev servers) out.'
const SETUP_PLACEHOLDER = 'cp ~/path/to/repo/.env .env\npnpm install\npnpm setup:env'

function Badge({ tone, children }: { tone: 'ok' | 'warn' | 'muted' | 'info'; children: ReactNode }) {
  const tones = {
    ok: 'bg-emerald-950 text-emerald-300',
    warn: 'bg-amber-950 text-amber-300',
    muted: 'bg-neutral-800 text-neutral-400',
    info: 'bg-sky-950 text-sky-300',
  }
  return <span className={cn('rounded px-1.5 py-0.5 text-[11px]', tones[tone])}>{children}</span>
}

function RepoRow({ repo, onChange }: { repo: Repo; onChange: () => void }) {
  const [form, setForm] = useState<RepoForm>(formFromRepo(repo))
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const workspaceCount = useWorkspaces((s) => s.workspaces.filter((w) => w.repoId === repo.id).length)
  const dirty = isDirty(form, repo)
  const state = setupState(repo)

  // Hide the "Saved" confirmation after a few seconds.
  useEffect(() => {
    if (!savedAt) return
    const t = setTimeout(() => setSavedAt(null), 3000)
    return () => clearTimeout(t)
  }, [savedAt])

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      await api.updateRepo(repo.id, form)
      setSavedAt(Date.now())
      onChange()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setSaving(false)
    }
  }
  const remove = async () => {
    if (!window.confirm(`Remove ${repo.name} from Fitrah? The repo itself is not touched.`)) return
    try {
      await api.removeRepo(repo.id)
      onChange()
    } catch (e) {
      setError(errorText(e))
    }
  }
  return (
    <div data-testid="repo-row" className="space-y-3 rounded-md border border-neutral-800 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold text-white">{repo.name}</span>
            <Badge tone="ok">
              <Check size={11} className="mr-0.5 inline" />
              Added
            </Badge>
            <Badge tone={state.tone}>{state.label}</Badge>
            <Badge tone="muted">base {repo.featureBase || '—'}</Badge>
            <Badge tone="muted">
              {workspaceCount} workspace{workspaceCount === 1 ? '' : 's'}
            </Badge>
            {dirty && <Badge tone="info">Unsaved changes</Badge>}
          </div>
          <div className="mt-0.5 truncate text-xs text-neutral-500">{repo.path}</div>
        </div>
        <Button variant="ghost" aria-label={`Remove ${repo.name}`} onClick={remove}>
          <Trash2 size={14} />
        </Button>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <Field label="Feature base">
        <Input value={form.featureBase} onChange={(e) => setForm({ ...form, featureBase: e.target.value })} />
      </Field>
      <Field label="Setup script" hint={SETUP_HINT}>
        <ScriptArea
          value={form.setupScript}
          placeholder={SETUP_PLACEHOLDER}
          onChange={(e) => setForm({ ...form, setupScript: e.target.value })}
        />
      </Field>
      <Field label="Archive script" hint="Optional. Runs once in the workspace right before it is archived.">
        <ScriptArea rows={2} value={form.archiveScript} onChange={(e) => setForm({ ...form, archiveScript: e.target.value })} />
      </Field>
      <div className="flex items-center gap-3">
        <Button variant={dirty ? 'primary' : 'secondary'} disabled={!dirty || saving} onClick={save}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : null}
          {saving ? 'Saving…' : 'Save repo'}
        </Button>
        {savedAt && !dirty && (
          <span className="flex items-center gap-1 text-xs text-emerald-400">
            <Check size={13} /> Saved
          </span>
        )}
        {!dirty && !savedAt && <span className="text-xs text-neutral-500">All changes saved</span>}
      </div>
    </div>
  )
}

/** Repo settings are stored in Fitrah, never in the repo (OQ-16). */
export function RepoSettings() {
  const [repos, setRepos] = useState<Repo[]>([])
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState<string | null>(null)
  const load = () =>
    api.listRepos().then((list) => {
      setRepos(list)
      // Keep the shared list (New workspace form, sidebar) in sync without a page reload.
      void useWorkspaces.getState().load()
    }, (e: unknown) => setError(errorText(e)))
  useEffect(() => {
    void load()
  }, [])

  const add = async () => {
    setAdding(true)
    setError(null)
    setAdded(null)
    try {
      const repo = await api.addRepo(form)
      setForm(emptyForm)
      setAdded(repo.name)
      void load()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setAdding(false)
    }
  }

  return (
    <Card title="Repos">
      {repos.map((repo) => (
        <RepoRow key={repo.id} repo={repo} onChange={load} />
      ))}
      <div className="space-y-3 rounded-md border border-dashed border-neutral-700 p-3">
        <div className="text-sm font-semibold text-neutral-200">Add repo</div>
        {error && <Notice tone="error">{error}</Notice>}
        {added && <Notice tone="ok">Added {added}. It is ready for new workspaces.</Notice>}
        <Field label="Path">
          <Input
            value={form.path}
            placeholder="~/Documents/Sekolahmu/Modularity/website-cf-monorepo"
            onChange={(e) => setForm({ ...form, path: e.target.value })}
          />
        </Field>
        <Field label="Feature base">
          <Input
            value={form.featureBase}
            placeholder="origin/dev/tribe-2"
            onChange={(e) => setForm({ ...form, featureBase: e.target.value })}
          />
        </Field>
        <Field label="Setup script" hint={SETUP_HINT}>
          <ScriptArea
            value={form.setupScript}
            placeholder={SETUP_PLACEHOLDER}
            onChange={(e) => setForm({ ...form, setupScript: e.target.value })}
          />
        </Field>
        <Button variant="primary" onClick={add} disabled={adding || !form.path || !form.featureBase}>
          {adding ? <Loader2 size={14} className="animate-spin" /> : null}
          {adding ? 'Checking repo…' : 'Add repo'}
        </Button>
      </div>
    </Card>
  )
}
