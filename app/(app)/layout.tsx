'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { ApiError, apiFetch } from '../lib/api'
import { cn } from '../lib/utils'

type SessionUser = {
  id?: string
  email?: string
  role?: string
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiFetch<{ user?: SessionUser }>('/auth/me')
        setUser(res?.user || null)
      } catch (err: any) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          setUser(null)
          return
        }
        setError(err instanceof ApiError ? err.message : 'Unable to load your session.')
      }
    }
    load()
  }, [])

  const isAdmin = user?.role === 'superadmin' || user?.role === 'platform_admin'

  return (
    <>
      <header className="app-header">
        <div className="app-header-inner">
          <Link href="/dashboard" className="app-header-brand">
            <span className="app-header-logo">MYTE Construction OS</span>
            <span className="app-header-subtitle">Workspace</span>
          </Link>
          <nav className="app-header-nav" aria-label="Workspace navigation">
            <Link href="/dashboard" className="app-header-link">
              Dashboard
            </Link>
            <Link href="/dashboard/waitlist" className="app-header-link">
              Waitlist
            </Link>
            {isAdmin && (
              <Link href="/admin/inquiries" className="app-header-link">
                Inquiries
              </Link>
            )}
          </nav>
          <div className="app-header-user">
            {user ? (
              <>
                <span className="app-header-user-email">{user.email}</span>
                <span className="app-header-user-role">{user.role}</span>
              </>
            ) : (
              <Link href="/auth/login" className="app-header-link">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>
      <main id="main-content" className="app-main">
        {error && (
          <div className={cn('feedback error mb-4')}>
            {error}
          </div>
        )}
        {children}
      </main>
    </>
  )
}

