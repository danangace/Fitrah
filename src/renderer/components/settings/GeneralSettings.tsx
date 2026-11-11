import { useEffect, useState } from 'react'
import type { Settings } from '../../../shared/schemas'
import { api } from '../../api/fitrah'
import { errorText } from '../../lib/errors'
import { Button } from '../ui/Button'
import { Card, Field, Input, Notice } from '../ui/Field'

export function GeneralSettings() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  useEffect(() => {
    api.getSettings().then(setSettings, (e: unknown) => setMessage({ tone: 'error', text: errorText(e) }))
  }, [])

  if (!settings) return message ? <Notice tone="error">{message.text}</Notice> : null

  const set = (patch: Partial<Settings>) => setSettings({ ...settings, ...patch })
  const setPath = (key: keyof Settings['paths'], value: string) => set({ paths: { ...settings.paths, [key]: value } })

  const save = async () => {
    setMessage(null)
    try {
      setSettings(await api.saveSettings(settings))
      setMessage({ tone: 'ok', text: 'Saved.' })
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
      <Field label="Workspaces folder" hint="Where new git worktrees are created.">
        <Input value={settings.workspacesDir} onChange={(e) => set({ workspacesDir: e.target.value })} />
      </Field>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Module docs path">
          <Input value={settings.paths.moduleDocs} onChange={(e) => setPath('moduleDocs', e.target.value)} />
        </Field>
        <Field label="Plans path">
          <Input value={settings.paths.plans} onChange={(e) => setPath('plans', e.target.value)} />
        </Field>
        <Field label="Open Questions file">
          <Input value={settings.paths.oqFile} onChange={(e) => setPath('oqFile', e.target.value)} />
        </Field>
      </div>
    </Card>
  )
}
