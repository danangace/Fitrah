import { ShieldAlert, ShieldCheck, ShieldX } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../api/fitrah'
import { errorText } from '../../lib/errors'
import type { ApprovalItem } from '../../lib/transcript'
import { Button } from '../ui/Button'

/** Approve / Deny card for a tool request (OQ-22). */
export function ApprovalCard({ item }: { item: ApprovalItem }) {
  const [error, setError] = useState<string | null>(null)
  const answer = (decision: 'allow' | 'deny') => api.answerApproval(item.id, decision).catch((e: unknown) => setError(errorText(e)))

  if (item.decision) {
    const allowed = item.decision === 'allow'
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {allowed ? <ShieldCheck size={13} className="text-success" /> : <ShieldX size={13} className="text-destructive" />}
        {allowed ? 'Allowed' : 'Denied'}: {item.tool} · <span className="truncate">{item.summary}</span>
      </div>
    )
  }
  return (
    <div className="space-y-2 rounded-md border border-amber-700 bg-amber-950/40 p-3">
      <div className="flex items-center gap-2 text-sm font-medium text-amber-200">
        <ShieldAlert size={15} /> Claude wants to use {item.tool}
        <span className="text-xs font-normal text-warning/80">· {item.reason}</span>
      </div>
      <pre className="overflow-x-auto rounded bg-background px-2 py-1.5 text-xs whitespace-pre-wrap text-foreground">{item.summary}</pre>
      {error && <div className="text-xs text-destructive">{error}</div>}
      <div className="flex gap-2">
        <Button variant="primary" onClick={() => void answer('allow')}>
          Approve
        </Button>
        <Button variant="danger" onClick={() => void answer('deny')}>
          Deny
        </Button>
      </div>
    </div>
  )
}
