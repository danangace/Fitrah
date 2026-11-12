import { Checkbox as Primitive } from '@base-ui/react/checkbox'
import { Check } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

/** shadcn "base" checkbox on Base UI with its label; replaces `<input type="checkbox">`. */
export function Checkbox({
  checked,
  onCheckedChange,
  children,
  className,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  children?: ReactNode
  className?: string
}) {
  return (
    <label className={cn('flex cursor-pointer items-center gap-2 select-none', className)}>
      <Primitive.Root
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v)}
        className={cn(
          'flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input bg-card text-primary-foreground outline-none',
          'focus-visible:ring-2 focus-visible:ring-ring/60 data-checked:border-primary data-checked:bg-primary',
        )}
      >
        <Primitive.Indicator>
          <Check className="size-3" strokeWidth={3} />
        </Primitive.Indicator>
      </Primitive.Root>
      {children}
    </label>
  )
}
