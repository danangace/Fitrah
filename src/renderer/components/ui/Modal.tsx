import { X } from 'lucide-react'
import { type ReactNode, useEffect } from 'react'
import { cn } from '../../lib/cn'

/** Centered dialog with a dimmed backdrop; Esc or ✕ closes it. */
export function Modal({
  title,
  onClose,
  children,
  width = 'max-w-lg',
}: {
  title: string
  onClose: () => void
  children: ReactNode
  width?: string
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-[8vh] backdrop-blur-[2px]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className={cn('mb-[8vh] w-full rounded-xl border border-border bg-popover shadow-2xl shadow-black/50', width)}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </header>
        <div className="space-y-4 px-5 pb-5">{children}</div>
      </div>
    </div>
  )
}
