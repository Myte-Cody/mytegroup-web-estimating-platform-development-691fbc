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
  const [emailCode, setEmailCode] = useState('')
  const [phoneCode, setPhoneCode] = useState('')
  const [loading, setLoading] = useState<'email-verify' | 'email-resend' | 'phone-verify' | 'phone-resend' | null>(null)
  const [emailVerified, setEmailVerified] = useState(false)
  const [phoneVerified, setPhoneVerified] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const emailTrimmed = email.trim()
  const canVerifyEmail = emailTrimmed !== '' && emailCode.trim().length > 0 && !loading
  const canResendEmail = emailTrimmed !== '' && !loading
  const canVerifyPhone = emailTrimmed !== '' && phoneCode.trim().length > 0 && !loading
  const canResendPhone = emailTrimmed !== '' && !loading

  const finalizeIfComplete = (nextEmailVerified: boolean, nextPhoneVerified: boolean) => {
    if (nextEmailVerified && nextPhoneVerified) {
      setMessage("Email + phone verified. You're in line-we'll email your invite when your wave opens.")
    }
  }

  const handleVerifyEmail = async (event: FormEvent) => {
    event.preventDefault()
    if (!canVerifyEmail) return
    setLoading('email-verify')
    setError(null)
    setMessage(null)
    try {
      await apiFetch<VerifyResponse>('/marketing/waitlist/verify', {
        method: 'POST',
        body: JSON.stringify({ email: emailTrimmed, code: emailCode.trim() }),
      })
      setEmailVerified(true)
      setMessage('Email verified. Now confirm the 6-digit code we texted your phone.')
      finalizeIfComplete(true, phoneVerified)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Unable to verify that code. Please try again.'
      setError(message)
    } finally {
      setLoading(null)
    }
  }

  const handleResendEmail = async () => {
    if (!canResendEmail) return
    setLoading('email-resend')
    setError(null)
    setMessage(null)
    try {
      const res = await apiFetch<ResendResponse>('/marketing/waitlist/resend', {
        method: 'POST',
        body: JSON.stringify({ email: emailTrimmed }),
      })
      if (res?.status === 'verified') {
        setEmailVerified(true)
        setMessage('Email is already verified for the waitlist.')
        finalizeIfComplete(true, phoneVerified)
      } else {
        setMessage('Email code sent. Check your inbox for a 6-digit code.')
      }
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Unable to resend a code right now. Please try again shortly.'
      setError(message)
    } finally {
      setLoading(null)
    }
  }

  const handleVerifyPhone = async (event: FormEvent) => {
    event.preventDefault()
    if (!canVerifyPhone) return
    setLoading('phone-verify')
    setError(null)
    setMessage(null)
    try {
      await apiFetch<VerifyResponse>('/marketing/waitlist/verify-phone/confirm', {
        method: 'POST',
        body: JSON.stringify({ email: emailTrimmed, code: phoneCode.trim() }),
      })
      setPhoneVerified(true)
      setMessage('Phone verified.')
      finalizeIfComplete(emailVerified, true)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Unable to verify that SMS code. Please try again.'
      setError(message)
    } finally {
      setLoading(null)
    }
  }

  const handleResendPhone = async () => {
    if (!canResendPhone) return
    setLoading('phone-resend')
    setError(null)
    setMessage(null)
    try {
      const res = await apiFetch<ResendResponse>('/marketing/waitlist/verify-phone', {
        method: 'POST',
        body: JSON.stringify({ email: emailTrimmed }),
      })
      if (res?.status === 'verified') {
        setPhoneVerified(true)
        setMessage('Phone is already verified for the waitlist.')
        finalizeIfComplete(emailVerified, true)
      } else {
        setMessage('SMS code sent. Check your phone for a 6-digit code.')
      }
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Unable to resend an SMS code right now. Please try again shortly.'
      setError(message)
    } finally {
      setLoading(null)
    }
  }

  return (
    <AuthShell
      title="Verify your email + phone"
      subtitle="Enter the 6-digit codes we sent to your work email and phone to lock your spot in the next cohort."
      badge="Waitlist verification"
      footer={
        <div className="form-links">
          <Link href="/">Back to landing</Link>
          <Link href="/auth/login">Sign in</Link>
        </div>
      }
    >
      <div className="form-grid">
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
          <span>Email verification code</span>
          <input
            name="emailCode"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            value={emailCode}
            onChange={(e) => setEmailCode(e.target.value)}
            required
          />
          <small className="microcopy">Codes expire quickly. If yours expired, resend a new one.</small>
        </label>

        <div className="form-links">
          <button className="btn primary" type="button" onClick={(e) => handleVerifyEmail(e as any)} disabled={!canVerifyEmail}>
            {loading === 'email-verify' ? 'Verifying...' : emailVerified ? 'Email verified' : 'Verify email'}
          </button>
          <button className="btn secondary" type="button" onClick={handleResendEmail} disabled={!canResendEmail}>
            {loading === 'email-resend' ? 'Sending...' : 'Resend email code'}
          </button>
        </div>

        <label>
          <span>SMS verification code</span>
          <input
            name="phoneCode"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            value={phoneCode}
            onChange={(e) => setPhoneCode(e.target.value)}
            required
          />
          <small className="microcopy">Use the 6-digit code we texted to your phone.</small>
        </label>

        <div className="form-links">
          <button className="btn primary" type="button" onClick={(e) => handleVerifyPhone(e as any)} disabled={!canVerifyPhone}>
            {loading === 'phone-verify' ? 'Verifying...' : phoneVerified ? 'Phone verified' : 'Verify phone'}
          </button>
          <button className="btn secondary" type="button" onClick={handleResendPhone} disabled={!canResendPhone}>
            {loading === 'phone-resend' ? 'Sending...' : 'Resend SMS code'}
          </button>
        </div>

        {message && <div className={(emailVerified && phoneVerified) ? 'feedback success' : 'feedback subtle'}>{message}</div>}
        {error && <div className="feedback error">{error}</div>}
      </div>
    </AuthShell>
  )
}
