import { ArrowLeft } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { DocNodeT } from '../../../shared/schemas'
import { api } from '../../api/nakoda'
import { errorText } from '../../lib/errors'
import { useAppEvents } from '../../store/events'
import { useRouter } from '../../store/router'
import { Notice } from '../ui/Field'
import { DocTree } from './DocTree'

/** Replaces the main sidebar content while Docs is open: a back button, then the folder tree. */
export function DocsSidebar({ path }: { path: string }) {
  const navigate = useRouter((s) => s.navigate)
  const [tree, setTree] = useState<DocNodeT[]>([])
  const [error, setError] = useState<string | null>(null)

  const loadTree = useCallback(() => {
    api.docsTree().then(
      (t) => {
        setTree(t)
        setError(null)
      },
      (e: unknown) => setError(errorText(e)),
    )
  }, [])
  useEffect(loadTree, [loadTree])
  useAppEvents((event) => {
    if (event.type === 'docs.changed') loadTree()
  })

  return (
    <>
      <div className="px-2 pb-1">
        <button
          type="button"
          onClick={() => navigate({ name: 'home' })}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium text-foreground/70 transition-colors hover:bg-foreground/5 hover:text-foreground"
        >
          <ArrowLeft className="size-4 shrink-0" />
          <span>Back to Nakoda</span>
        </button>
      </div>
      <div className="mt-2 flex h-8 items-center px-2">
        <span className="pl-2 text-xs font-semibold text-muted-foreground/80 select-none">Docs</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {error ? <Notice tone="error">{error}</Notice> : <DocTree nodes={tree} active={path} onOpen={(p) => navigate({ name: 'docs', path: p })} />}
      </div>
    </>
  )
}
