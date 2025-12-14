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
  secondaryCta?: string
  secondaryHref?: string
}

const plans: PricingPlan[] = [
  {
    name: 'Hosted Starter',
    price: 'Free seats to start, then per-seat pricing',
    for: 'Launch the core workflow fast. AI helps with drafts and structure, humans approve the real decisions, and the trail is always visible. Hosted by MYTE; migrate to sovereignty any time.',
    bullets: [
      'One living record from bid to build: context stays connected.',
      'AI assistance that stays assistive-your team approves every move that matters.',
      'Stay hosted while you map guardrails, then migrate to your own domain without a rebuild.',
    ],
    cta: 'Request early access',
    href: '#cta',
    badge: 'Start here',
    featured: true,
    note: 'Great for fast starts while we’re in beta waves.',
  },
  {
    name: 'Sovereign Source License',
    price: 'One-time sovereign source license',
    for: 'For teams ready to own the OS-run it on your infrastructure with your identity and security controls.',
    bullets: [
      'Full source access and your data on your infrastructure.',
      'Policy gates so AI stays helpful and humans stay accountable.',
      'Guided migration from hosted to sovereign without losing history.',
    ],
    cta: 'Join the waitlist',
    href: '#cta',
    secondaryCta: 'Book a license call',
    secondaryHref: 'https://calendly.com/ahmed-mekallach/thought-exchange',
    badge: 'Own the machine',
    note: 'Shift from hosted to fully sovereign without vendor lock-in.',
  },
  {
    name: 'Sovereign Managed Customization',
    price: 'Managed sovereign retainer',
    for: 'For teams that want ongoing custom development and support on their sovereign instance.',
    bullets: [
      'Dedicated build lane on your fork for steel estimating, detailing, fabrication, erection, and compliance.',
      'Custom features, integrations, and workflow tuning delivered by a managed MYTE crew.',
      'Compliance, audit logging, and AI checkpoints tailored to your policies and jurisdictions.',
    ],
    cta: 'Book a build session',
    href: 'https://calendly.com/ahmed-mekallach/thought-exchange',
    secondaryCta: 'Explore Myte Cody',
    secondaryHref: 'https://mytecody.com',
    note: 'Perfect when you want sovereignty plus a managed crew evolving the OS with you.',
  },
]

export default function PricingSection({ id = 'pricing', className, ctaHref = '#cta', ctaLabel }: Props) {
  return (
    <section id={id} className={cn('mx-auto max-w-6xl px-4 sm:px-6', className)}>
      <div className="space-y-6 rounded-3xl border border-border/60 bg-[color:var(--panel)]/85 px-6 py-10 shadow-card sm:px-10 sm:py-12">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-3">
            <Badge className="w-fit">Pricing & paths</Badge>
            <h2 className="text-3xl font-semibold leading-tight sm:text-4xl">
              Pricing & paths
            </h2>
            <p className="max-w-3xl text-base text-muted-foreground">
              Start hosted with free seats to prove out the workflow, then move to full ownership when you want it.
              Pricing stays simple; compute stays transparent.
            </p>
          </div>
          <div className="rounded-full border border-border/60 bg-panel/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground shadow-glow">
            No lock-in. Compute usage stays transparent.
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={cn(
                'flex h-full flex-col border-border/70 bg-[color:var(--panel)] shadow-card p-4 sm:p-5',
                plan.featured && 'border-accent/60 shadow-glow'
              )}
            >
              <CardHeader className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-lg font-semibold leading-snug">{plan.name}</CardTitle>
                  <span className="rounded-full border border-border/60 bg-white/5 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                    {plan.price}
                  </span>
                </div>
                <CardDescription className="text-xs font-semibold uppercase tracking-[0.16em]">
                  {plan.badge ?? 'Sovereign-ready'}
                </CardDescription>
                <CardDescription className="text-sm leading-relaxed text-muted-foreground">
                  {plan.for}
                </CardDescription>
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
                  className={cn(
                    buttonVariants({ variant: plan.featured ? 'primary' : 'secondary', size: 'md' }),
                    'w-full justify-center'
                  )}
                >
                  {plan.cta ?? ctaLabel ?? 'Talk to sales'}
                </Link>
                {plan.secondaryCta && plan.secondaryHref && (
                  <Link
                    href={plan.secondaryHref}
                    className={cn(
                      buttonVariants({ variant: plan.featured ? 'secondary' : 'ghost', size: 'md' }),
                      'w-full justify-center'
                    )}
                  >
                    {plan.secondaryCta}
                  </Link>
                )}
                {plan.note && <p className="text-sm text-muted-foreground">{plan.note}</p>}
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
