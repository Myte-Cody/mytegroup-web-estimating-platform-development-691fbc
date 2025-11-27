'use client'

import Link from 'next/link'
import { Mail, Users } from 'lucide-react'
import { FormEvent, useEffect, useMemo, useState } from 'react'

import { cn } from '../lib/utils'
import { apiFetch } from '../lib/api'
import { Badge } from './ui/badge'
import { buttonVariants } from './ui/button'

type Props = {
  id?: string
  className?: string
}

const WAITLIST_ENDPOINT = '/marketing/waitlist'
const WAITLIST_STATS_ENDPOINT = '/marketing/waitlist/stats'

const FALLBACK_WAITLIST_COUNT = process.env.NEXT_PUBLIC_WAITLIST_COUNT_DISPLAY || '1,247'
const FALLBACK_FREE_SEATS_PER_ORG = process.env.NEXT_PUBLIC_FREE_SEATS_PER_ORG || '5'

export default function WaitlistSection({ id = 'cta', className }: Props) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('')
  const [preCreateAccount, setPreCreateAccount] = useState(false)
  const [marketingConsent, setMarketingConsent] = useState(true)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [waitlistDisplay, setWaitlistDisplay] = useState(FALLBACK_WAITLIST_COUNT)
  const [freeSeatsPerOrg, setFreeSeatsPerOrg] = useState(FALLBACK_FREE_SEATS_PER_ORG)

  const payload = useMemo(
    () => ({
      name,
      email,
      role,
      source: 'landing-structural-steel',
      preCreateAccount,
      marketingConsent,
    }),
    [name, email, role, preCreateAccount, marketingConsent]
  )

  const canSubmit = name.trim() !== '' && email.trim() !== '' && role.trim() !== '' && !loading

  useEffect(() => {
    let mounted = true
    async function loadStats() {
      try {
        const stats = await apiFetch<{ waitlistCount?: number; waitlistDisplayCount?: number; freeSeatsPerOrg?: number }>(
          WAITLIST_STATS_ENDPOINT
        )
        if (!mounted) return
        if (typeof stats?.waitlistDisplayCount === 'number') setWaitlistDisplay(stats.waitlistDisplayCount.toLocaleString())
        else if (typeof stats?.waitlistCount === 'number') setWaitlistDisplay(stats.waitlistCount.toLocaleString())
        if (typeof stats?.freeSeatsPerOrg === 'number') setFreeSeatsPerOrg(String(stats.freeSeatsPerOrg))
      } catch {
        // keep fallback numbers if fetch fails
      }
    }
    loadStats()
    return () => {
      mounted = false
    }
  }, [])

  const trackEvent = async (event: string, meta?: Record<string, any>) => {
    try {
      await apiFetch('/marketing/events', {
        method: 'POST',
        body: JSON.stringify({
          event,
          meta,
          source: 'landing-structural-steel',
          path: typeof window !== 'undefined' ? window.location.pathname : '/',
        }),
      })
    } catch {
      // swallow analytics errors
    }
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!canSubmit) return
    setLoading(true)
    setError(null)
    try {
      await apiFetch(WAITLIST_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setSuccess(true)
      trackEvent('waitlist_submit', { email, role, preCreateAccount, marketingConsent })
    } catch (err: any) {
      setError(err?.message || 'Unable to join the waitlist right now. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section id={id} className={cn('mx-auto max-w-6xl px-4 sm:px-6', className)}>
      <div className="space-y-6 rounded-3xl border border-border/60 bg-[color:var(--panel)]/85 px-6 py-10 shadow-card sm:px-10 sm:py-12">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-3">
            <Badge className="w-fit">Waitlist & cohort</Badge>
            <h2 className="text-3xl font-semibold leading-tight sm:text-4xl">Join the first cohort of builders</h2>
            <p className="max-w-3xl text-base text-muted-foreground">
              First 5 seats are free per org—full platform, AI actions included. Join the queue now; we invite cohorts in waves and unlock your account when your wave opens.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-panel/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground shadow-glow">
            <span className="rounded-full bg-white/10 p-1.5 text-accent ring-1 ring-inset ring-accent/30">
              <Users size={14} />
            </span>
            {waitlistDisplay}+ on the waitlist
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-[color:var(--panel)] p-6 shadow-card backdrop-blur">
            <div className="pointer-events-none absolute inset-0 bg-grid-slate [background-size:28px_28px] opacity-25" aria-hidden />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/15 via-transparent to-amber-200/10" aria-hidden />

            <div className="relative flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="rounded-full border border-border/60 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]">
                Invite waves weekly
              </span>
              <span className="rounded-full border border-border/60 bg-white/5 px-3 py-1">
                Free seats per org: {freeSeatsPerOrg}
              </span>
              <span className="rounded-full border border-border/60 bg-white/5 px-3 py-1">AI actions included</span>
            </div>

            <div className="relative mt-5 space-y-4">
              <h3 className="text-2xl font-semibold leading-tight text-[var(--text)]">Claim a free seat</h3>
              <p className="text-muted-foreground">
                We invite cohorts in waves (typically inside 36 hours during 9–5). Join the waitlist now and optionally pre-create your
                account; when your wave opens, your email gets instant clearance to finish onboarding.
              </p>
              <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
              <label className="flex flex-col gap-2 text-sm font-semibold text-[var(--text)]">
                Full name
                <input
                  name="name"
                    type="text"
                    autoComplete="name"
                    placeholder="Avery Structural"
                    className="w-full rounded-xl border border-border/60 bg-white/5 px-3 py-2 text-base text-[var(--text)] outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[var(--accent)]"
                    aria-required="true"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-semibold text-[var(--text)]">
                Work email
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  className="w-full rounded-xl border border-border/60 bg-white/5 px-3 py-2 text-base text-[var(--text)] outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[var(--accent)]"
                  aria-required="true"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <span className="text-xs font-normal text-muted-foreground">
                  Company email only (no Gmail, Outlook, Yahoo, iCloud, etc.).
                </span>
              </label>
                <label className="flex flex-col gap-2 text-sm font-semibold text-[var(--text)] md:col-span-2">
                  Role
                  <select
                    name="role"
                    className="w-full rounded-xl border border-border/60 bg-white/5 px-3 py-2 text-base text-[var(--text)] outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[var(--accent)]"
                    aria-required="true"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    <option value="" disabled>
                      Select your role
                    </option>
                    <option>Estimator</option>
                    <option>GC / Owner Rep</option>
                    <option>Subcontractor</option>
                    <option>Detailer</option>
                    <option>Fabricator</option>
                    <option>Other</option>
                  </select>
                </label>
                <label className="flex items-center gap-3 text-sm font-semibold text-[var(--text)] md:col-span-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[color:var(--accent)]"
                    checked={preCreateAccount}
                    onChange={(e) => setPreCreateAccount(e.target.checked)}
                  />
                  Pre-create my account when my cohort opens
                </label>
                <label className="flex items-center gap-3 text-sm font-semibold text-[var(--text)] md:col-span-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[color:var(--accent)]"
                    checked={marketingConsent}
                    onChange={(e) => setMarketingConsent(e.target.checked)}
                  />
                  I agree to receive product updates and invite emails
                </label>
                <div className="md:col-span-2 flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className={cn(
                      buttonVariants({ variant: 'primary', size: 'lg' }),
                      'w-full justify-center md:w-auto',
                      loading && 'opacity-80'
                    )}
                  >
                    {loading ? 'Saving...' : success ? "You're in the queue" : 'Join the waitlist'}
                  </button>
                  <Link
                    href="/auth/register"
                    onClick={() => trackEvent('cta_create_account_click', { source: 'waitlist' })}
                    className={cn(
                      buttonVariants({ variant: 'secondary', size: 'lg' }),
                      'w-full justify-center md:w-auto'
                    )}
                  >
                    Create account now
                  </Link>
                </div>
              </form>
              {error && <div className="feedback error">{error}</div>}
              {success && (
                <div className="feedback success">
                  You're on the list. When your cohort opens, we'll email your invite and unlock your account to finish onboarding.
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                You&apos;re in control: we log key events for auditability and keep AI in an assistive lane. No surprise overages-token usage stays transparent.
              </p>
            </div>
          </div>

          <div className="grid content-center gap-4 rounded-3xl border border-border/60 bg-[color:var(--panel-strong)] p-6 shadow-card">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 p-2 text-accent ring-1 ring-inset ring-accent/40">
                <Mail size={18} />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Talk to us</p>
                <p className="text-lg font-semibold text-[var(--text)]">Book a build session</p>
              </div>
            </div>
            <p className="text-base text-muted-foreground">
              Review the source blueprint, map your guardrails, and decide how sovereign you want to be. Hosted today, sovereign tomorrow-with audit trails intact.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="https://calendly.com/ahmed-mekallach/thought-exchange"
                onClick={() => trackEvent('cta_book_session_click', { source: 'waitlist', target: 'calendly' })}
                className={cn(buttonVariants({ variant: 'primary', size: 'md' }), 'w-full justify-center sm:w-auto')}
              >
                Book a build session
              </Link>
              <Link
                href="/auth/register?path=sovereign"
                className={cn(buttonVariants({ variant: 'secondary', size: 'md' }), 'w-full justify-center sm:w-auto')}
              >
                See the source blueprint
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
