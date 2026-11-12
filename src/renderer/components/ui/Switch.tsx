import { Switch as Primitive } from '@base-ui/react/switch'
import { cn } from '../../lib/cn'

/** shadcn "base" switch on Base UI, in this app's dark tokens. */
export function Switch({
  checked,
  onCheckedChange,
  disabled,
  className,
  'aria-label': ariaLabel,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
  'aria-label'?: string
}) {
  return (
    <Primitive.Root
      aria-label={ariaLabel}
      checked={checked}
      disabled={disabled}
      onCheckedChange={(v) => onCheckedChange(v)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-accent p-0.5 outline-none transition-colors',
        'focus-visible:ring-2 focus-visible:ring-ring/60 data-checked:bg-success data-disabled:cursor-not-allowed data-disabled:opacity-50',
        className,
      )}
    >
      <Primitive.Thumb className="block size-4 rounded-full bg-foreground shadow-sm transition-transform data-checked:translate-x-4" />
    </Primitive.Root>
  )
}
