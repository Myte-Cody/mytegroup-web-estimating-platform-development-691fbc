'use client'

import { useEffect, useState } from 'react'
import { ApiError, apiFetch } from '../../lib/api'

type SessionUser = {
  id?: string
  email?: string
  role?: string
  orgId?: string
}

export default function DashboardPage() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiFetch<{ user?: SessionUser }>('/auth/me')
        setUser(res?.user || null)
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          setError('You need to sign in to access the workspace.')
          return
        }
        setError(err instanceof ApiError ? err.message : 'Unable to load your workspace.')
      }
    }
    load()
  }, [])

  return (
    <section className="dashboard-grid">
      <section className="glass-card">
        <div className="badge">Protected area</div>
        <h1>Workspace</h1>
        <p className="subtitle">
          {user
            ? 'You are signed in. Explore projects, invites, and compliance tasks.'
            : 'Checking your session...'}
        </p>
        {error && <div className="feedback error">{error}</div>}
        {user && (
          <div className="info-grid">
            <div className="info-block">
              <div className="muted">User</div>
              <div className="stat-value">{user.email || user.id}</div>
            </div>
            <div className="info-block">
              <div className="muted">Role</div>
              <div className="stat-value">{user.role || 'User'}</div>
            </div>
            <div className="info-block">
              <div className="muted">Org</div>
              <div className="stat-value">{user.orgId || 'Scoped'}</div>
            </div>
          </div>
        )}
      </section>
    </section>
  )
}

