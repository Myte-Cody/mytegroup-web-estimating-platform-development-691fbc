'use client'

import Link from 'next/link'
import { Suspense, useEffect, useMemo, useState } from 'react'

import AuthShell from '../components/AuthShell'
import { ApiError, apiFetch } from '../lib/api'

export const dynamic = 'force-dynamic'

function VerifyEmailContent() {
  const token = useMemo(() => {
    if (typeof window === 'undefined') return ''
    return new URLSearchParams(window.location.search).get('token') || ''
  }, [])

  const [loading, setLoading] = useState(true)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      setError(null)
      setSuccess(false)
      if (!token) {
        setError('Missing verification token. Please use the link from your email.')
        setLoading(false)
        return
      }
      try {
        await apiFetch('/auth/verify-email', {
          method: 'POST',
          body: JSON.stringify({ token }),
        })
        setSuccess(true)
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : 'Unable to verify your email right now. Please try again.'
        setError(message)
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [token])

  return (
    <AuthShell
      title="Verify your email"
      subtitle="Confirming your email unlocks secure access to your organization."
      badge="Email verification"
      footer={
        <div className="form-links">
          <Link href="/auth/login">Sign in</Link>
          <Link href="/">Back to landing</Link>
        </div>
      }
    >
      {loading && <div className="feedback subtle">Verifying…</div>}
      {success && <div className="feedback success">Email verified. You can now sign in.</div>}
      {error && <div className="feedback error">{error}</div>}
    </AuthShell>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="auth-shell">Loading verification…</div>}>
      <VerifyEmailContent />
    </Suspense>
  )
}

