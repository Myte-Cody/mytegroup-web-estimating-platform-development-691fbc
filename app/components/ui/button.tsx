import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-full font-semibold tracking-tight transition-all duration-200 ease-decel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:opacity-60 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        primary:
          'bg-[var(--primary-color)] text-white shadow-glow hover:-translate-y-[1px] hover:shadow-card active:translate-y-0',
        secondary:
          'border border-[var(--panel-border)] bg-[var(--panel-strong)] text-[var(--text)] hover:-translate-y-[1px] hover:border-[color:var(--accent)]',
        ghost:
          'border border-transparent bg-transparent text-[var(--text)] hover:bg-[rgba(255,255,255,0.05)] hover:text-white',
        link: 'border border-transparent bg-transparent text-[var(--accent)] underline underline-offset-4 hover:text-[var(--accent-strong)] px-0',
      },
      size: {
        sm: 'text-sm px-3.5 py-1.5',
        md: 'text-sm px-5 py-2',
        lg: 'text-base px-5 py-2.5',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
)

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>

export function Button({
  className,
  variant,
  size,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
}
