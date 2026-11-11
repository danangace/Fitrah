import { ChevronRight, FolderOpen, Globe, Loader2, Plus } from 'lucide-react'
import { useState } from 'react'
import { type Inspection, api } from '../../api/fitrah'
import { errorText } from '../../lib/errors'
import { useRouter } from '../../store/router'
import { useWorkspaces } from '../../store/workspaces'
import { Button } from '../ui/Button'
import { Field, Input, Notice } from '../ui/Field'
import { Modal } from '../ui/Modal'
import { FolderBrowser } from './FolderBrowser'

type Step = { kind: 'choose' } | { kind: 'browse' } | { kind: 'confirm'; folder: Inspection } | { kind: 'clone' } | { kind: 'create' }

function Option({ icon, title, text, onClick, primary }: { icon: React.ReactNode; title: string; text: string; onClick: () => void; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        primary
          ? 'flex w-full items-center gap-3 rounded-lg border border-input bg-secondary px-4 py-3 text-left hover:bg-secondary'
          : 'flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-secondary'
      }
    >
      <span className="text-foreground/80">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{title}</span>
        <span className="block text-xs text-muted-foreground">{text}</span>
      </span>
      <ChevronRight size={14} className="text-muted-foreground/60" />
    </button>
  )
}

/** "Add a project" like Orca: browse an existing repo, clone from URL, or start a new one (D-14). */
export function AddProjectModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<Step>({ kind: 'choose' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ base: '', prefix: '', url: '', parent: '', name: '' })
  const load = useWorkspaces((s) => s.load)
  const navigate = useRouter((s) => s.navigate)

  const done = async (projectId: string) => {
    await load()
    onClose()
    navigate({ name: 'project', id: projectId })
  }
  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }
  const pickExisting = (path: string) =>
    run(async () => {
      const folder = await api.inspectFolder(path)
      if (!folder.isGitRepo) throw new Error(`${folder.name} is not a git repository. Pick the repo folder, or use "Create new project".`)
      setForm((f) => ({ ...f, base: folder.defaultBase ?? 'main' }))
      setStep({ kind: 'confirm', folder })
    })

  return (
    <Modal title="Add a project" onClose={onClose}>
      {error && <Notice tone="error">{error}</Notice>}

      {step.kind === 'choose' && (
        <>
          <Option primary icon={<FolderOpen size={18} />} title="Browse folder" text="An existing git repo on this Mac" onClick={() => setStep({ kind: 'browse' })} />
          <div className="pt-1 text-xs font-semibold text-muted-foreground/80">Other ways to add</div>
          <div className="divide-y divide-neutral-800 overflow-hidden rounded-lg border border-border">
            <Option icon={<Globe size={16} />} title="Clone from URL" text="Clone a remote git repository" onClick={() => setStep({ kind: 'clone' })} />
            <Option icon={<Plus size={16} />} title="Create new project" text="Start from an empty folder" onClick={() => setStep({ kind: 'create' })} />
          </div>
        </>
      )}

      {step.kind === 'browse' && <FolderBrowser pickLabel="Use this folder" onPick={(p) => void pickExisting(p)} />}

      {step.kind === 'confirm' && (
        <>
          <div className="rounded-md bg-background px-3 py-2 text-sm">
            <div className="font-medium text-foreground">{step.folder.name}</div>
            <div className="truncate font-mono text-xs text-muted-foreground">{step.folder.path}</div>
          </div>
          <Field label="Base branch" hint="New workspaces start from here.">
            <Input value={form.base} onChange={(e) => setForm({ ...form, base: e.target.value })} />
          </Field>
          <Field label="Branch prefix" hint={`Branch = prefix + workspace name, e.g. ${form.prefix || ''}rapikan-tabel`}>
            <Input value={form.prefix} placeholder="feat/tribe-2/" onChange={(e) => setForm({ ...form, prefix: e.target.value })} />
          </Field>
          <Button
            variant="primary"
            disabled={busy || !form.base.trim()}
            onClick={() =>
              void run(async () => {
                const repo = await api.addRepo({ path: step.folder.path, featureBase: form.base.trim(), branchPrefix: form.prefix.trim() })
                await done(repo.id)
              })
            }
          >
            {busy && <Loader2 size={14} className="animate-spin" />} Add project
          </Button>
        </>
      )}

      {step.kind === 'clone' && (
        <>
          <Field label="Repository URL">
            <Input value={form.url} placeholder="git@github.com:org/repo.git" onChange={(e) => setForm({ ...form, url: e.target.value })} />
          </Field>
          <Field label="Clone into" hint="Pick the parent folder below.">
            <Input value={form.parent} readOnly placeholder="(choose a folder)" />
          </Field>
          {!form.parent && <FolderBrowser pickLabel="Clone into this folder" onPick={(p) => setForm({ ...form, parent: p })} />}
          <Button
            variant="primary"
            disabled={busy || !form.url.trim() || !form.parent}
            onClick={() =>
              void run(async () => {
                const repo = await api.cloneProject(form.url.trim(), form.parent)
                await done(repo.id)
              })
            }
          >
            {busy && <Loader2 size={14} className="animate-spin" />} {busy ? 'Cloning…' : 'Clone and add'}
          </Button>
        </>
      )}

      {step.kind === 'create' && (
        <>
          <Field label="Project name">
            <Input value={form.name} placeholder="my-project" onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Create in">
            <Input value={form.parent} readOnly placeholder="(choose a folder)" />
          </Field>
          {!form.parent && <FolderBrowser pickLabel="Create it here" onPick={(p) => setForm({ ...form, parent: p })} />}
          <Button
            variant="primary"
            disabled={busy || !form.name.trim() || !form.parent}
            onClick={() =>
              void run(async () => {
                const repo = await api.createProject(form.parent, form.name.trim())
                await done(repo.id)
              })
            }
          >
            {busy && <Loader2 size={14} className="animate-spin" />} Create project
          </Button>
        </>
      )}

      {step.kind !== 'choose' && (
        <button type="button" onClick={() => setStep({ kind: 'choose' })} className="text-xs text-muted-foreground hover:text-foreground/80">
          ← Back
        </button>
      )}
    </Modal>
  )
}
