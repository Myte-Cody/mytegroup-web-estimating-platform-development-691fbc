'use client'

import Link from 'next/link'
import { motion, type Variants, useReducedMotion } from 'framer-motion'
import { Shield, Sparkles, Workflow } from 'lucide-react'

import FaqSection from './components/FaqSection'
import HowItWorksSection from './components/HowItWorks'
import IntelligenceSection from './components/IntelligenceSection'
import PersonaWorkflows from './components/PersonaWorkflows'
import PortalSphere from './components/PortalSphere'
import PricingSection from './components/PricingSection'
import SkyscraperSVG from './components/SkyscraperSVG'
import SovereigntySection from './components/SovereigntySection'
import ValuePillars from './components/ValuePillars'
import WaitlistSection from './components/WaitlistSection'
import { Badge } from './components/ui/badge'
import { buttonVariants } from './components/ui/button'

const CTA_PRIMARY = 'Book a Build Session'
const CTA_SECONDARY = 'Join the Waitlist'

export default function LandingPage() {
  const reduceMotion = useReducedMotion()

  const fadeIn: Variants = {
    hidden: { opacity: 0, y: reduceMotion ? 0 : 18 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const } },
  }

  const stagger: Variants = {
    hidden: {},
    visible: {
      transition: { staggerChildren: reduceMotion ? 0 : 0.08, delayChildren: reduceMotion ? 0 : 0.05 },
    },
  }

  return (
    <main className="landing-shell" id="main-content">
      <div className="mx-auto flex max-w-6xl flex-col gap-16 py-10">
        <motion.section
          id="hero"
          className="relative overflow-hidden rounded-3xl border border-border/60 bg-[color:var(--panel)] px-5 py-10 shadow-mesh backdrop-blur sm:px-8 lg:px-10"
          initial="hidden"
          animate="visible"
          variants={stagger}
        >
            <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
              <motion.div className="space-y-5" variants={fadeIn}>
                <Badge className="w-fit">Steel-first, open to other trades</Badge>
                <div className="space-y-3">
                  <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
                    MYTE Construction OS for Structural Steel—and Beyond
                  </h1>
                  <p className="text-lg text-muted-foreground">
                    Built by and for steel estimators, detailers, fabricators, and erectors—open the code, keep your workflows,
                    and invite allied trades as you grow.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link href="#cta" className={buttonVariants({ variant: 'primary', size: 'lg' })}>
                    {CTA_PRIMARY}
                  </Link>
                  <Link href="#cta" className={buttonVariants({ variant: 'secondary', size: 'lg' })}>
                    {CTA_SECONDARY}
                  </Link>
                </div>
                <p className="text-xs text-muted-foreground">
                  We onboard new organizations in waves so support stays human and hands-on. First 5 seats are free per org; if this
                  wave is full, you&apos;ll get an invite as soon as a seat opens.
                </p>
                <div className="flex flex-wrap gap-2 text-sm text-muted-foreground hero-pills">
                  <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-white/5 px-3 py-1">
                    <Sparkles size={16} />
                    ISO-ready bids, markups, and field reports stay linked
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-white/5 px-3 py-1">
                    <Shield size={16} />
                    AI drafts forms; your team reviews and signs off
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-white/5 px-3 py-1">
                    <Workflow size={16} />
                    Fabrication &amp; erection workflows tied to estimating &amp; controls
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  No replacements. No surveillance. Myte runs alongside your existing tools as a construction OS—on Windows,
                  Linux, and Mac, in your cloud or on-prem—so your company, not your vendors, stays in control of its data.
                  <span className="block mt-1">
                    Start hosted, move to sovereign—your domain, your data, your code. Other trades are welcome; the foundation
                    is free and open, with costs in compute and support.
                  </span>
                </p>
              </motion.div>

              <motion.div
                className="relative isolate overflow-hidden rounded-2xl border border-border/60 bg-transparent px-4 py-4 shadow-card min-h-[420px]"
                variants={fadeIn}
                animate={reduceMotion ? undefined : { y: [0, -8, 0] }}
                transition={
                  reduceMotion
                    ? undefined
                    : { repeat: Infinity, repeatType: 'mirror', duration: 14, ease: [0.33, 1, 0.68, 1] as const }
                }
              >
                {reduceMotion ? (
                  <div className="portal-static" aria-hidden>
                    <div className="portal-static-gradient" />
                    <SkyscraperSVG className="w-full portal-static-poster hero-skyscraper" />
                  </div>
                ) : (
                <PortalSphere
                  className="absolute inset-0 z-50 portal-sphere-foreground pointer-events-none"
                  reduceMotion={!!reduceMotion}
                />
                )}
                <div className="relative z-30 space-y-4">
                  <div className="flex items-center justify-between gap-3 text-muted-foreground">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-accent ring-1 ring-inset ring-accent/50">
                        <Sparkles size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[var(--text)]">Skyline Control Stack</p>
                        <p className="text-xs text-muted-foreground">Visible intelligence, human-governed</p>
                      </div>
                    </div>
                    <span className="rounded-full border border-accent/50 bg-accent/15 px-3 py-1 text-[11px] font-semibold text-[var(--text)] uppercase tracking-[0.14em]">
                      Human command
                    </span>
                  </div>
                  <div className="relative z-0 overflow-hidden rounded-xl border border-border/60 bg-transparent">
                    <SkyscraperSVG className="w-full hero-skyscraper" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-border/60 bg-white/5 p-3 shadow-inner">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="h-2 w-2 rounded-full bg-success shadow-glow" aria-hidden />
                        AI assists (audited)
                      </div>
                      <div className="text-base font-semibold text-[var(--text)]">Logged and traceable</div>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-white/5 p-3 shadow-inner">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="h-2 w-2 rounded-full bg-accent-warm shadow-glow" aria-hidden />
                        Approvals
                      </div>
                      <div className="text-base font-semibold text-[var(--text)]">Human-owned signoffs</div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.section>

          <ValuePillars id="value" />
          <PersonaWorkflows id="workflows" />
          <HowItWorksSection id="how" />
          <IntelligenceSection id="intelligence" />
          <SovereigntySection id="sovereign" />
          <PricingSection id="pricing" />
          <FaqSection id="faq" />
          <WaitlistSection id="cta" />
        </div>
      </main>
    )
}
