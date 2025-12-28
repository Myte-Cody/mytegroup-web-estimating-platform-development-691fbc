'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import LanguageToggle from '../components/LanguageToggle'
import ThemeToggle from '../components/ThemeToggle'
import { ApiError, apiFetch } from '../lib/api'
import { useLanguage } from '../lib/i18n'
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
  labelKey: string
  roles?: string[]
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', labelKey: 'nav.dashboard' },
  { href: '/dashboard/projects', labelKey: 'nav.projects', roles: ['viewer'] },
  { href: '/dashboard/org-locations', labelKey: 'nav.org_locations', roles: ['viewer'] },
  { href: '/dashboard/settings/people', labelKey: 'nav.people', roles: ['admin'] },
  { href: '/dashboard/settings', labelKey: 'nav.settings', roles: ['admin'] },
  { href: '/dashboard/users', labelKey: 'nav.users', roles: ['admin'] },
  { href: '/dashboard/invites', labelKey: 'nav.invites', roles: ['admin'] },
  { href: '/dashboard/notifications', labelKey: 'nav.notifications' },
  { href: '/dashboard/settings/graph-edges', labelKey: 'nav.graph', roles: ['admin'] },
]

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { t } = useLanguage()
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
  const showPlatformBridge = user?.role === 'platform_admin'

  return (
    <div className="workspace-root">
      <div className="workspace-brand-chip" onClick={() => router.push('/dashboard')}>
        <span className="workspace-brand-logo">MYTE</span>
        <span className="workspace-brand-text">Construction OS</span>
      </div>

      <div className="workspace-utility">
        <LanguageToggle />
        <ThemeToggle floating={false} />
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
            {t('nav.close')}
          </button>
          <div className="workspace-org">
            <div className="workspace-org-logo">MY</div>
            {!drawerCollapsed && (
              <div className="workspace-org-meta">
                <div className="workspace-org-name">{t('nav.workspace')}</div>
                {user?.orgId && <div className="workspace-org-id">{t('nav.org_id', { id: user.orgId })}</div>}
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
              {!drawerCollapsed && <span>{t(item.labelKey)}</span>}
            </button>
          ))}
        </nav>

        <div className="workspace-user">
          {showPlatformBridge && (
            <>
              <div className="workspace-divider" />
              <button
                type="button"
                className="workspace-nav-item workspace-bridge"
                onClick={() => {
                  router.push('/platform')
                  setDrawerOpenMobile(false)
                }}
              >
                <span className="workspace-nav-dot" />
                {!drawerCollapsed && <span>{t('nav.platform_admin')}</span>}
              </button>
            </>
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
                {!drawerCollapsed ? t('nav.sign_out') : 'Out'}
              </button>
            </>
          ) : (
            <Link href="/auth/login" className="workspace-signin-link">
              {t('nav.sign_in')}
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
        {t('nav.menu')}
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
