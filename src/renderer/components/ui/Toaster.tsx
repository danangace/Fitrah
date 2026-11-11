import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import { useToasts } from '../../store/toast'
import { Alert, AlertDescription, AlertTitle } from './Alert'

const ICON = { success: CircleCheck, destructive: CircleAlert, default: Info }

/** Stack of alerts in the bottom-right corner, just above the status bar. */
export function Toaster() {
  const { toasts, dismiss } = useToasts()
  if (toasts.length === 0) return null
  return (
    <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-10 z-[60] flex w-80 flex-col gap-2">
      {toasts.map((t) => {
        const Icon = ICON[t.variant]
        return (
          <Alert key={t.id} variant={t.variant} className="pointer-events-auto pr-9 shadow-xl shadow-black/40">
            <Icon />
            <AlertTitle>{t.title}</AlertTitle>
            {t.description && <AlertDescription>{t.description}</AlertDescription>}
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => dismiss(t.id)}
              className="absolute top-2.5 right-2.5 rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </Alert>
        )
      })}
    </div>
  )
}
