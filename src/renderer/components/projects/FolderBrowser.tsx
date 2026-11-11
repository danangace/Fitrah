import { ArrowUp, Folder, GitBranch, Home } from 'lucide-react'
import { useEffect, useState } from 'react'
import { type DirListing, api } from '../../api/fitrah'
import { cn } from '../../lib/cn'
import { errorText } from '../../lib/errors'
import { Notice } from '../ui/Field'

/**
 * Fitrah's own folder picker (a web page can't open the Mac one and get a path). The runtime
 * lists folders; you click into them and pick one.
 */
export function FolderBrowser({
  onPick,
  pickLabel = 'Choose this folder',
  initialPath,
}: {
  onPick: (path: string) => void
  pickLabel?: string
  initialPath?: string
}) {
  const [listing, setListing] = useState<DirListing | null>(null)
  const [hidden, setHidden] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [typed, setTyped] = useState<string | null>(null)
  const go = (path?: string) =>
    api.listDirs(path, hidden).then(
      (l) => {
        setListing(l)
        setTyped(null)
        setError(null)
      },
      (e: unknown) => setError(errorText(e)),
    )
  // biome-ignore lint/correctness/useExhaustiveDependencies: reload when the hidden toggle changes
  useEffect(() => {
    void go(listing?.path ?? initialPath)
  }, [hidden])

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <button type="button" title="Home" onClick={() => void go(listing?.home)} className="rounded p-1 text-muted-foreground hover:bg-secondary">
          <Home size={14} />
        </button>
        <button
          type="button"
          title="Up"
          disabled={!listing?.parent}
          onClick={() => void go(listing?.parent ?? undefined)}
          className="rounded p-1 text-muted-foreground hover:bg-secondary disabled:opacity-30"
        >
          <ArrowUp size={14} />
        </button>
        <input
          aria-label="Folder path"
          value={typed ?? listing?.path ?? ''}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void go(typed ?? undefined)}
          title="Type or paste a path, then Enter"
          className="min-w-0 flex-1 rounded bg-background px-2 py-1 font-mono text-xs text-foreground/80 focus:outline focus:outline-ring"
        />
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} /> hidden
        </label>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <ul className="max-h-64 overflow-y-auto rounded-md border border-border">
        {listing?.dirs.length === 0 && <li className="px-3 py-2 text-xs text-muted-foreground">No folders here.</li>}
        {listing?.dirs.map((d) => (
          <li key={d.path}>
            <button
              type="button"
              onDoubleClick={() => onPick(d.path)}
              onClick={() => void go(d.path)}
              className={cn('flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-secondary', d.isGitRepo && 'text-foreground')}
            >
              <Folder size={14} className="shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{d.name}</span>
              {d.isGitRepo && (
                <span className="flex items-center gap-1 rounded bg-success/10 px-1.5 py-0.5 text-[11px] text-success">
                  <GitBranch size={10} /> git
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
      {listing && (
        <button
          type="button"
          onClick={() => onPick(listing.path)}
          className="h-8 w-full rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {pickLabel}: <span className="font-mono text-xs">{listing.path.split('/').pop() || listing.path}</span>
        </button>
      )}
    </div>
  )
}
