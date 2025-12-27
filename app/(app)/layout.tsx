'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import { ApiError, apiFetch } from '../lib/api'
import { hasAnyRole } from '../lib/rbac'
import { cn } from '../lib/utils'

type SessionUser = {
  id?: string
  email?: string
  role?: string
  roles?: string[]
  orgId?: string
}

type NavItem = {
  href: string
  label: string
  roles?: string[]
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/dashboard/projects', label: 'Projects', roles: ['viewer'] },
  { href: '/dashboard/org-locations', label: 'Org locations', roles: ['viewer'] },
  { href: '/dashboard/settings/people', label: 'People', roles: ['admin'] },
  { href: '/dashboard/settings', label: 'Settings', roles: ['admin'] },
  { href: '/dashboard/users', label: 'Users', roles: ['admin'] },
  { href: '/dashboard/invites', label: 'Invites', roles: ['admin'] },
  { href: '/dashboard/settings/graph-edges', label: 'Graph', roles: ['admin'] },
]

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [user, setUser] = useState<SessionUser | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [drawerCollapsed, setDrawerCollapsed] = useState(false)
  const [drawerOpenMobile, setDrawerOpenMobile] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiFetch<{ user?: SessionUser }>('/auth/me')
        const currentUser = res?.user || null
        if (!currentUser?.id) {
          router.replace('/auth/login')
          return
        }
        setUser(currentUser)
      } catch (err: any) {
        if (err instanceof ApiError && err.status === 401) {
          router.replace('/auth/login')
          return
        }
        if (err instanceof ApiError && err.status === 403 && err.message?.includes('Legal acceptance required')) {
          router.replace('/legal')
          return
        }
        setError(err instanceof ApiError ? err.message : 'Unable to load your session.')
      }
    }
    load()
  }, [router])

  const primaryRole = user?.role || 'user'

  const visibleNavItems = useMemo(() => {
    return NAV_ITEMS.filter((item) => {
      return hasAnyRole(user, item.roles)
    })
  }, [user])
  const showPlatformBridge = hasAnyRole(user, ['platform_admin'])

  return (
    <div className="workspace-root">
      <div className="workspace-brand-chip" onClick={() => router.push('/dashboard')}>
        <span className="workspace-brand-logo">MYTE</span>
        <span className="workspace-brand-text">Construction OS</span>
      </div>

      <aside
        className={cn(
          'workspace-drawer',
          drawerCollapsed && 'workspace-drawer-collapsed',
          drawerOpenMobile && 'workspace-drawer-mobile-open'
        )}
      >
        <div className="workspace-drawer-header">
          <button
            type="button"
            className="workspace-drawer-toggle md:hidden"
            onClick={() => setDrawerOpenMobile(false)}
            aria-label="Close navigation"
          >
            ✕
          </button>
          <div className="workspace-org">
            <div className="workspace-org-logo">🏗</div>
            {!drawerCollapsed && (
              <div className="workspace-org-meta">
                <div className="workspace-org-name">Workspace</div>
                {user?.orgId && <div className="workspace-org-id">Org {user.orgId}</div>}
              </div>
            )}
          </div>
        </div>

        <nav className="workspace-nav" aria-label="Workspace navigation">
          {visibleNavItems.map((item) => (
            <button
              key={item.href}
              type="button"
              className="workspace-nav-item"
              onClick={() => {
                router.push(item.href)
                setDrawerOpenMobile(false)
              }}
            >
              <span className="workspace-nav-dot" />
              {!drawerCollapsed && <span>{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="workspace-user">
          {showPlatformBridge && (
            <button
              type="button"
              className="workspace-nav-item workspace-bridge"
              onClick={() => {
                router.push('/platform')
                setDrawerOpenMobile(false)
              }}
            >
              <span className="workspace-nav-dot" />
              {!drawerCollapsed && <span>Platform Admin</span>}
            </button>
          )}
          {user ? (
            <>
              {!drawerCollapsed && (
                <div className="workspace-user-meta">
                  <div className="workspace-user-name">{user.email}</div>
                  <div className="workspace-user-role">{primaryRole}</div>
                </div>
              )}
              <button
                type="button"
                className="workspace-signout"
                onClick={async () => {
                  try {
                    await apiFetch('/auth/logout', { method: 'POST' })
                  } catch {
                    // ignore
                  }
                  router.replace('/auth/login')
                }}
              >
                {!drawerCollapsed ? 'Sign out' : '⎋'}
              </button>
            </>
          ) : (
            <Link href="/auth/login" className="workspace-signin-link">
              Sign in
            </Link>
          )}
        </div>

        <button
          type="button"
          className="workspace-collapse-toggle hidden md:flex"
          onClick={() => setDrawerCollapsed((prev) => !prev)}
          aria-label={drawerCollapsed ? 'Expand navigation' : 'Collapse navigation'}
        >
          {drawerCollapsed ? '›' : '‹'}
        </button>
      </aside>

      <button
        type="button"
        className="workspace-drawer-toggle workspace-drawer-toggle-floating md:hidden"
        onClick={() => setDrawerOpenMobile(true)}
        aria-label="Open navigation"
      >
        ☰
      </button>

      <main id="main-content" className="workspace-main">
        {error && (
          <div className={cn('feedback error mb-4')}>
            {error}
          </div>
        )}
        {children}
      </main>
    </div>
  )
}
