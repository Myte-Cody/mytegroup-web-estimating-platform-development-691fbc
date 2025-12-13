'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'
import AuthShell from '../../components/AuthShell'
import { ApiError, apiFetch } from '../../lib/api'

export default function RegisterPage() {
  const router = useRouter()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [waitlistBlocked, setWaitlistBlocked] = useState(false)
  const [domainBlocked, setDomainBlocked] = useState(false)
  const [legalAccepted, setLegalAccepted] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setWaitlistBlocked(false)
    setDomainBlocked(false)
    setLoading(true)
    try {
      const res = await apiFetch<{ legalRequired?: boolean }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          username: [firstName.trim(), lastName.trim()].filter(Boolean).join(' '),
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
          email,
          password,
          organizationName: organizationName || undefined,
          legalAccepted,
        }),
      })
      if (res?.legalRequired) {
        router.push('/legal')
      } else {
        router.push('/auth')
      }
    } catch (err) {
      if (err instanceof ApiError) {
        const msg = err.message || ''
        if (err.status === 403 && msg.includes('invite-only')) {
          setWaitlistBlocked(true)
          setError(
            "You're in line. Registration is invite-only while we onboard cohorts during business hours. We'll email your invite as soon as your wave opens."
          )
        } else if (err.status === 403 && msg.toLowerCase().includes('your company already has access')) {
          setDomainBlocked(true)
          setError('Your company already has access. Please ask your org admin to invite you.')
        } else {
          setError(msg || 'Unable to create your account right now. Please try again.')
        }
      } else {
        setError('Unable to create your account right now. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Claim an early-access seat and keep your estimating workflows secure."
      badge="Early access"
    >
      <form className="form-grid" onSubmit={handleSubmit}>
        <label>
          <span>First name</span>
          <input
            name="firstName"
            placeholder="Avery"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
        </label>
        <label>
          <span>Last name</span>
          <input
            name="lastName"
            placeholder="Builder"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </label>
        <label>
          <span>Work email</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          <span>Password</span>
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="********"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <small className="microcopy">Use 8+ chars with uppercase, lowercase, number, and symbol.</small>
        </label>
        <label>
          <span>Organization (optional)</span>
          <input
            name="organizationName"
            placeholder="Siteworks Builders"
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
          />
        </label>
        {error && <div className="feedback error">{error}</div>}
        {waitlistBlocked && (
          <div className="feedback subtle">
            Want to move faster? You can{' '}
            <Link href="https://calendly.com/ahmed-mekallach/thought-exchange" target="_blank">
              book a build session
            </Link>{' '}
            to walk through the workspace while your cohort is queued.
          </div>
        )}
        {domainBlocked && (
          <div className="feedback subtle">
            Ask your org owner or admin to invite you from inside MYTE Construction OS so your account stays tied to the
            right workspace.
          </div>
        )}
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={legalAccepted}
            onChange={(e) => setLegalAccepted(e.target.checked)}
            required
          />
          <span className="text-[color:var(--muted)]">
            I agree to the{' '}
            <Link href="/legal" className="underline">
              Privacy Policy
            </Link>{' '}
            and{' '}
            <Link href="/legal" className="underline">
              Terms &amp; Conditions
            </Link>{' '}
            for MYTE Construction OS.
          </span>
        </label>
        <button className="btn primary" type="submit" disabled={loading || !legalAccepted}>
          {loading ? 'Creating...' : 'Create account'}
        </button>
        <div className="form-links">
          <span className="muted">Have an account?</span>
          <Link href="/auth/login">Sign in</Link>
        </div>
      </form>
    </AuthShell>
  )
}
