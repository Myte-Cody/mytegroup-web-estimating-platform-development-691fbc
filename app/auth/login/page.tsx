'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'
import AuthShell from '../../components/AuthShell'
import { ApiError, apiFetch } from '../../lib/api'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await apiFetch<{ legalRequired?: boolean }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      if (res?.legalRequired) {
        router.push('/legal')
      } else {
        router.push('/auth')
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Unable to sign in. Please try again.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to continue to your projects and shared workspaces."
      badge="Secure session + audit"
    >
      <form className="form-grid" onSubmit={handleSubmit}>
        <label>
          <span>Email</span>
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
            autoComplete="current-password"
            placeholder="********"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <div className="feedback error">{error}</div>}
        <button className="btn primary" type="submit" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
        <div className="form-links">
          <Link href="/auth/forgot">Forgot password?</Link>
          <Link href="/auth/register">Create an account</Link>
        </div>
      </form>
    </AuthShell>
  )
}
