'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Menu, X } from 'lucide-react'

import { NAV_SECTIONS } from '../config/nav'
import { cn } from '../lib/utils'
import { buttonVariants } from './ui/button'
import ThemeToggle from './ThemeToggle'

const CTA_LABEL = 'Book a Build Session'

export default function SiteHeader() {
  const [open, setOpen] = useState(false)
  const headerLinks = NAV_SECTIONS.filter((section) => section.inHeader)

  useEffect(() => {
    const close = () => setOpen(false)
    window.addEventListener('resize', close)
    window.addEventListener('hashchange', close)
    return () => {
      window.removeEventListener('resize', close)
      window.removeEventListener('hashchange', close)
    }
  }, [])

  return (
    <header className="global-header">
      <div className="mx-auto flex max-w-6xl items-center gap-2.5 rounded-2xl border border-border/60 bg-[color:var(--panel)]/90 px-4 py-2 shadow-card backdrop-blur">
        <Link href="#hero" className="flex items-center gap-2" aria-label="MYTE Construction OS">
          <img src="/favicon.png" alt="MYTE Construction icon" className="brand-icon" />
          <div className="leading-tight">
            <div className="logo-text-lux text-xs">MYTE Construction OS</div>
            <div className="text-[11px] text-muted-foreground">
              Sovereign trades OS. We don&apos;t need your data.
            </div>
          </div>
        </Link>

        <nav
          className="hidden flex-1 items-center gap-3 text-sm text-muted-foreground md:flex"
          aria-label="Primary navigation"
        >
          {headerLinks.map((section) => (
            <Link
              key={section.id}
              href={`#${section.id}`}
              className="rounded-full px-3 py-1.5 transition hover:bg-white/5 hover:text-[color:var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            >
              {section.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-2 md:flex">
          <ThemeToggle floating={false} />
          <Link href="#cta" className={buttonVariants({ variant: 'primary', size: 'sm' })}>
            {CTA_LABEL}
          </Link>
        </div>

        <button
          type="button"
          className="ml-auto inline-flex items-center gap-2 rounded-full border border-border/70 bg-[color:var(--panel-strong)] px-3 py-2 text-sm text-[color:var(--text)] shadow-card transition hover:border-[color:var(--accent)] hover:text-[color:var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent md:hidden"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-controls="mobile-nav"
        >
          {open ? <X size={16} /> : <Menu size={16} />}
          <span className="font-semibold">Menu</span>
        </button>
      </div>

      <div
        className={cn(
          'md:hidden transition-[max-height,opacity] duration-200 ease-decel',
          open ? 'max-h-[480px] opacity-100' : 'pointer-events-none max-h-0 opacity-0'
        )}
      >
        <nav
          id="mobile-nav"
          aria-label="Mobile navigation"
          className="mt-3 space-y-2 rounded-2xl border border-border/60 bg-[color:var(--panel)]/95 p-3 shadow-card backdrop-blur"
        >
          {headerLinks.map((section) => (
            <Link
              key={section.id}
              href={`#${section.id}`}
              className="block rounded-xl px-3 py-2 text-sm text-[color:var(--text)] transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
              onClick={() => setOpen(false)}
            >
              {section.label}
            </Link>
          ))}
          <Link
            href="#cta"
            className={cn(buttonVariants({ variant: 'primary', size: 'sm' }), 'w-full justify-center')}
            onClick={() => setOpen(false)}
          >
            {CTA_LABEL}
          </Link>
          <ThemeToggle floating={false} className="w-full justify-center" />
        </nav>
      </div>
    </header>
  )
}
