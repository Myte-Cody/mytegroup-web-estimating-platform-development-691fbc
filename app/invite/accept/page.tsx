'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, Suspense, useMemo, useState } from 'react'

import AuthShell from '../../components/AuthShell'
import { ApiError, apiFetch } from '../../lib/api'

export const dynamic = 'force-dynamic'

type AcceptInviteResponse = {
  user?: {
    email?: string
  }
}

function InviteAcceptForm() {
  const router = useRouter()
  const token = useMemo(() => {
    if (typeof window === 'undefined') return ''
    return new URLSearchParams(window.location.search).get('token') || ''
  }, [])

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const disabled = !token

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (disabled) return
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch<AcceptInviteResponse>('/invites/accept', {
        method: 'POST',
        body: JSON.stringify({
          token,
          username: username.trim(),
          password,
        }),
      })

      // Best-effort: log the user in immediately so they land in the right workspace flow.
      const email = res?.user?.email
      if (email) {
        const loginRes = await apiFetch<{ legalRequired?: boolean }>('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        })
        if (loginRes?.legalRequired) {
          router.push('/legal')
          return
        }
      }

      setSuccess(true)
      setTimeout(() => router.push('/auth'), 700)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Unable to accept this invite. Please try again.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Accept your invite"
      subtitle="Create your password to join the organization. This link expires for security."
      badge="Team invite"
      footer={
        <div className="form-links">
          <Link href="/auth/login">Sign in</Link>
          <Link href="/">Back to landing</Link>
        </div>
      }
    >
      <form className="form-grid" onSubmit={handleSubmit}>
        {!token && (
          <div className="feedback error">
            This invite link is missing or invalid. Please request a new invite from your org admin.
          </div>
        )}

        <label>
          <span>Display name</span>
          <input
            name="username"
            placeholder="Crew Lead"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
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

        {success && <div className="feedback success">Invite accepted. Routing you into the workspace…</div>}
        {error && <div className="feedback error">{error}</div>}

        <button className="btn primary" type="submit" disabled={loading || disabled}>
          {loading ? 'Accepting…' : 'Accept invite'}
        </button>
      </form>
    </AuthShell>
  )
}

export default function InviteAcceptPage() {
  return (
    <Suspense fallback={<div className="auth-shell">Loading invite…</div>}>
      <InviteAcceptForm />
    </Suspense>
  )
}
