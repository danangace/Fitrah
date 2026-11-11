import { ShieldQuestion } from 'lucide-react'
import type { ApprovalItem } from '../../lib/transcript'

/** Placeholder until T23 wires approve / deny. */
export function ApprovalCard({ item }: { item: ApprovalItem }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-amber-800 bg-amber-950/40 px-3 py-2 text-sm text-amber-200">
      <ShieldQuestion size={14} /> {item.tool}: {item.summary}
    </div>
  )
}
