import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-[var(--panel-border)] bg-[var(--panel-strong)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]',
        className
      )}
      {...props}
    />
  )
}
