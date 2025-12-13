'use client'

import Link from 'next/link'
import { FormEvent, useMemo, useState } from 'react'

import AuthShell from '../../components/AuthShell'
import { ApiError, apiFetch } from '../../lib/api'

type VerifyResponse = {
  status?: string
}

type ResendResponse = {
  status?: string
}

export default function WaitlistVerifyPage() {
  const prefilledEmail = useMemo(() => {
    if (typeof window === 'undefined') return ''
    return new URLSearchParams(window.location.search).get('email') || ''
  }, [])

  const [email, setEmail] = useState(prefilledEmail)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [verified, setVerified] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canResend = email.trim() !== '' && !loading
  const canVerify = canResend && code.trim().length > 0

  const handleVerify = async (event: FormEvent) => {
    event.preventDefault()
    if (!canVerify) return
    setLoading(true)
    setError(null)
    setMessage(null)
    setVerified(false)
    try {
      await apiFetch<VerifyResponse>('/marketing/waitlist/verify', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), code: code.trim() }),
      })
      setVerified(true)
      setMessage('Email verified. Your waitlist entry is confirmed.')
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Unable to verify that code. Please try again.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (!canResend) return
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const res = await apiFetch<ResendResponse>('/marketing/waitlist/resend', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      })
      if (res?.status === 'verified') {
        setVerified(true)
        setMessage('This email is already verified for the waitlist.')
      } else {
        setMessage('Verification code sent. Check your inbox for a 6‑digit code.')
      }
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Unable to resend a code right now. Please try again shortly.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Verify your waitlist email"
      subtitle="Enter the 6‑digit code we emailed you to confirm your spot in the cohort."
      badge="Waitlist verification"
      footer={
        <div className="form-links">
          <Link href="/">Back to landing</Link>
          <Link href="/auth/register">Create account</Link>
        </div>
      }
    >
      <form className="form-grid" onSubmit={handleVerify}>
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
          <span>Verification code</span>
          <input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
          <small className="microcopy">Codes expire quickly. If yours expired, resend a new one.</small>
        </label>

        {message && <div className={verified ? 'feedback success' : 'feedback subtle'}>{message}</div>}
        {error && <div className="feedback error">{error}</div>}

        <div className="form-links">
          <button className="btn primary" type="submit" disabled={!canVerify}>
            {loading ? 'Verifying...' : 'Verify email'}
          </button>
          <button className="btn secondary" type="button" onClick={handleResend} disabled={!canResend}>
            {loading ? 'Sending...' : 'Resend code'}
          </button>
        </div>
      </form>
    </AuthShell>
  )
}

