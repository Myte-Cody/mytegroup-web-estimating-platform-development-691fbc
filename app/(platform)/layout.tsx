'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import { ApiError, apiFetch } from '../lib/api'
import { cn } from '../lib/utils'

type SessionUser = {
  id?: string
  email?: string
  role?: string
}

type NavItem = {
  href: string
  label: string
}

const PLATFORM_ROLES = new Set(['superadmin', 'platform_admin'])

const NAV_ITEMS: NavItem[] = [
  { href: '/platform', label: 'Overview' },
  { href: '/platform/organizations', label: 'Organizations' },
  { href: '/platform/waitlist', label: 'Waitlist' },
  { href: '/platform/inquiries', label: 'Inquiries' },
]

export default function PlatformLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<SessionUser | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [drawerCollapsed, setDrawerCollapsed] = useState(false)
  const [drawerOpenMobile, setDrawerOpenMobile] = useState(false)

  const nextPath = useMemo(() => {
    const dest = pathname && pathname.startsWith('/platform') ? pathname : '/platform'
    return encodeURIComponent(dest)
  }, [pathname])

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiFetch<{ user?: SessionUser }>('/auth/me')
        const currentUser = res?.user || null
        if (!currentUser?.id) {
          router.replace(`/auth/login?next=${nextPath}`)
          return
        }

        const role = (currentUser.role || '').toLowerCase()
        if (!PLATFORM_ROLES.has(role)) {
          router.replace('/dashboard')
          return
        }

        setUser(currentUser)
      } catch (err: any) {
        if (err instanceof ApiError && err.status === 401) {
          router.replace(`/auth/login?next=${nextPath}`)
          return
        }
        if (err instanceof ApiError && err.status === 403 && err.message?.includes('Legal acceptance required')) {
          router.replace(`/legal?next=${nextPath}`)
          return
        }
        setError(err instanceof ApiError ? err.message : 'Unable to load your session.')
      }
    }
    load()
  }, [nextPath, router])

  return (
    <div className="workspace-root">
      <div className="workspace-brand-chip" onClick={() => router.push('/platform')}>
        <span className="workspace-brand-logo">MYTE</span>
        <span className="workspace-brand-text">Platform Ops</span>
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
            ×
          </button>
          <div className="workspace-org">
            <div className="workspace-org-logo">P</div>
            {!drawerCollapsed && (
              <div className="workspace-org-meta">
                <div className="workspace-org-name">Platform</div>
                <div className="workspace-org-id">Ops access only</div>
              </div>
            )}
          </div>
        </div>

        <nav className="workspace-nav" aria-label="Platform navigation">
          {NAV_ITEMS.map((item) => (
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
          <button
            type="button"
            className="workspace-nav-item"
            onClick={() => {
              router.push('/dashboard')
              setDrawerOpenMobile(false)
            }}
          >
            <span className="workspace-nav-dot" />
            {!drawerCollapsed && <span>Workspace</span>}
          </button>
        </nav>

        <div className="workspace-user">
          {user ? (
            <>
              {!drawerCollapsed && (
                <div className="workspace-user-meta">
                  <div className="workspace-user-name">{user.email}</div>
                  <div className="workspace-user-role">{user.role}</div>
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
            <Link href={`/auth/login?next=${nextPath}`} className="workspace-signin-link">
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
          {drawerCollapsed ? '>' : '<'}
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
        {error && <div className={cn('feedback error mb-4')}>{error}</div>}
        {children}
      </main>
    </div>
  )
}
