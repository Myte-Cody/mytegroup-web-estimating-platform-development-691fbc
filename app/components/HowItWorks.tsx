'use client'

import { motion, useReducedMotion, type Variants } from 'framer-motion'

import { cn } from '../lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'

type Step = {
  title: string
  caption: string
  description: string
  outcome: string
}

const steps: Step[] = [
  {
    title: 'Plant the Blueprint',
    caption: 'Map roles, workflows, and guardrails.',
    description:
      'Map your roles, workflows, and approval guardrails. Decide where AI can assist (drafting, summarizing, pre-filling) and where humans must always sign off.',
    outcome:
      'Output: Approvals, checkpoints, and ownership boundaries are defined up front-before anything goes live.',
  },
  {
    title: 'Grow the System',
    caption: 'Stand it up and connect your reality.',
    description:
      'We stand up your OS, connect the data you actually use, and configure human-in-the-loop checkpoints. AI can draft and organize, but your experts approve every move that matters.',
    outcome:
      'Output: Live workflows with an audit trail-every meaningful change is traceable and tied to a person.',
  },
  {
    title: 'Take the Keys',
    caption: 'Hosted if you want. Sovereign when you’re ready.',
    description:
      'On the sovereign path, you own the code, infrastructure, and keys. Extend it with your engineers-or have us help you evolve your fork while you keep control. You can move from hosted to sovereign without rebuilding the whole world.',
    outcome:
      'Output: An OS you can audit, tune, and extend-your domain, your data, your choice.',
  },
]

type Props = {
  id?: string
  className?: string
}

export default function HowItWorksSection({ id = 'how', className }: Props) {
  const reduceMotion = useReducedMotion()

  const fadeUp: Variants = {
    hidden: { opacity: 0, y: reduceMotion ? 0 : 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } },
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
        'relative isolate mx-auto max-w-6xl overflow-hidden rounded-3xl border border-border/60 bg-panel px-5 py-10 shadow-mesh backdrop-blur sm:px-8 md:px-12',
        className
      )}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
      variants={stagger}
      aria-labelledby="how-it-works"
    >
      <div className="pointer-events-none absolute inset-0 -z-10 bg-grid-slate opacity-40" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-primary/15 via-transparent to-amber-200/15" />

      <motion.div className="space-y-3 text-center" variants={fadeUp}>
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.35em] text-muted-foreground">
          Blueprint &gt; Grow &gt; Keys
        </div>
        <h2 id="how-it-works" className="text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
          How it works: three calm steps, no chaos
        </h2>
        <p className="mx-auto max-w-3xl text-base text-muted-foreground">
          A human-in-the-loop rollout designed to keep you in control. Start small, prove the workflow, then expand
          across teams without losing the trail.
        </p>
      </motion.div>

      <div className="relative mt-8 grid gap-4 md:grid-cols-3">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-6 right-6 top-1/2 hidden h-px -translate-y-1/2 bg-gradient-to-r from-primary/40 via-accent/55 to-amber-300/45 md:block"
        />
        {steps.map((step, index) => (
          <motion.div key={step.title} variants={fadeUp} className="relative">
            <Card className="group h-full border-white/10 bg-card/80 p-4 text-left shadow-card transition duration-200 hover:-translate-y-1 hover:border-primary/50 hover:shadow-[0_24px_80px_rgba(37,99,235,0.28)] sm:p-5">
              <CardHeader className="flex flex-row items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/25 via-primary/10 to-transparent text-base font-semibold text-primary ring-1 ring-inset ring-primary/40">
                  {String(index + 1).padStart(2, '0')}
                </div>
                <div className="space-y-1">
                  <CardTitle className="text-lg leading-tight">{step.title}</CardTitle>
                  <CardDescription className="text-sm font-semibold text-primary">
                    {step.caption}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
                <p>{step.description}</p>
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-primary/70 shadow-glow" aria-hidden="true" />
                  <span>{step.outcome}</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </motion.section>
  )
}
