import { Check, Loader2, Trash2 } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import type { Repo } from '../../../shared/schemas'
import { api } from '../../api/fitrah'
import { useWorkspaces } from '../../store/workspaces'
import { cn } from '../../lib/cn'
import { errorText } from '../../lib/errors'
import { type RepoForm, formFromRepo, isDirty, setupState } from '../../lib/repo-form'
import { Button } from '../ui/Button'
import { Field, Input, Notice, ScriptArea } from '../ui/Field'
import { toast } from '../../store/toast'
import { useConfirm } from '../ui/confirm'

const SETUP_HINT = 'Runs once in each new workspace, line by line; stops at the first failing line. Keep long-running commands (dev servers) out.'
const SETUP_PLACEHOLDER = 'cp ~/path/to/repo/.env .env\npnpm install\npnpm setup:env'

function Badge({ tone, children }: { tone: 'ok' | 'warn' | 'muted' | 'info'; children: ReactNode }) {
  const tones = {
    ok: 'bg-success/10 text-success',
    warn: 'bg-warning/10 text-warning',
    muted: 'bg-secondary text-muted-foreground',
    info: 'bg-info/10 text-info',
  }
  return <span className={cn('rounded px-1.5 py-0.5 text-xs', tones[tone])}>{children}</span>
}

/** Project settings: base, branch prefix, setup / archive scripts (D-14). Stored in Fitrah, never in the repo. */
export function ProjectSettingsCard({ repo, onChange }: { repo: Repo; onChange: () => void }) {
  const [form, setForm] = useState<RepoForm>(formFromRepo(repo))
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const confirm = useConfirm()
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
      toast.success('Project saved', `${repo.name} settings are updated.`)
      onChange()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setSaving(false)
    }
  }
  const remove = async () => {
    const ok = await confirm({
      title: `Remove ${repo.name}?`,
      description: 'It is removed from Fitrah only. The folder itself is not touched.',
      confirmLabel: 'Remove',
      destructive: true,
    })
    if (!ok) return
    try {
      await api.removeRepo(repo.id)
      onChange()
    } catch (e) {
      setError(errorText(e))
    }
  }
  return (
    <div data-testid="repo-row" className="space-y-3 rounded-md border border-border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold text-foreground">{repo.name}</span>
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
          <div className="mt-0.5 truncate text-xs text-muted-foreground">{repo.path}</div>
        </div>
        <Button variant="ghost" aria-label={`Remove ${repo.name}`} onClick={remove}>
          <Trash2 size={14} />
        </Button>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Base branch" hint="New workspaces start from here.">
          <Input value={form.featureBase} onChange={(e) => setForm({ ...form, featureBase: e.target.value })} />
        </Field>
        <Field label="Branch prefix" hint={`Branch = prefix + name, e.g. ${form.branchPrefix}rapikan-tabel`}>
          <Input value={form.branchPrefix} placeholder="feat/tribe-2/" onChange={(e) => setForm({ ...form, branchPrefix: e.target.value })} />
        </Field>
      </div>
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
          {saving ? 'Saving…' : 'Save project'}
        </Button>
        {savedAt && !dirty && (
          <span className="flex items-center gap-1 text-xs text-success">
            <Check size={13} /> Saved
          </span>
        )}
        {!dirty && !savedAt && <span className="text-xs text-muted-foreground">All changes saved</span>}
      </div>
    </div>
  )
}
