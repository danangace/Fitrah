import { Dialog } from '@base-ui/react/dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

/**
 * shadcn "base" dialog on Base UI (was a hand-made overlay). Same props as before: rendered = open;
 * Esc, a click outside or ✕ calls onClose. Base UI keeps nested layers right: Esc or a click inside
 * an open select closes the select, not the dialog.
 */
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
  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[2px] transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Viewport className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-[8vh]">
          <Dialog.Popup
            aria-label={title}
            className={cn(
              'mb-[8vh] w-full rounded-xl border border-border bg-popover shadow-2xl shadow-black/50 outline-none',
              'transition-[scale,opacity] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0',
              width,
            )}
          >
            <header className="flex items-center justify-between px-5 pt-4 pb-2">
              <Dialog.Title className="text-base font-semibold text-foreground">{title}</Dialog.Title>
              <Dialog.Close aria-label="Close" className="rounded text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground">
                <X size={18} />
              </Dialog.Close>
            </header>
            <div className="space-y-4 px-5 pb-5">{children}</div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
