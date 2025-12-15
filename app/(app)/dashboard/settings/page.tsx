'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import { ApiError, apiFetch } from '../../../lib/api'
import { hasAnyRole } from '../../../lib/rbac'
import { cn } from '../../../lib/utils'

type SessionUser = {
  id?: string
  role?: string
  roles?: string[]
  orgId?: string
}

type SettingsCard = {
  title: string
  description: string
  href?: string
  disabled?: boolean
}

export default function SettingsHubPage() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canView = useMemo(() => hasAnyRole(user, ['admin']), [user])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const me = await apiFetch<{ user?: SessionUser }>('/auth/me')
        setUser(me?.user || null)
      } catch (err: any) {
        if (err instanceof ApiError && err.status === 401) {
          setError('You need to sign in to view settings.')
          return
        }
        setError(err instanceof ApiError ? err.message : 'Unable to load session.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const cards: SettingsCard[] = [
    {
      title: 'People',
      description: 'Staff directory, ironworkers, external contacts, and invites.',
      href: '/dashboard/settings/people',
    },
    {
      title: 'Offices',
      description: 'Internal offices and divisions for your organization.',
      href: '/dashboard/settings/offices',
    },
    {
      title: 'Seats',
      description: 'Seat usage, limits, and allocations.',
      href: '/dashboard/settings/seats',
    },
    {
      title: 'Cost Codes',
      description: 'Org-level cost codes used for timesheets (coming soon).',
      disabled: true,
    },
    {
      title: 'Companies',
      description: 'External companies directory (from People contacts).',
      href: '/dashboard/settings/companies',
    },
  ]

  return (
    <section className="space-y-6">
      <div className="glass-card space-y-2">
        <div className="badge">Org Settings</div>
        <h1>Settings</h1>
        <p className="subtitle">Organization configuration and foundational directories.</p>
        {loading && <div className="feedback subtle">Loading…</div>}
        {error && <div className={cn('feedback error')}>{error}</div>}
        {user?.id && !canView && (
          <div className={cn('feedback error')}>Org admin access required to view settings.</div>
        )}
      </div>

      {canView && (
        <div className="grid gap-4 md:grid-cols-2">
          {cards.map((card) => {
            const content = (
              <div className={cn('glass-card space-y-2', card.disabled && 'opacity-60')}>
                <h2 className="text-lg font-semibold">{card.title}</h2>
                <p className="subtitle">{card.description}</p>
                {card.disabled ? (
                  <div className="muted">Coming soon</div>
                ) : (
                  <div className="muted">Open</div>
                )}
              </div>
            )

            if (!card.href || card.disabled) return <div key={card.title}>{content}</div>
            return (
              <Link key={card.title} href={card.href} className="block">
                {content}
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )
}
