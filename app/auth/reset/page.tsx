'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, Suspense, useMemo, useState } from 'react'
import AuthShell from '../../components/AuthShell'
import { ApiError, apiFetch } from '../../lib/api'

export const dynamic = 'force-dynamic'

function ResetForm() {
  const router = useRouter()
  const token = useMemo(() => {
    if (typeof window === 'undefined') return ''
    return new URLSearchParams(window.location.search).get('token') || ''
  }, [])

  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setSuccess(false)
    setLoading(true)
    try {
      await apiFetch('/auth/reset', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      })
      setSuccess(true)
      setTimeout(() => router.push('/auth/login'), 1200)
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Unable to reset your password. Please try again.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const disabled = !token

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Create a strong password to regain access. The link expires quickly for security."
      badge="Secure reset"
    >
      <form className="form-grid" onSubmit={handleSubmit}>
        {!token && (
          <div className="feedback error">
            This reset link is missing or invalid. Please request a new one from the forgot password page.
          </div>
        )}
        <label>
          <span>New password</span>
          <input
            name="newPassword"
            type="password"
            autoComplete="new-password"
            placeholder="********"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <small className="microcopy">Use 8+ chars with uppercase, lowercase, number, and symbol.</small>
        </label>
        {success && <div className="feedback success">Password updated. Redirecting...</div>}
        {error && <div className="feedback error">{error}</div>}
        <button className="btn primary" type="submit" disabled={loading || disabled}>
          {loading ? 'Updating...' : 'Update password'}
        </button>
        <div className="form-links">
          <Link href="/auth/login">Back to sign in</Link>
          <Link href="/auth/forgot">Send a new reset link</Link>
        </div>
      </form>
    </AuthShell>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="auth-shell">
          <div className="glass-card">Loading reset flow...</div>
        </div>
      }
    >
      <ResetForm />
    </Suspense>
  )
}
