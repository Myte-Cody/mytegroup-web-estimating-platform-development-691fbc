'use client'

import { motion, useReducedMotion, type Variants } from 'framer-motion'
import { Brain, CheckCircle2, ShieldCheck, Workflow } from 'lucide-react'

import { cn } from '../lib/utils'
import { Badge } from './ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'

type Props = {
  id?: string
  className?: string
}

const bulletPoints = [
  'Knowledge stays with your company, even as teams rotate.',
  'AI assists with drafts and structure; your people decide what proceeds.',
  'Approvals and key actions are logged, so the trail stays intact.',
  'Outcomes are tracked; decisions remain human and accountable.',
  'Sovereign by design: your organization controls its data and sharing rules.',
]

const loopStages = [
  {
    label: 'Capture',
    title: "Decisions don't walk off the site",
    body: 'Every estimate, markup, and approval is captured as reusable context so new hires inherit the why behind each choice.',
    icon: Workflow,
  },
  {
    label: 'Assist',
    title: 'AI assists, you decide',
    body:
      'The OS drafts, summarizes, and pre-fills where it helps. Your experts can review, edit, or decline anything.',
    icon: Brain,
  },
  {
    label: 'Approve',
    title: 'Your experts keep the keys',
    body:
      'Humans sign off on what ships—no auto-approvals. Every approval is logged so you always know who cleared a change and why.',
    icon: ShieldCheck,
  },
  {
    label: 'Learn',
    title: 'Traceable intelligence',
    body: 'The system learns from real-world decisions while each organization keeps control of its data and sharing rules.',
    icon: CheckCircle2,
  },
]

export default function IntelligenceSection({ id = 'intelligence', className }: Props) {
  const reduceMotion = useReducedMotion()

  const fade: Variants = {
    hidden: { opacity: 0, y: reduceMotion ? 0 : 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
  }

  const stagger: Variants = {
    hidden: {},
    visible: {
      transition: { staggerChildren: reduceMotion ? 0 : 0.08, delayChildren: reduceMotion ? 0 : 0.04 },
    },
  }

  return (
    <motion.section
      id={id}
      className={cn(
        'relative mx-auto max-w-6xl rounded-3xl border border-border/60 bg-panel px-4 py-10 shadow-mesh backdrop-blur',
        className
      )}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
      variants={stagger}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-grid-slate [background-size:28px_28px] opacity-25"
        aria-hidden
      />
      <motion.div className="space-y-3" variants={fade}>
        <Badge className="w-fit">Human-in-the-loop intelligence</Badge>
        <h2 className="text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
          Helpful intelligence. Zero autopilot.
        </h2>
        <p className="max-w-4xl text-base text-muted-foreground">
          AI stays in an assistive lane: drafts, summaries, checklists, and prep. Humans keep the keys. Every approval
          and key action is logged so your company retains the “why”-even as people change.
        </p>
      </motion.div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <motion.div className="space-y-4" variants={fade}>
          <div className="space-y-3 rounded-2xl border border-border/60 bg-[color:var(--panel-strong)] p-5 shadow-card">
            <p className="text-[var(--text)]">
              Your crews do the real work; the OS keeps the context alive. Estimates, markups, and field decisions stay
              connected and traceable, so nobody has to relearn a job from scratch.
            </p>
            <p className="text-muted-foreground">
              AI never auto-approves or bypasses your team. It helps with drafts and structure, but humans approve every
              move that matters. Each approval carries a receipt so leaders can see what changed, who cleared it, and
              why.
            </p>
            <p className="text-muted-foreground">
              Collaboration is designed to preserve your data boundaries and audit trails as work moves between roles,
              companies, and project phases. The OS tracks outcomes; accountability stays human.
            </p>
          </div>
          <ul className="grid gap-3 md:grid-cols-2">
            {bulletPoints.map((point) => (
              <li
                key={point}
                className="flex items-start gap-3 rounded-2xl border border-border/50 bg-white/5 p-4 text-sm text-muted-foreground shadow-inner"
              >
                <span
                  className="mt-1 inline-block h-2 w-2 rounded-full bg-gradient-to-br from-accent to-accent-warm shadow-glow"
                  aria-hidden
                />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div
          className="grid gap-3 rounded-2xl border border-border/60 bg-[color:var(--panel-strong)] p-5 shadow-card"
          variants={fade}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {'Capture > Assist > Approve > Learn'}
              </p>
              <p className="text-sm text-muted-foreground">
                A simple, auditable loop that keeps AI helpful and humans accountable.
              </p>
            </div>
            <span className="rounded-full border border-accent/50 bg-accent/15 px-3 py-1 text-xs font-semibold text-[var(--text)]">
              Human oversight baked in
            </span>
          </div>

          <div className="grid gap-3">
            {loopStages.map((stage, index) => {
              const Icon = stage.icon
              return (
                <Card
                  key={stage.label}
                  className="border-border/70 bg-[color:var(--panel)] shadow-inner p-4 sm:p-5"
                >
                  <CardHeader className="flex flex-row items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent/25 via-accent/10 to-transparent text-accent ring-1 ring-inset ring-accent/40">
                      <Icon size={18} strokeWidth={1.75} />
                    </div>
                    <div className="flex-1 space-y-1">
                      <CardTitle className="text-base leading-tight">{stage.title}</CardTitle>
                      <CardDescription className="text-xs font-semibold uppercase tracking-[0.18em]">
                        {String(index + 1).padStart(2, '0')} - {stage.label}
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {stage.body}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </motion.div>
      </div>
    </motion.section>
  )
}
