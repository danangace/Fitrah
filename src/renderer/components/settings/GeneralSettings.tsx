import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { BUILTIN_PLACEHOLDERS } from '../../../shared/doc-paths'
import type { DocPath, Settings } from '../../../shared/schemas'
import { api } from '../../api/fitrah'
import { errorText } from '../../lib/errors'
import { Button } from '../ui/Button'
import { toast } from '../../store/toast'
import { Card, Field, Input, Notice } from '../ui/Field'

/** Your own named doc locations; each chat gets them filled in for its workspace. */
function DocPathsEditor({ value, onChange }: { value: DocPath[]; onChange: (v: DocPath[]) => void }) {
  const update = (i: number, patch: Partial<DocPath>) => onChange(value.map((p, j) => (j === i ? { ...p, ...patch } : p)))
  return (
    <div className="space-y-2">
      <div className="text-[13px] font-medium text-muted-foreground">Doc paths</div>
      {/* One block per topic: name on its own line, the full path on the next, so long paths stay readable. */}
      {value.map((p, i) => (
        <div key={i} className="space-y-1.5 rounded-md border border-border/60 bg-background/40 p-2.5">
          <div className="flex items-center gap-2">
            <Input
              aria-label={`Doc path ${i + 1} name`}
              className="min-w-0 flex-1"
              placeholder="Name, e.g. BE Proposal"
              value={p.label}
              onChange={(e) => update(i, { label: e.target.value })}
            />
            <button
              type="button"
              aria-label={`Remove doc path ${p.label || i + 1}`}
              title="Remove"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-destructive"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
          <Input
            aria-label={`Doc path ${i + 1} path`}
            className="font-mono text-xs"
            placeholder="frontend/modules/{iteration}/{module}/…"
            value={p.template}
            onChange={(e) => update(i, { template: e.target.value })}
          />
        </div>
      ))}
      <Button variant="ghost" onClick={() => onChange([...value, { label: '', template: '' }])}>
        <Plus className="size-4" /> Add doc path
      </Button>
      <p className="text-xs text-muted-foreground/70">
        Relative to the docs root. Every chat is told these locations for its workspace. Placeholders:{' '}
        <span className="font-mono">{BUILTIN_PLACEHOLDERS.join(' ')}</span>, plus any workflow field by its name, e.g.{' '}
        <span className="font-mono">{'{iteration}'}</span> or <span className="font-mono">{'{module}'}</span>. An empty one is left as is and
        Claude asks for it.
      </p>
    </div>
  )
}

export function GeneralSettings() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [profiles, setProfiles] = useState<{ dir: string; name: string }[]>([])
  const [message, setMessage] = useState<{ tone: 'error'; text: string } | null>(null)

  useEffect(() => {
    api.getSettings().then(setSettings, (e: unknown) => setMessage({ tone: 'error', text: errorText(e) }))
    api.chromeProfiles().then(setProfiles, () => setProfiles([]))
  }, [])

  if (!settings) return message ? <Notice tone="error">{message.text}</Notice> : null

  const set = (patch: Partial<Settings>) => setSettings({ ...settings, ...patch })

  const save = async () => {
    setMessage(null)
    try {
      setSettings(await api.saveSettings(settings))
      toast.success('Settings saved', 'General settings are updated.')
    } catch (e) {
      setMessage({ tone: 'error', text: errorText(e) })
    }
  }

  return (
    <Card
      title="General"
      actions={
        <Button variant="primary" onClick={save}>
          Save
        </Button>
      }
    >
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      <Field label="Docs root" hint="Markdown folder shown read-only in Docs, e.g. your Obsidian vault.">
        <Input
          value={settings.docsRoot ?? ''}
          placeholder="~/Documents/Personal/Engineering/Engineering/sekolahmu"
          onChange={(e) => set({ docsRoot: e.target.value.trim() === '' ? null : e.target.value })}
        />
      </Field>
      <Field
        label="Open Fitrah in"
        hint="Used by `fitrah start` and `fitrah open`. Pick the Chrome profile you work in, so its login stays there."
      >
        <select
          value={settings.openIn.kind === 'chrome' ? `chrome:${settings.openIn.profile}` : 'default'}
          onChange={(e) =>
            set({
              openIn: e.target.value === 'default' ? { kind: 'default' } : { kind: 'chrome', profile: e.target.value.slice('chrome:'.length) },
            })
          }
          className="w-full rounded-md border border-input bg-card px-2.5 py-1.5 text-sm"
        >
          <option value="default">Default browser</option>
          {profiles.map((p) => (
            <option key={p.dir} value={`chrome:${p.dir}`}>
              Chrome · {p.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Workspaces folder" hint="Where new git worktrees are created.">
        <Input value={settings.workspacesDir} onChange={(e) => set({ workspacesDir: e.target.value })} />
      </Field>
      <DocPathsEditor value={settings.docPaths} onChange={(docPaths) => set({ docPaths })} />
    </Card>
  )
}
