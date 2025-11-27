import { ClipboardCheck, ShieldCheck, UserCog, Users } from 'lucide-react'

import { cn } from '../lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'

type Props = {
  id?: string
  className?: string
}

const pillars = [
  {
    title: 'Systemized Experience',
    tagline: 'Knowledge that stays with the company.',
    body: 'Every estimate, markup, approval, and ISO-ready form is captured as reusable context. When people roll off projects or leave, the reasoning and versions stay searchable so teams do not relearn the job.',
    icon: ClipboardCheck,
  },
  {
    title: 'Human-In-The-Loop Intelligence',
    tagline: 'AI fills forms. Your experts decide.',
    body: 'We do not propose takeoffs. The OS pre-fills ISO review forms, assembles connection analysis packages, and produces 3D bid visuals from your 2D take-off. Your experts review and sign off, with every action logged.',
    icon: UserCog,
  },
  {
    title: 'Sovereign Stack',
    tagline: 'Your domain, your data, your code.',
    body: 'Start hosted, then take full control. Inspect and extend the codebase, run on your own domain, and keep your data in your infrastructure. The foundation is free because the real value comes once you own and shape it.',
    icon: ShieldCheck,
  },
  {
    title: 'Cross-Role Continuity',
    tagline: 'Roles stay sovereign and empowered.',
    body: 'Estimators, PMs, field engineers, and builders handle more bids and jobsites with less admin. Your bid management platform keeps sales reps and service providers in sync with transparent versioning on every bid.',
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
              Structural Steel OS
            </p>
            <h2 className="text-3xl font-semibold leading-tight sm:text-4xl">Value pillars that keep sovereignty real</h2>
            <p className="max-w-2xl text-base text-muted-foreground">
              Four reasons this structural steel OS matters: keep experience inside the company, keep humans in charge,
              stay sovereign over code/data/domain, and keep every role aligned.
            </p>
          </div>
          <div className="rounded-full border border-border/60 bg-card/60 px-4 py-2 text-xs font-medium text-muted-foreground shadow-glow backdrop-blur">
            Foundation is free - value comes when you steer it
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
