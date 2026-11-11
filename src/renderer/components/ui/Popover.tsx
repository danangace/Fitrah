import { type ReactNode, useEffect, useRef } from 'react'
import { cn } from '../../lib/cn'

/** Menu that opens above its trigger (composer pickers); closes on outside click or Esc. */
export function Popover({ open, onClose, children, className, align = 'left' }: { open: boolean; onClose: () => void; children: ReactNode; className?: string; align?: 'left' | 'right' }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && onClose()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div
      ref={ref}
      role="menu"
      className={cn(
        'absolute bottom-full z-40 mb-2 rounded-xl border border-border bg-popover p-1 shadow-2xl shadow-black/50',
        align === 'right' ? 'right-0' : 'left-0',
        className,
      )}
    >
      {children}
    </div>
  )
}
