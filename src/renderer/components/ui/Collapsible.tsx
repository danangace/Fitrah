import { Collapsible as Primitive } from '@base-ui/react/collapsible'
import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

/** shadcn "base" collapsible on Base UI; replaces `<details>/<summary>`. */
export function Collapsible({
  title,
  defaultOpen = false,
  children,
  className,
  panelClassName,
}: {
  title: ReactNode
  defaultOpen?: boolean
  children: ReactNode
  className?: string
  panelClassName?: string
}) {
  return (
    <Primitive.Root defaultOpen={defaultOpen} className={cn('rounded-md border border-border', className)}>
      <Primitive.Trigger className="group flex w-full items-center gap-1.5 px-3 py-2 text-left text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground">
        <ChevronRight className="size-3.5 shrink-0 transition-transform group-data-panel-open:rotate-90" />
        {title}
      </Primitive.Trigger>
      <Primitive.Panel className={cn('border-t border-border', panelClassName)}>{children}</Primitive.Panel>
    </Primitive.Root>
  )
}
