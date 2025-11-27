import { Shield, Workflow } from 'lucide-react'

import { cn } from '../lib/utils'
import { Badge } from './ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'

type Props = {
  id?: string
  className?: string
}

const sovereigntyPoints = [
  {
    title: 'Hosted today, sovereign tomorrow.',
    body: 'Start on a Myte subdomain with managed infrastructure, then move to your own domain and infrastructure through a guided migration—no app rewrites, just data and config changes. Full code and infra ownership are available with the sovereign license.',
  },
  {
    title: 'Policy-gated AI, on your terms.',
    body: 'You decide which steel workflows AI can assist—estimating, detailing, fabrication, erection—and every assisted step routes to a human approver. No auto-approvals; your experts keep the keys.',
  },
  {
    title: 'Audit trails across every project.',
    body: 'Estimates, drawings, RFIs, COs, field logs, and AI-assisted suggestions all leave a trace so leaders can see what changed, who cleared it, and why.',
  },
]

export default function SovereigntySection({ id = 'sovereign', className }: Props) {
  return (
    <section id={id} className={cn('mx-auto max-w-6xl px-4 sm:px-6', className)}>
      <div className="space-y-6 rounded-3xl border border-border/60 bg-[color:var(--panel)]/85 px-6 py-10 shadow-card sm:px-10 sm:py-12">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-3">
            <Badge className="w-fit">Sovereignty & control</Badge>
            <h2 className="text-3xl font-semibold leading-tight sm:text-4xl">Own the machine without vendor lock-in</h2>
            <p className="max-w-3xl text-base text-muted-foreground">
              Start hosted on a Myte subdomain, then grow into a sovereign stack. Move to your own domain and
              infrastructure with a guided migration—no app rewrites, but clear steps for data, infra, and keys when
              you are ready to take full control.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-panel/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground shadow-glow">
            <span className="rounded-full bg-white/10 p-1.5 text-accent ring-1 ring-inset ring-accent/30">
              <Workflow size={14} />
            </span>
            Sovereign stack for structural steel
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {sovereigntyPoints.map((item) => (
            <Card
              key={item.title}
              className="h-full border-border/70 bg-[color:var(--panel)] shadow-card p-4 sm:p-5"
            >
              <CardHeader className="space-y-1">
                <CardTitle className="text-base font-semibold leading-snug">{item.title}</CardTitle>
                <CardDescription className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  <Shield size={14} className="mr-1 inline-block align-middle text-accent" aria-hidden />
                  Sovereign ready
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm leading-relaxed text-muted-foreground">
                {item.body}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
