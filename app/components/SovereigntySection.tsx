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
    title: 'Your domain, your data, your code.',
    body: 'The system is designed so you can move from a hosted subdomain to your own domain without rewriting the app.',
  },
  {
    title: 'Policy-gated AI.',
    body: 'You define which workflows AI can touch, and all suggestions require human approval where it matters.',
  },
  {
    title: 'Audit trails everywhere.',
    body: 'Estimates, drawings, RFIs, COs, field logs, and AI interactions all leave a trace.',
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
              Start hosted, then take full control. Move from a Myte subdomain to your own domain with configuration changes, not rewrites.
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
            <Card key={item.title} className="h-full border-border/70 bg-[color:var(--panel)] shadow-card">
              <CardHeader className="space-y-1">
                <CardTitle className="text-lg leading-tight">{item.title}</CardTitle>
                <CardDescription className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  <Shield size={14} className="mr-1 inline-block align-middle text-accent" aria-hidden />
                  Sovereign ready
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{item.body}</CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
