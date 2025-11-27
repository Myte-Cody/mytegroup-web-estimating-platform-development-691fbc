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
    title: 'Blueprint',
    caption: 'Map roles, steel workflows, and guardrails.',
    description:
      'Map your roles, steel workflows, and approval guardrails. Decide where AI can assist—like drafting ISO forms or connection analysis packets—and where your team must always sign off.',
    outcome:
      'Output: Approvals, checkpoints, and ownership boundaries are defined up front—before any build begins.',
  },
  {
    title: 'Build & Wire Intelligence',
    caption: 'Stand up the OS and connect your steel data.',
    description:
      'We stand up your OS, connect your estimating, detailing, fabrication, and erection data, and configure human-in-the-loop checkpoints. AI can pre-fill forms and generate 3D visuals, but your experts always review and approve.',
    outcome:
      'Output: Live steel workflows with audit trails and policy-gated AI—every action is traceable and routed back to your team.',
  },
  {
    title: 'Handoff & Grow',
    caption: 'Own the code, infra, and keys (sovereign path).',
    description:
      'On the sovereign path, you own the code, infrastructure, and keys—no vendor lock-in. Extend the system with your engineers, or have us manage a fork while you keep full control. Hosted customers can upgrade to sovereignty at any time.',
    outcome:
      'Output: A structural steel OS you can audit, tune, and extend—your domain, your data, your code.',
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
          Blueprint &gt; Build &amp; Wire &gt; Handoff
        </div>
        <h2 id="how-it-works" className="text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
          How it works: adopt the structural steel OS in three steps
        </h2>
        <p className="mx-auto max-w-3xl text-base text-muted-foreground">
          A clear, human-in-the-loop rollout—purpose-built for steel fabricators, erectors, and their leadership. Move
          from blueprint to ownership without losing control or knowledge.
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
