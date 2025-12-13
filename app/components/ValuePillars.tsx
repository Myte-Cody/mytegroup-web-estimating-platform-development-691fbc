import { ClipboardCheck, ShieldCheck, UserCog, Users } from 'lucide-react'

import { cn } from '../lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'

type Props = {
  id?: string
  className?: string
}

const pillars = [
  {
    title: 'Company Memory',
    tagline: "Context that doesn't walk away",
    body: 'Every estimate, markup, and field decision leaves a trail. When people roll off a job, the reasoning stays-searchable, reviewable, and tied to what shipped.',
    icon: ClipboardCheck,
  },
  {
    title: 'Human-First AI',
    tagline: 'Drafts fast. Signs off slowly.',
    body: 'AI helps with drafts, summaries, and busywork. Humans approve the real decisions. Every approval is logged so you can trust the path, not just the output.',
    icon: UserCog,
  },
  {
    title: 'Sovereign Roots',
    tagline: 'Your domain. Your data. Your choice.',
    body: 'Start hosted for speed, then migrate to your own domain and infrastructure when you want. We build openly so you can inspect how it works-and take the keys when you’re ready.',
    icon: ShieldCheck,
  },
  {
    title: 'Flow Across Roles',
    tagline: 'Less swivel-chair, more momentum',
    body: 'Estimators, PMs, detailers, shop, and field crews work off the same living record. No copy/paste spirals-just clear handoffs, versioning, and receipts.',
    icon: Users,
  },
] as const

export default function ValuePillars({ id = 'value', className }: Props) {
  return (
    <section id={id} className={cn('relative z-10 mx-auto max-w-6xl px-4 py-12 sm:px-7', className)}>
      <div className="pointer-events-none absolute inset-0 -z-10 bg-grid-slate [background-size:28px_28px] opacity-40" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-[#0b1224]/40 to-[#0b1224]" />
      <div className="space-y-10 rounded-3xl border border-border/60 bg-[color:var(--panel)]/85 px-6 py-10 shadow-card sm:px-10 sm:py-12">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
              A living OS for builders
            </p>
            <h2 className="text-3xl font-semibold leading-tight sm:text-4xl">Built like a forest: roots, trail, canopy</h2>
            <p className="max-w-2xl text-base text-muted-foreground">
              The vibe is simple: keep the knowledge, keep humans accountable, and let the system grow with your crew.
              Steel-first today. Built to support every trade tomorrow.
            </p>
          </div>
          <div className="rounded-full border border-border/60 bg-card/60 px-4 py-2 text-xs font-medium text-muted-foreground shadow-glow backdrop-blur">
            Open build. Honest trail. No bullshit.
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:gap-6 md:grid-cols-2 xl:grid-cols-4">
          {pillars.map((pillar) => {
            const Icon = pillar.icon
            return (
              <Card
                key={pillar.title}
                className="group h-full border-white/10 bg-card/80 shadow-glow transition duration-200 hover:-translate-y-1 hover:border-primary/50 hover:shadow-[0_24px_80px_rgba(37,99,235,0.25)]"
              >
                <CardHeader className="gap-4 px-5 pt-5">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/25 via-primary/15 to-transparent p-2 text-primary ring-1 ring-inset ring-primary/40 transition duration-200 group-hover:scale-105 group-hover:ring-primary/60">
                    <Icon className="h-6 w-6" strokeWidth={1.75} />
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-lg sm:text-xl">{pillar.title}</CardTitle>
                    <CardDescription className="text-sm font-semibold text-primary">
                      {pillar.tagline}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="px-5 pb-5 pt-1 text-base leading-relaxed text-muted-foreground">
                  {pillar.body}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}
