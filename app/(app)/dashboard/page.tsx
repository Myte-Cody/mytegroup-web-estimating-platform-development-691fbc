'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ApiError, apiFetch } from '../../lib/api'
import { cn } from '../../lib/utils'

type SessionUser = {
  id?: string
  role?: string
  roles?: string[]
  orgId?: string
  isOrgOwner?: boolean
}

type Organization = {
  _id?: string
  id?: string
  name: string
  primaryDomain?: string | null
  archivedAt?: string | null
  piiStripped: boolean
  legalHold: boolean
  datastoreType?: 'shared' | 'dedicated'
  useDedicatedDb?: boolean
  databaseName?: string | null
  dataResidency?: string | null
  createdAt?: string
  updatedAt?: string
}

type OrganizationsListResponse = {
  data: Organization[]
  total: number
  page: number
  limit: number
}

type UserRecord = {
  _id?: string
  id?: string
  email?: string
  username?: string
  role?: string
  roles?: string[]
  organizationId?: string
  archivedAt?: string | null
  piiStripped?: boolean
  legalHold?: boolean
  createdAt?: string
  updatedAt?: string
}

type Invite = {
  _id?: string
  id?: string
  email: string
  role: string
  status: string
  tokenExpires?: string
  createdAt?: string
  acceptedAt?: string | null
}

type EventLog = {
  _id?: string
  eventType: string
  action?: string
  entity?: string
  entityType?: string
  entityId?: string
  actor?: string
  createdAt: string
  redacted?: boolean
}

type EventsListResponse = {
  data: EventLog[]
  total: number
  nextCursor?: string
}

const FULL_DASHBOARD_ROLES = ['org_owner', 'org_admin', 'admin', 'superadmin', 'platform_admin']
const ROLE_ORDER = [
  'org_owner',
  'org_admin',
  'admin',
  'manager',
  'pm',
  'estimator',
  'engineer',
  'detailer',
  'foreman',
  'superintendent',
  'qaqc',
  'hs',
  'purchasing',
  'finance',
  'compliance_officer',
  'security_officer',
  'compliance',
  'security',
  'viewer',
  'user',
]

const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Super Admin',
  platform_admin: 'Platform Admin',
  org_owner: 'Org Owner',
  org_admin: 'Org Admin',
  admin: 'Admin',
  manager: 'Manager',
  pm: 'PM',
  estimator: 'Estimator',
  engineer: 'Engineer',
  detailer: 'Detailer',
  transporter: 'Transporter',
  foreman: 'Foreman',
  superintendent: 'Superintendent',
  qaqc: 'QA/QC',
  hs: 'Health & Safety',
  purchasing: 'Purchasing',
  finance: 'Finance',
  compliance_officer: 'Compliance Officer',
  security_officer: 'Security Officer',
  compliance: 'Compliance',
  security: 'Security',
  viewer: 'Viewer',
  user: 'User',
}

const labelForRole = (role: string) => {
  const normalized = (role || '').trim()
  if (!normalized) return 'User'
  const known = ROLE_LABELS[normalized]
  if (known) return known
  return normalized
    .split('_')
    .filter(Boolean)
    .map((word) => word.slice(0, 1).toUpperCase() + word.slice(1))
    .join(' ')
}

const formatTimestamp = (value?: string) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

export default function DashboardPage() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [org, setOrg] = useState<Organization | null>(null)
  const [orgChoices, setOrgChoices] = useState<Organization[]>([])
  const [needsOrgScope, setNeedsOrgScope] = useState(false)
  const [users, setUsers] = useState<UserRecord[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [events, setEvents] = useState<EventLog[]>([])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [auditError, setAuditError] = useState<string | null>(null)
  const [reloadAt, setReloadAt] = useState(0)

  const primaryRole = user?.role || 'user'
  const hasAdminDashboard = FULL_DASHBOARD_ROLES.includes(primaryRole)

  const userStats = useMemo(() => {
    const total = users.length
    const archived = users.filter((u) => !!u.archivedAt).length
    const active = total - archived
    return { total, active, archived }
  }, [users])

  const roleBreakdown = useMemo(() => {
    const counts = new Map<string, number>()
    users.forEach((u) => {
      const role = (u.role || 'user').trim() || 'user'
      counts.set(role, (counts.get(role) || 0) + 1)
    })

    return Array.from(counts.entries())
      .map(([role, count]) => ({ role, count }))
      .sort((a, b) => {
        const idxA = ROLE_ORDER.indexOf(a.role)
        const idxB = ROLE_ORDER.indexOf(b.role)
        const orderA = idxA === -1 ? Number.MAX_SAFE_INTEGER : idxA
        const orderB = idxB === -1 ? Number.MAX_SAFE_INTEGER : idxB
        if (orderA !== orderB) return orderA - orderB
        return a.role.localeCompare(b.role)
      })
  }, [users])

  const inviteStats = useMemo(() => {
    const pending = invites.filter((i) => i.status === 'pending').length
    const accepted = invites.filter((i) => i.status === 'accepted').length
    const expired = invites.filter((i) => i.status === 'expired').length
    return { total: invites.length, pending, accepted, expired }
  }, [invites])

  const refresh = () => setReloadAt(Date.now())

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        setAuditError(null)
        setOrg(null)
        setUsers([])
        setInvites([])
        setEvents([])

        const me = await apiFetch<{ user?: SessionUser }>('/auth/me')
        const currentUser = me?.user || null
        setUser(currentUser)

        if (!currentUser?.id) {
          setError('You need to sign in to access the workspace.')
          return
        }

        const role = currentUser.role || 'user'
        if (!FULL_DASHBOARD_ROLES.includes(role)) {
          return
        }

        if (!currentUser.orgId) {
          if (role === 'superadmin' || role === 'platform_admin') {
            setNeedsOrgScope(true)
            setOrg(null)
            setUsers([])
            setInvites([])
            setEvents([])
            try {
              const res = await apiFetch<OrganizationsListResponse>('/organizations?limit=50')
              setOrgChoices(Array.isArray(res?.data) ? res.data : [])
            } catch (err: any) {
              setError(err instanceof ApiError ? err.message : 'Unable to load organizations.')
            }
            return
          }
          setError('Your session is missing an organization scope. Ask a platform admin to assign you to an org.')
          return
        }

        setNeedsOrgScope(false)
        setOrgChoices([])

        const orgId = currentUser.orgId
        const fetches: Array<Promise<any>> = [
          apiFetch<Organization>(`/organizations/${orgId}`),
          apiFetch<UserRecord[]>('/users?includeArchived=1'),
          apiFetch<Invite[]>('/invites'),
        ]

        const includeAudit = role !== 'org_owner'
        if (includeAudit) {
          fetches.push(apiFetch<EventsListResponse>('/events?limit=5&sort=desc'))
        }

        const results = await Promise.allSettled(fetches)

        const orgRes = results[0]
        const usersRes = results[1]
        const invitesRes = results[2]
        const eventsRes = includeAudit ? results[3] : null

        if (orgRes.status === 'fulfilled') {
          setOrg(orgRes.value || null)
        } else {
          const err = orgRes.reason
          const msg = err instanceof ApiError ? err.message : 'Unable to load organization details.'
          setError(msg)
        }

        if (usersRes.status === 'fulfilled') {
          setUsers(Array.isArray(usersRes.value) ? usersRes.value : [])
        } else {
          const err = usersRes.reason
          const msg = err instanceof ApiError ? err.message : 'Unable to load users.'
          setError((prev) => prev || msg)
        }

        if (invitesRes.status === 'fulfilled') {
          setInvites(Array.isArray(invitesRes.value) ? invitesRes.value : [])
        } else {
          const err = invitesRes.reason
          const msg = err instanceof ApiError ? err.message : 'Unable to load invites.'
          setError((prev) => prev || msg)
        }

        if (eventsRes) {
          if (eventsRes.status === 'fulfilled') {
            setEvents(Array.isArray(eventsRes.value?.data) ? eventsRes.value.data : [])
          } else {
            const err = eventsRes.reason
            const msg = err instanceof ApiError ? err.message : 'Unable to load audit events.'
            setAuditError(msg)
          }
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          setError('You need to sign in to access the workspace.')
          return
        }
        setError(err instanceof ApiError ? err.message : 'Unable to load your workspace.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [reloadAt])

  const orgId = org?.id || org?._id || user?.orgId || undefined
  const orgName = org?.name || 'Workspace'
  const orgArchivedAt = org?.archivedAt || null
  const orgLegalHold = !!org?.legalHold
  const orgPiiStripped = !!org?.piiStripped

  return (
    <section className="dashboard-grid">
      <section className="glass-card space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="badge">{hasAdminDashboard ? labelForRole(primaryRole) : 'Workspace'}</div>
            <h1>{orgName}</h1>
            <p className="subtitle">
              {hasAdminDashboard
                ? 'Organization overview: compliance flags, team stats, and recent activity.'
                : 'Welcome. Your role does not include admin access, but your session is active.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button className="btn secondary" type="button" onClick={refresh} disabled={loading}>
              {loading ? 'Loading.' : 'Refresh'}
            </button>
          </div>
        </div>

      {error && <div className="feedback error">{error}</div>}

        {needsOrgScope && (
          <div className="glass-card space-y-3">
            <h2>Select an organization</h2>
            <p className="muted">
              Your session has platform access but no active workspace org selected. Choose an organization to enter its
              workspace context.
            </p>

            {orgChoices.length === 0 ? (
              <div className="muted">No organizations found. Create one in the Platform Admin view.</div>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {orgChoices.map((choice) => {
                  const id = choice.id || choice._id || ''
                  return (
                    <button
                      key={id}
                      type="button"
                      className="btn secondary justify-between"
                      disabled={loading || !id}
                      onClick={async () => {
                        if (!id) return
                        setLoading(true)
                        setError(null)
                        try {
                          const res = await apiFetch<{ user?: SessionUser }>('/auth/set-org', {
                            method: 'POST',
                            body: JSON.stringify({ orgId: id }),
                          })
                          setUser(res?.user || null)
                          setNeedsOrgScope(false)
                          setOrgChoices([])
                          refresh()
                        } catch (err: any) {
                          setError(err instanceof ApiError ? err.message : 'Unable to set organization scope.')
                        } finally {
                          setLoading(false)
                        }
                      }}
                    >
                      <span className="text-left">
                        <div className="font-semibold">{choice.name}</div>
                        <div className="muted text-xs">{id}</div>
                      </span>
                      <span className="text-sm">Use</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {hasAdminDashboard && orgLegalHold && (
          <div className="feedback error">
            Legal hold is enabled for this organization. Destructive actions are blocked and event retention is
            preserved until the hold is lifted.
          </div>
        )}

        {hasAdminDashboard && orgArchivedAt && (
          <div className="feedback error">
            This organization is archived (since {formatTimestamp(orgArchivedAt)}). Access may be limited. Contact a
            platform admin if you need it restored.
          </div>
        )}

        {hasAdminDashboard && orgPiiStripped && (
          <div className="feedback subtle">
            PII stripping is enabled. Some event payloads and metadata may be redacted.
          </div>
        )}

        <div className="info-grid">
          <div className="info-block">
            <div className="muted">Role</div>
            <div className="stat-value">{labelForRole(primaryRole)}</div>
          </div>
          <div className="info-block">
            <div className="muted">Org ID</div>
            <div className="stat-value">{orgId || '-'}</div>
          </div>
          <div className="info-block">
            <div className="muted">Team</div>
            <div className="stat-value">{hasAdminDashboard ? `${userStats.active} active` : '-'}</div>
          </div>
          <div className="info-block">
            <div className="muted">Pending invites</div>
            <div className="stat-value">{hasAdminDashboard ? inviteStats.pending : '-'}</div>
          </div>
          {hasAdminDashboard && (
            <>
              <div className="info-block">
                <div className="muted">Legal hold</div>
                <div className="stat-value">{org ? (orgLegalHold ? 'On' : 'Off') : '-'}</div>
              </div>
              <div className="info-block">
                <div className="muted">PII stripped</div>
                <div className="stat-value">{org ? (orgPiiStripped ? 'Yes' : 'No') : '-'}</div>
              </div>
              <div className="info-block">
                <div className="muted">Archived</div>
                <div className="stat-value">{org ? (orgArchivedAt ? formatTimestamp(orgArchivedAt) : 'No') : '-'}</div>
              </div>
            </>
          )}
        </div>

        {hasAdminDashboard ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-border/60 bg-white/5 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-[color:var(--text)]">Team summary</div>
                  <div className="text-sm text-muted-foreground">
                    {userStats.total} total {'\u00b7'} {userStats.active} active {'\u00b7'} {userStats.archived} archived
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href="/dashboard/projects" className="btn secondary">
                    View projects
                  </Link>
                  <Link href="/dashboard/users" className="btn secondary">
                    Manage users
                  </Link>
                  <Link href="/dashboard/invites" className="btn secondary">
                    Manage invites
                  </Link>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-border/60 bg-[color:var(--panel)]">
                <table className="min-w-full text-left text-xs sm:text-sm">
                  <thead className="border-b border-border/60 bg-[color:var(--panel-strong)] text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2">Role</th>
                      <th className="px-4 py-2 text-right">Users</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roleBreakdown.map((row) => (
                      <tr key={row.role} className="border-b border-border/40 last:border-none">
                        <td className="px-4 py-2 font-semibold text-[color:var(--text)]">{labelForRole(row.role)}</td>
                        <td className="px-4 py-2 text-right text-muted-foreground">{row.count}</td>
                      </tr>
                    ))}
                    {roleBreakdown.length === 0 && (
                      <tr>
                        <td className="px-4 py-6 text-center text-muted-foreground" colSpan={2}>
                          No users found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-white/5 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[color:var(--text)]">Recent audit events</div>
                  <div className="text-sm text-muted-foreground">Latest {events.length || 0} events in this org scope.</div>
                </div>
                {auditError && <span className="text-xs text-muted-foreground">Restricted</span>}
              </div>

              {primaryRole === 'org_owner' ? (
                <div className="feedback subtle">Audit logs require an Admin / Compliance / Security role.</div>
              ) : auditError ? (
                <div className="feedback subtle">{auditError}</div>
              ) : events.length ? (
                <div className="space-y-2">
                  {events.map((ev) => {
                    const action = ev.action || ev.eventType?.split('.').pop() || ev.eventType
                    return (
                      <div
                        key={ev._id || `${ev.eventType}-${ev.createdAt}`}
                        className={cn('rounded-2xl border border-border/60 bg-[color:var(--panel)] px-4 py-3')}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-semibold text-[color:var(--text)] truncate">{ev.eventType}</div>
                            <div className="text-xs text-muted-foreground">
                              Action: {action} {'\u00b7'} Actor: {ev.actor || '-'}
                            </div>
                            {(ev.entityType || ev.entity || ev.entityId) && (
                              <div className="text-xs text-muted-foreground">
                                Entity: {ev.entityType || ev.entity || '-'} {ev.entityId ? `\u00b7 ${ev.entityId}` : ''}
                                {ev.redacted ? ' · redacted' : ''}
                              </div>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground whitespace-nowrap">{formatTimestamp(ev.createdAt)}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No recent events found.</div>
              )}
            </div>
          </div>
        ) : (
          <div className="feedback subtle">
            Need access to users, invites, or compliance views? Ask an Org Admin to upgrade your role.
          </div>
        )}
      </section>
    </section>
  )
}
