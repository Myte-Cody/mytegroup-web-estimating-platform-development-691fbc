'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { FormEvent, Suspense, useEffect, useMemo, useState } from 'react'
import AuthShell from '../../components/AuthShell'
import { ApiError, apiFetch } from '../../lib/api'

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <AuthShell
          title="Create your account"
          subtitle="Loading invite details..."
          badge="Early access"
        >
          <div className="feedback">Loading…</div>
        </AuthShell>
      }
    >
      <RegisterPageInner />
    </Suspense>
  )
}

function RegisterPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const inviteToken = useMemo(() => (searchParams.get('invite') || '').trim(), [searchParams])
  const inviteEmail = useMemo(() => (searchParams.get('email') || '').trim(), [searchParams])
  const hasInvite = inviteToken.length > 0
  const emailLocked = inviteEmail.length > 0

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState(inviteEmail)
  const [password, setPassword] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [domainBlocked, setDomainBlocked] = useState(false)
  const [needsVerification, setNeedsVerification] = useState(false)
  const [legalAccepted, setLegalAccepted] = useState(false)

  useEffect(() => {
    if (emailLocked) setEmail(inviteEmail)
  }, [emailLocked, inviteEmail])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setDomainBlocked(false)
    setNeedsVerification(false)
    setLoading(true)
    try {
      const res = await apiFetch<{ legalRequired?: boolean }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          username: [firstName.trim(), lastName.trim()].filter(Boolean).join(' '),
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
          email: email.trim(),
          password,
          organizationName: organizationName || undefined,
          inviteToken,
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
        if (err.status === 403 && msg.toLowerCase().includes('verify your email')) {
          setNeedsVerification(true)
          setError(msg)
        } else if (err.status === 403 && msg.toLowerCase().includes('your company already has access')) {
          setDomainBlocked(true)
          setError('Your company already has access. Please ask your org admin to invite you.')
        } else if (err.status === 403) {
          setError(msg || 'Unable to create your account right now. Please try again.')
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

  if (!hasInvite) {
    return (
      <AuthShell
        title="Invite required"
        subtitle="MYTE is invite-only while we onboard verified companies in waves. We verify work email + phone to stop fake accounts and keep org workspaces private."
        badge="Invite-only"
        footer={
          <div className="form-links">
            <Link href="/auth/login">Sign in</Link>
            <Link href="/">Back to landing</Link>
          </div>
        }
      >
        <div className="form-grid">
          <div className="feedback subtle">
            Already requested early access? Check your email for an invite link. If you don&apos;t have one yet, request early access and we&apos;ll invite you when your wave opens.
          </div>
          <Link href="/#cta" className="btn primary">
            Request early access
          </Link>
          <Link href="https://calendly.com/ahmed-mekallach/thought-exchange" className="btn secondary" target="_blank">
            Book a build session
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="You're invited. Claim an early-access seat and keep your estimating workflows secure."
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
            readOnly={emailLocked}
            required
          />
          {emailLocked && <small className="microcopy">This invite is tied to {inviteEmail}.</small>}
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
        {domainBlocked && (
          <div className="feedback subtle">
            Ask your org owner or admin to invite you from inside MYTE Construction OS so your account stays tied to the
            right workspace.
          </div>
        )}
        {needsVerification && (
          <div className="feedback subtle">
            <Link href={`/waitlist/verify?email=${encodeURIComponent(email.trim())}`} className="underline">
              Verify your email + phone
            </Link>{' '}
            to unlock registration.
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
