import { ShieldAlert, ShieldCheck, ShieldX } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../api/fitrah'
import { errorText } from '../../lib/errors'
import type { ApprovalItem } from '../../lib/transcript'
import { Button } from '../ui/Button'

/** Approve / Deny card for a tool request (OQ-22), in Orca's quiet card style. */
export function ApprovalCard({ item }: { item: ApprovalItem }) {
  const [error, setError] = useState<string | null>(null)
  const answer = (decision: 'allow' | 'deny') => api.answerApproval(item.id, decision).catch((e: unknown) => setError(errorText(e)))

  if (item.decision) {
    const allowed = item.decision === 'allow'
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {allowed ? <ShieldCheck className="size-3.5 text-success/80" /> : <ShieldX className="size-3.5 text-destructive" />}
        {allowed ? 'Allowed' : 'Denied'}: {item.tool} · <span className="truncate font-mono text-xs">{item.summary}</span>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-input bg-card px-4 py-3 shadow-sm">
      <div className="flex items-start gap-2">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-foreground">Claude wants to use {item.tool}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">{item.reason}</div>
        </div>
      </div>
      <pre className="max-h-48 overflow-auto rounded-md bg-background px-2.5 py-1.5 font-mono text-xs whitespace-pre-wrap text-foreground/90">{item.summary}</pre>
      {error && <div className="text-xs text-destructive">{error}</div>}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => void answer('deny')}>
          Deny
        </Button>
        <Button variant="primary" onClick={() => void answer('allow')}>
          Approve
        </Button>
      </div>
    </div>
  )
}
