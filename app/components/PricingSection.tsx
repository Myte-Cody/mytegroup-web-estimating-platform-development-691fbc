import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'

import { cn } from '../lib/utils'
import { Badge } from './ui/badge'
import { buttonVariants } from './ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card'

type Props = {
  id?: string
  className?: string
  ctaHref?: string
  ctaLabel?: string
}

type PricingPlan = {
  name: string
  price: string
  for: string
  bullets: string[]
  cta: string
  href: string
  badge?: string
  featured?: boolean
  note?: string
}

const plans: PricingPlan[] = [
  {
    name: 'Hosted Starter',
    price: '5 free seats + $50/extra seat/mo',
    for: 'Teams launching quickly on the hosted OS with auditability baked in.',
    bullets: [
      'Pooled AI actions so you can run real work on day one.',
      'Stay hosted while you map roles and guardrails; move to your own domain without a rebuild.',
      'Human-in-the-loop controls and traceable events from day one.',
    ],
    cta: 'Start hosted',
    href: '/auth/register',
    badge: 'Start here',
    featured: true,
    note: 'Great for fast starts while you evaluate the structural steel OS.',
  },
  {
    name: 'Sovereign Source License',
    price: '$55k one-time license',
    for: 'Organizations that want to own the code, data, and domain.',
    bullets: [
      'Inspect and extend the Structural Steel OS with your engineers.',
      'Run on your infrastructure with your preferred identity and policy controls.',
      'Keep the human-in-the-loop guardrails and event trails intact.',
    ],
    cta: 'See the source blueprint',
    href: '/auth/register?path=sovereign',
    badge: 'Own the machine',
    note: 'Shift from hosted to fully sovereign without vendor lock-in.',
  },
  {
    name: 'Sovereign Managed Customization',
    price: 'From $8.5k per month',
    for: 'Teams that want a dedicated build lane on their fork.',
    bullets: [
      'Ongoing custom development and support on your sovereign instance.',
      'Workflows tuned for estimators, detailers, fabricators, erectors, and field teams.',
      'Compliance, audit logging, and AI checkpoints tailored to your policies.',
    ],
    cta: 'Book a build session',
    href: '/auth/register?path=managed',
    note: 'Perfect when you want sovereignty plus a managed crew evolving the OS with you.',
  },
]

export default function PricingSection({ id = 'pricing', className, ctaHref = '#cta', ctaLabel }: Props) {
  return (
    <section id={id} className={cn('mx-auto max-w-6xl px-4 sm:px-6', className)}>
      <div className="space-y-6 rounded-3xl border border-border/60 bg-[color:var(--panel)]/85 px-6 py-10 shadow-card sm:px-10 sm:py-12">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-3">
            <Badge className="w-fit">Pricing & offers</Badge>
            <h2 className="text-3xl font-semibold leading-tight sm:text-4xl">Pick your path to sovereignty</h2>
            <p className="max-w-3xl text-base text-muted-foreground">
              Hosted starts get you moving fast with guardrails intact. Sovereign paths let you own the machine-code, data,
              and domain-with us beside you for customization.
            </p>
          </div>
          <div className="rounded-full border border-border/60 bg-panel/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground shadow-glow">
            No lock-in. Human-in-the-loop by design.
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {plans.map((plan) => (
          <Card
            key={plan.name}
            className={cn(
              'flex h-full flex-col border-border/70 bg-[color:var(--panel)] shadow-card',
              plan.featured && 'border-accent/60 shadow-glow'
            )}
          >
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <span className="rounded-full border border-border/60 bg-white/5 px-3 py-1 text-xs font-semibold text-muted-foreground">
                  {plan.price}
                </span>
              </div>
              <CardDescription className="text-sm font-semibold uppercase tracking-[0.16em]">
                {plan.badge ?? 'Sovereign-ready'}
              </CardDescription>
              <CardDescription className="text-base leading-relaxed text-muted-foreground">{plan.for}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 space-y-3 text-sm text-muted-foreground">
              <ul className="space-y-2">
                {plan.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-accent" aria-hidden />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Link
                href={plan.href || ctaHref}
                className={cn(buttonVariants({ variant: plan.featured ? 'primary' : 'secondary', size: 'md' }), 'w-full justify-center')}
              >
                {plan.cta ?? ctaLabel ?? 'Talk to sales'}
              </Link>
              {plan.note && <p className="text-sm text-muted-foreground">{plan.note}</p>}
            </CardFooter>
          </Card>
        ))}
      </div>
      </div>
    </section>
  )
}
