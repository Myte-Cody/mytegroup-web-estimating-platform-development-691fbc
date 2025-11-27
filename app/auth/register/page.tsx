'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'
import AuthShell from '../../components/AuthShell'
import { ApiError, apiFetch } from '../../lib/api'

export default function RegisterPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await apiFetch<{ legalRequired?: string[] }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          username,
          email,
          password,
          organizationName: organizationName || undefined,
        }),
      })
      if (res?.legalRequired?.length) {
        router.push('/legal')
      } else {
        router.push('/dashboard')
      }
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Unable to create your account right now. Please try again.'
      setError(message)
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
          <span>Name</span>
          <input
            name="username"
            placeholder="Avery Builder"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
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
        <button className="btn primary" type="submit" disabled={loading}>
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
