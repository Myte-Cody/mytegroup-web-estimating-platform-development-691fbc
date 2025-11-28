'use client'

import Link from 'next/link'
import { motion, type Variants, useReducedMotion } from 'framer-motion'
import { Shield, Sparkles, Workflow } from 'lucide-react'

import FaqSection from '../components/FaqSection'
import HowItWorksSection from '../components/HowItWorks'
import IntelligenceSection from '../components/IntelligenceSection'
import PersonaWorkflows from '../components/PersonaWorkflows'
import PortalSphere from '../components/PortalSphere'
import PricingSection from '../components/PricingSection'
import SkyscraperSVG from '../components/SkyscraperSVG'
import SovereigntySection from '../components/SovereigntySection'
import ValuePillars from '../components/ValuePillars'
import WaitlistSection from '../components/WaitlistSection'
import { Badge } from '../components/ui/badge'
import { buttonVariants } from '../components/ui/button'

const CTA_PRIMARY = 'Create account'
const CTA_SECONDARY = 'Sign in'

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
                  MYTE Construction OS for Structural Steel-and Beyond
                </h1>
                <p className="text-lg text-muted-foreground">
                  Built by and for steel estimators, detailers, fabricators, and erectors-open the code, keep your
                  workflows, and invite allied trades as you grow.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/auth/register" className={buttonVariants({ variant: 'primary', size: 'lg' })}>
                  {CTA_PRIMARY}
                </Link>
                <Link href="/auth/login" className={buttonVariants({ variant: 'secondary', size: 'lg' })}>
                  {CTA_SECONDARY}
                </Link>
              </div>
              <p className="text-xs text-muted-foreground">
                We onboard new organizations in waves so support stays human and hands-on. First 5 seats are free per
                org; if this wave is full, you&apos;ll get an invite as soon as a seat opens.
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
                  Sovereign workflows you can inspect &amp; extend
                </span>
              </div>
            </motion.div>

            <motion.div variants={fadeIn} className="hero-visual">
              <div className="portal-static">
                <div className="portal-static-gradient" />
                <SkyscraperSVG className="portal-static-poster hero-skyscraper" />
              </div>
              <PortalSphere />
            </motion.div>
          </div>
        </motion.section>

        <ValuePillars />
        <PersonaWorkflows />
        <HowItWorksSection />
        <IntelligenceSection />
        <SovereigntySection />
        <PricingSection />
        <WaitlistSection />
        <FaqSection />
      </div>
    </main>
  )
}

