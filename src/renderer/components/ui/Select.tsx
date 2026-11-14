import { Select as Primitive } from '@base-ui/react/select'
import { Check, ChevronsUpDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type SelectOption = { value: string; label: ReactNode; disabled?: boolean }

/**
 * shadcn "base" select on Base UI, in this app's dark tokens. Replaces the native `<select>`:
 * a styled trigger, a popup list with a check on the chosen item, keyboard + type-ahead.
 * `''` means "nothing chosen" and shows the placeholder.
 */
export function Select({
  value,
  onValueChange,
  options,
  placeholder = 'Choose…',
  disabled,
  className,
  'aria-label': ariaLabel,
}: {
  value: string
  onValueChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  className?: string
  'aria-label'?: string
}) {
  return (
    <Primitive.Root
      items={options}
      value={value === '' ? null : value}
      onValueChange={(v) => onValueChange(typeof v === 'string' ? v : '')}
      disabled={disabled}
    >
      <Primitive.Trigger
        aria-label={ariaLabel}
        className={cn(
          'flex h-8 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-card px-2.5 text-left text-sm text-foreground outline-none select-none',
          'hover:bg-secondary/60 focus-visible:border-ring data-popup-open:border-ring data-disabled:cursor-not-allowed data-disabled:opacity-50',
          className,
        )}
      >
        <Primitive.Value placeholder={placeholder} className="min-w-0 flex-1 truncate data-placeholder:text-muted-foreground" />
        <Primitive.Icon className="shrink-0 text-muted-foreground">
          <ChevronsUpDown className="size-3.5" />
        </Primitive.Icon>
      </Primitive.Trigger>
      <Primitive.Portal>
        <Primitive.Positioner sideOffset={4} alignItemWithTrigger={false} className="z-[70] outline-none">
          <Primitive.Popup
            className={cn(
              'max-h-[min(var(--available-height),20rem)] min-w-[var(--anchor-width)] origin-[var(--transform-origin)] overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-xl shadow-black/40 outline-none',
              'transition-[scale,opacity] duration-100 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0',
            )}
          >
            <Primitive.List>
              {options.map((o) => (
                <Primitive.Item
                  key={o.value}
                  value={o.value}
                  disabled={o.disabled}
                  className="grid cursor-default grid-cols-[1rem_1fr] items-center gap-2 rounded-md py-1.5 pr-3 pl-2 text-sm text-foreground outline-none select-none data-disabled:opacity-50 data-highlighted:bg-secondary"
                >
                  <Primitive.ItemIndicator className="col-start-1 text-foreground/80">
                    <Check className="size-3.5" />
                  </Primitive.ItemIndicator>
                  <Primitive.ItemText className="col-start-2 truncate">{o.label}</Primitive.ItemText>
                </Primitive.Item>
              ))}
            </Primitive.List>
          </Primitive.Popup>
        </Primitive.Positioner>
      </Primitive.Portal>
    </Primitive.Root>
  )
}
