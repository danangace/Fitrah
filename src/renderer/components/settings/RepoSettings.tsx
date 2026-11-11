import { Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Repo } from '../../../shared/schemas'
import { api } from '../../api/fitrah'
import { errorText } from '../../lib/errors'
import { Button } from '../ui/Button'
import { Card, Field, Input, Notice } from '../ui/Field'

const emptyForm = { path: '', setupScript: '', featureBase: '', sharedDirs: '' }

function RepoRow({ repo, onChange }: { repo: Repo; onChange: () => void }) {
  const [form, setForm] = useState({
    setupScript: repo.setupScript,
    featureBase: repo.featureBase,
    sharedDirs: repo.sharedDirs.join(', '),
  })
  const [error, setError] = useState<string | null>(null)
  const save = async () => {
    try {
      await api.updateRepo(repo.id, {
        setupScript: form.setupScript,
        featureBase: form.featureBase,
        sharedDirs: form.sharedDirs.split(',').map((s) => s.trim()).filter(Boolean),
      })
      setError(null)
      onChange()
    } catch (e) {
      setError(errorText(e))
    }
  }
  const remove = async () => {
    try {
      await api.removeRepo(repo.id)
      onChange()
    } catch (e) {
      setError(errorText(e))
    }
  }
  return (
    <div className="space-y-3 rounded-md border border-neutral-800 p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-white">{repo.name}</div>
          <div className="text-xs text-neutral-500">{repo.path}</div>
        </div>
        <Button variant="ghost" aria-label={`Remove ${repo.name}`} onClick={remove}>
          <Trash2 size={14} />
        </Button>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Setup script">
          <Input value={form.setupScript} onChange={(e) => setForm({ ...form, setupScript: e.target.value })} />
        </Field>
        <Field label="Feature base">
          <Input value={form.featureBase} onChange={(e) => setForm({ ...form, featureBase: e.target.value })} />
        </Field>
        <Field label="Shared dirs" hint="Comma separated">
          <Input value={form.sharedDirs} onChange={(e) => setForm({ ...form, sharedDirs: e.target.value })} />
        </Field>
      </div>
      <Button onClick={save}>Save repo</Button>
    </div>
  )
}

/** Repo settings are stored in Fitrah, never in the repo (OQ-16). */
export function RepoSettings() {
  const [repos, setRepos] = useState<Repo[]>([])
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const load = () => api.listRepos().then(setRepos, (e: unknown) => setError(errorText(e)))
  useEffect(() => {
    void load()
  }, [])

  const add = async () => {
    try {
      await api.addRepo({
        path: form.path,
        setupScript: form.setupScript,
        featureBase: form.featureBase,
        sharedDirs: form.sharedDirs.split(',').map((s) => s.trim()).filter(Boolean),
      })
      setForm(emptyForm)
      setError(null)
      void load()
    } catch (e) {
      setError(errorText(e))
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
        <Field label="Path">
          <Input
            value={form.path}
            placeholder="~/Documents/Sekolahmu/Modularity/website-cf-monorepo"
            onChange={(e) => setForm({ ...form, path: e.target.value })}
          />
        </Field>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Setup script">
            <Input
              value={form.setupScript}
              placeholder="pnpm install && pnpm setup:env"
              onChange={(e) => setForm({ ...form, setupScript: e.target.value })}
            />
          </Field>
          <Field label="Feature base">
            <Input
              value={form.featureBase}
              placeholder="origin/dev/tribe-2"
              onChange={(e) => setForm({ ...form, featureBase: e.target.value })}
            />
          </Field>
          <Field label="Shared dirs" hint="Comma separated">
            <Input value={form.sharedDirs} onChange={(e) => setForm({ ...form, sharedDirs: e.target.value })} />
          </Field>
        </div>
        <Button variant="primary" onClick={add} disabled={!form.path || !form.featureBase}>
          Add repo
        </Button>
      </div>
    </Card>
  )
}
