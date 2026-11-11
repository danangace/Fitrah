import { useCallback, useEffect, useState } from 'react'
import type { DocNodeT } from '../../shared/schemas'
import { type DocFile, api } from '../api/fitrah'
import { DocTree } from '../components/docs-browser/DocTree'
import { Markdown } from '../components/docs-browser/Markdown'
import { Notice } from '../components/ui/Field'
import { errorText } from '../lib/errors'
import { wikiToMarkdown } from '../lib/wiki'
import { useAppEvents } from '../store/events'
import { useRouter } from '../store/router'

function Frontmatter({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data)
  if (entries.length === 0) return null
  return (
    <div className="mb-4 flex flex-wrap gap-1.5">
      {entries.map(([key, value]) => (
        <span key={key} className="rounded bg-secondary px-2 py-0.5 text-xs text-foreground/80">
          <span className="text-muted-foreground">{key}:</span> {Array.isArray(value) ? value.join(', ') : String(value)}
        </span>
      ))}
    </div>
  )
}

/** Read-only docs browser (D-5): there is no edit or save action anywhere on this page. */
export function DocsPage({ path }: { path: string }) {
  const navigate = useRouter((s) => s.navigate)
  const [tree, setTree] = useState<DocNodeT[]>([])
  const [doc, setDoc] = useState<DocFile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const open = useCallback((p: string) => navigate({ name: 'docs', path: p }), [navigate])

  const loadTree = useCallback(() => {
    api.docsTree().then(setTree, (e: unknown) => setError(errorText(e)))
  }, [])
  useEffect(loadTree, [loadTree])

  const load = useCallback(() => {
    if (!path) return setDoc(null)
    api.docsFile(path).then(
      (d) => {
        setDoc(d)
        setError(null)
      },
      (e: unknown) => setError(errorText(e)),
    )
  }, [path])
  useEffect(load, [load])

  // Live reload when the note (or the tree) changes on disk, e.g. saved in Obsidian (AC-D6).
  useAppEvents((event) => {
    if (event.type !== 'docs.changed') return
    if (event.path === path) load()
    loadTree()
  })

  return (
    <div className="flex h-full">
      <div className="w-72 shrink-0 overflow-y-auto border-r border-border bg-sidebar/50 p-2">
        <DocTree nodes={tree} active={path} onOpen={open} />
      </div>
      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl p-6">
          {error && <Notice tone="error">{error}</Notice>}
          {!path && !error && <p className="text-sm text-muted-foreground">Pick a note on the left. Docs are read-only here; edit them in Obsidian.</p>}
          {doc && (
            <>
              <div className="mb-2 text-xs text-muted-foreground">{doc.path}</div>
              <Frontmatter data={doc.frontmatter} />
              <Markdown source={wikiToMarkdown(doc.body, doc.links)} onOpenDoc={open} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
