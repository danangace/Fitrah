import { Star, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Settings } from '../../../shared/schemas'
import { api } from '../../api/fitrah'
import { cn } from '../../lib/cn'
import { errorText } from '../../lib/errors'
import { Button } from '../ui/Button'
import { Card, Input, Notice } from '../ui/Field'

/** Short model list per agent with one default (OQ-21). V1: Claude only. */
export function ModelSettings() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [draft, setDraft] = useState('')
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  useEffect(() => {
    api.getSettings().then(setSettings, (e: unknown) => setMessage({ tone: 'error', text: errorText(e) }))
  }, [])
  if (!settings) return message ? <Notice tone="error">{message.text}</Notice> : null

  const claude = settings.models.claude
  const update = (list: string[], def: string) =>
    setSettings({ ...settings, models: { ...settings.models, claude: { list, default: def } } })

  const add = () => {
    const model = draft.trim()
    if (!model || claude.list.includes(model)) return
    update([...claude.list, model], claude.default)
    setDraft('')
  }
  const remove = (model: string) => {
    const list = claude.list.filter((m) => m !== model)
    if (list.length === 0) return
    update(list, claude.default === model ? (list[0] ?? model) : claude.default)
  }
  const save = async () => {
    try {
      setSettings(await api.saveSettings(settings))
      setMessage({ tone: 'ok', text: 'Saved.' })
    } catch (e) {
      setMessage({ tone: 'error', text: errorText(e) })
    }
  }

  return (
    <Card
      title="Models · Claude"
      actions={
        <Button variant="primary" onClick={save}>
          Save
        </Button>
      }
    >
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      <ul className="space-y-1">
        {claude.list.map((model) => (
          <li key={model} className="flex items-center justify-between rounded-md bg-neutral-900 px-3 py-1.5 text-sm">
            <span>{model}</span>
            <span className="flex items-center gap-2">
              <button
                type="button"
                aria-label={`Make ${model} the default`}
                onClick={() => update(claude.list, model)}
                className={cn(model === claude.default ? 'text-amber-400' : 'text-neutral-600 hover:text-neutral-300')}
              >
                <Star size={14} fill={model === claude.default ? 'currentColor' : 'none'} />
              </button>
              <button type="button" aria-label={`Remove ${model}`} onClick={() => remove(model)} className="text-neutral-500 hover:text-red-400">
                <X size={14} />
              </button>
            </span>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Input value={draft} placeholder="Model id or alias, e.g. sonnet" onChange={(e) => setDraft(e.target.value)} />
        <Button onClick={add}>Add</Button>
      </div>
    </Card>
  )
}
