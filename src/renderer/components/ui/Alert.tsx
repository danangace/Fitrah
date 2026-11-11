import type { ComponentProps } from 'react'
import { cn } from '../../lib/cn'

/** shadcn "base" alert, in this app's dark tokens; `success` added for confirmations. */
const variants = {
  default: 'border-border bg-popover text-foreground',
  success: 'border-success/30 bg-popover text-foreground [&>svg]:text-success',
  destructive: 'border-destructive/40 bg-popover text-foreground [&>svg]:text-destructive',
}

export type AlertVariant = keyof typeof variants

export function Alert({ className, variant = 'default', ...props }: ComponentProps<'div'> & { variant?: AlertVariant }) {
  return (
    <div
      role="alert"
      className={cn(
        'relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-lg border px-4 py-3 text-sm has-[>svg]:grid-cols-[1rem_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5',
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}

export function AlertTitle({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight', className)} {...props} />
}

export function AlertDescription({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('col-start-2 grid justify-items-start gap-1 text-[13px] text-muted-foreground', className)} {...props} />
}
