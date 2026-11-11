import { Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { Account, Settings, Workflow, WorkflowField } from '../../../shared/schemas'
import { api } from '../../api/fitrah'
import { docFolders } from '../../lib/docs-folders'
import { errorText } from '../../lib/errors'
import { useRouter } from '../../store/router'
import { useWorkspaces } from '../../store/workspaces'
import { Button } from '../ui/Button'
import { Field, Input, Notice } from '../ui/Field'
import { Modal } from '../ui/Modal'

const select = 'w-full rounded-md border border-input bg-card px-2.5 py-1.5 text-sm text-foreground'
const FREE = '__free'
const NO_AGENT = '__none'

function WorkflowFieldInput({
  field,
  value,
  onChange,
  projectBase,
}: {
  field: WorkflowField
  value: string
  onChange: (v: string) => void
  projectBase: string
}) {
  const label = `${field.label}${field.required ? ' *' : ''}`
  if (field.type === 'choice') {
    return (
      <Field label={label} hint={field.help}>
        <select aria-label={field.label} className={select} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Choose…</option>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </Field>
    )
  }
  const placeholder =
    field.type === 'link' ? 'https://…' : field.type === 'branch' ? `${projectBase} (project base)` : field.type === 'docsFolder' ? 'frontend/modules/…' : ''
  return (
    <Field label={label} hint={field.help}>
      <Input
        aria-label={field.label}
        value={value}
        placeholder={placeholder}
        list={field.type === 'docsFolder' ? 'fitrah-doc-folders' : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  )
}

/** Small "Create workspace" modal like Orca (D-15): project · name · Free chat or a workflow · agent. */
export function CreateWorkspaceModal({ projectId, onClose }: { projectId?: string; onClose: () => void }) {
  const { repos, load } = useWorkspaces()
  const navigate = useRouter((s) => s.navigate)
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [folders, setFolders] = useState<string[]>([])
  const [repoId, setRepoId] = useState(projectId ?? '')
  const [name, setName] = useState('')
  const [type, setType] = useState(FREE)
  const [values, setValues] = useState<Record<string, string>>({})
  const [agent, setAgent] = useState(NO_AGENT)
  const [model, setModel] = useState('')
  const [base, setBase] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void load()
    Promise.all([api.listWorkflows(), api.listAccounts(), api.getSettings()]).then(([w, a, s]) => {
      setWorkflows(w)
      const claude = a.filter((x) => x.agent === 'claude')
      setAccounts(claude)
      setSettings(s)
      // OQ-V1: default = your default Claude account + default model.
      setAgent((claude.find((x) => x.isDefault) ?? claude[0])?.id ?? NO_AGENT)
      setModel(s.models.claude.default)
    }, (e: unknown) => setError(errorText(e)))
    api.docsTree().then((t) => setFolders(docFolders(t)), () => setFolders([]))
  }, [load])
  useEffect(() => {
    if (!repoId && repos[0]) setRepoId(repos[0].id)
  }, [repoId, repos])

  const repo = repos.find((r) => r.id === repoId)
  const workflow = workflows.find((w) => w.id === type) ?? null
  // Start each workflow's fields from their defaults.
  useEffect(() => {
    setValues(Object.fromEntries((workflow?.fields ?? []).map((f) => [f.key, f.default ?? ''])))
  }, [workflow])

  const missing = useMemo(() => (workflow?.fields ?? []).filter((f) => f.required && !values[f.key]?.trim()).map((f) => f.label), [workflow, values])
  const branchField = workflow?.fields.find((f) => f.type === 'branch')
  const effectiveBase = base.trim() || (branchField && values[branchField.key]?.trim()) || repo?.featureBase || ''
  const branchPreview = `${repo?.branchPrefix ?? ''}${name.trim() || 'ws-<date>'}`

  const create = async () => {
    setBusy(true)
    setError(null)
    try {
      const ws = await api.createWorkspace({
        repoId,
        name: name.trim() || undefined,
        workflowId: workflow?.id ?? null,
        values: workflow ? values : {},
        base: base.trim() || undefined,
      })
      // The first chat is ready but waits for your message (D-17).
      if (agent !== NO_AGENT) {
        await api.createChat({ workspaceId: ws.id, agent: 'claude', accountId: agent, model, title: workflow ? workflow.name : 'Chat' })
      }
      await load()
      onClose()
      navigate({ name: 'workspace', id: ws.id })
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const canCreate = Boolean(repoId) && missing.length === 0 && !busy
  return (
    <Modal title="Create workspace" onClose={onClose}>
      <div
        className="space-y-4"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canCreate) void create()
        }}
      >
        {error && <Notice tone="error">{error}</Notice>}
        {repos.length === 0 ? (
          <Notice tone="info">Add a project first (sidebar → Add project).</Notice>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Project">
                <select aria-label="Project" className={select} value={repoId} onChange={(e) => setRepoId(e.target.value)}>
                  {repos.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Workspace name (optional)">
                <Input aria-label="Workspace name" value={name} placeholder="auto" onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, '-'))} />
              </Field>
            </div>
            <Field label="Type">
              <select aria-label="Type" className={select} value={type} onChange={(e) => setType(e.target.value)}>
                <option value={FREE}>Free chat</option>
                {workflows.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </Field>
            {workflow && (
              <div className="space-y-3 rounded-md border border-border p-3">
                {workflow.description && <p className="text-xs text-muted-foreground">{workflow.description}</p>}
                {workflow.fields.map((f) => (
                  <WorkflowFieldInput
                    key={f.key}
                    field={f}
                    value={values[f.key] ?? ''}
                    projectBase={repo?.featureBase ?? ''}
                    onChange={(v) => setValues((cur) => ({ ...cur, [f.key]: v }))}
                  />
                ))}
                <datalist id="fitrah-doc-folders">
                  {folders.map((f) => (
                    <option key={f} value={f} />
                  ))}
                </datalist>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Agent">
                <select aria-label="Agent" className={select} value={agent} onChange={(e) => setAgent(e.target.value)}>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      Claude · {a.label}
                      {a.isDefault ? ' ★' : ''}
                    </option>
                  ))}
                  <option value={NO_AGENT}>No agent</option>
                </select>
              </Field>
              <Field label="Model">
                <select aria-label="Model" className={select} value={model} disabled={agent === NO_AGENT} onChange={(e) => setModel(e.target.value)}>
                  {(settings?.models.claude.list ?? []).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <details className="rounded-md border border-border px-3 py-2 text-sm">
              <summary className="cursor-pointer text-muted-foreground">Advanced</summary>
              <div className="mt-2 space-y-2">
                <Field label="Base branch">
                  <Input aria-label="Base branch override" value={base} placeholder={effectiveBase} onChange={(e) => setBase(e.target.value)} />
                </Field>
              </div>
            </details>
            <p className="text-xs text-muted-foreground">
              Branch <code className="text-foreground/80">{branchPreview}</code> from <code className="text-foreground/80">{effectiveBase}</code>
            </p>
            {missing.length > 0 && <p className="text-xs text-warning">Fill in: {missing.join(', ')}</p>}
            <div className="flex justify-end">
              <Button variant="primary" disabled={!canCreate} onClick={() => void create()}>
                {busy && <Loader2 size={14} className="animate-spin" />}
                {busy ? 'Creating…' : 'Create workspace'} <span className="text-[11px] opacity-70">⌘↵</span>
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
