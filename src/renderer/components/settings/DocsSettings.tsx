import { useEffect, useState } from 'react'
import type { DocNodeT, Settings } from '../../../shared/schemas'
import { api } from '../../api/nakoda'
import { cn } from '../../lib/cn'
import { folderRows, setFolderShown } from '../../lib/docs-visibility'
import { errorText } from '../../lib/errors'
import { toast } from '../../store/toast'
import { Button } from '../ui/Button'
import { Card, Notice } from '../ui/Field'
import { Switch } from '../ui/Switch'

/** Settings → Docs: switch folders of the docs root off to keep them out of the Docs sidebar. Notes stay readable by link. */
export function DocsSettings() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [tree, setTree] = useState<DocNodeT[] | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    api.getSettings().then(setSettings, (e: unknown) => setMessage(errorText(e)))
    api.docsTree(true).then(setTree, (e: unknown) => {
      setTree([])
      setMessage(errorText(e))
    })
  }, [])

  if (!settings || !tree) return message ? <Notice tone="error">{message}</Notice> : null

  const rows = folderRows(tree, settings.docsHidden)
  const save = async () => {
    try {
      setSettings(await api.saveSettings(settings))
      setMessage(null)
      toast.success('Docs saved', 'The Docs sidebar shows the folders that are on.')
    } catch (e) {
      setMessage(errorText(e))
    }
  }

  return (
    <Card
      title="Docs folders"
      actions={
        <Button variant="primary" onClick={save}>
          Save
        </Button>
      }
    >
      {message && <Notice tone="error">{message}</Notice>}
      <p className="text-xs text-muted-foreground">Switch off the folders you do not need. Turning one off also hides everything inside it. Notes are not deleted, and links to them still open.</p>
      {rows.length === 0 ? (
        <Notice tone="info">{settings.docsRoot ? 'No folders with notes in the docs root.' : 'Set a docs root in Settings → General to see its folders.'}</Notice>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li key={r.path} style={{ marginLeft: r.depth * 20 }} className={cn('flex items-center gap-3 rounded-md border border-border/60 px-3 py-2', r.on ? 'bg-card' : 'bg-transparent')}>
              <Switch
                aria-label={`Show ${r.path}`}
                checked={r.on}
                disabled={r.inherited}
                onCheckedChange={(on) => setSettings({ ...settings, docsHidden: setFolderShown(settings.docsHidden, r.path, on) })}
              />
              <span className={cn('min-w-0 flex-1 truncate text-sm', r.on ? 'text-foreground' : 'text-foreground/60')}>{r.name}</span>
              {r.inherited && <span className="text-xs text-muted-foreground">hidden by its folder</span>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
