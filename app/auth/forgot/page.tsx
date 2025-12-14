'use client'

import Link from 'next/link'
import { useState, FormEvent } from 'react'
import AuthShell from '../../components/AuthShell'
import { ApiError, apiFetch } from '../../lib/api'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await apiFetch('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })
      setSent(true)
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Unable to send reset instructions. Please try again shortly.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Forgot your password?"
      subtitle="Send a secure reset link to your work email. The link expires quickly for your safety."
      badge="Account recovery"
    >
      <form className="form-grid" onSubmit={handleSubmit}>
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
        {sent && <div className="feedback success">If that email exists, a reset link is on its way.</div>}
        {error && <div className="feedback error">{error}</div>}
        <button className="btn primary" type="submit" disabled={loading}>
          {loading ? 'Sending...' : 'Send reset link'}
        </button>
        <div className="form-links">
          <Link href="/auth/login">Back to sign in</Link>
          <Link href="/#cta">Request early access</Link>
        </div>
      </form>
    </AuthShell>
  )
}
