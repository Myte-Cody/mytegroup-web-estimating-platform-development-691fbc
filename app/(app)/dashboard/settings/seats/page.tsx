'use client'

import { useEffect, useMemo, useState } from 'react'

import { ApiError, apiFetch } from '../../../../lib/api'
import { hasAnyRole } from '../../../../lib/rbac'
import { cn } from '../../../../lib/utils'

type SessionUser = {
  id?: string
  role?: string
  roles?: string[]
  orgId?: string
}

type Seat = {
  _id?: string
  orgId: string
  seatNumber: number
  status: 'vacant' | 'active'
  userId?: string
  role?: string | null
  projectId?: string | null
  activatedAt?: string | null
  createdAt?: string
  updatedAt?: string
}

type SeatSummary = {
  orgId: string | null
  total: number
  active: number
  vacant: number
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

type UserRecord = {
  _id?: string
  id?: string
  email?: string
  role?: string
  roles?: string[]
  archivedAt?: string | null
}

type Project = {
  _id?: string
  id?: string
  name: string
  archivedAt?: string | null
}

type Organization = {
  _id?: string
  id?: string
  name?: string
  archivedAt?: string | null
  piiStripped?: boolean
  legalHold?: boolean
}

const formatDateTime = (value?: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

const formatRole = (value?: string | null) => {
  if (!value) return '-'
  return String(value).replace(/_/g, ' ')
}

export default function SeatsPage() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [org, setOrg] = useState<Organization | null>(null)
  const [summary, setSummary] = useState<SeatSummary | null>(null)
  const [seats, setSeats] = useState<Seat[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [users, setUsers] = useState<UserRecord[]>([])
  const [projects, setProjects] = useState<Project[]>([])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadAt, setReloadAt] = useState(0)
  const refresh = () => setReloadAt(Date.now())

  const canView = useMemo(() => hasAnyRole(user, ['admin']), [user])
  const orgLegalHold = !!org?.legalHold
  const orgArchived = !!org?.archivedAt
  const orgPiiStripped = !!org?.piiStripped

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      setSummary(null)
      setSeats([])
      setInvites([])
      setUsers([])
      setProjects([])
      try {
        const me = await apiFetch<{ user?: SessionUser }>('/auth/me')
        const currentUser = me?.user || null
        setUser(currentUser)
        setOrg(null)
        if (!currentUser?.id) {
          setError('You need to sign in to view seats.')
          return
        }
        if (!currentUser?.orgId) {
          setError('Your session is missing an organization scope. Ask Platform Ops to assign you to an org.')
          return
        }
        if (!hasAnyRole(currentUser, ['admin'])) {
          setError('Org admin access required to view seats.')
          return
        }

        const results = await Promise.allSettled([
          apiFetch<SeatSummary>('/seats/summary'),
          apiFetch<Seat[]>('/seats'),
          apiFetch<Invite[]>('/invites'),
          apiFetch<Organization>(`/organizations/${currentUser.orgId}`),
          apiFetch<Project[]>('/projects?includeArchived=1'),
          apiFetch<UserRecord[]>('/users?includeArchived=1'),
        ])

        const summaryRes = results[0]
        const seatsRes = results[1]
        const invitesRes = results[2]
        const orgRes = results[3]
        const projectsRes = results[4]
        const usersRes = results[5]

        if (summaryRes.status === 'fulfilled') {
          setSummary(summaryRes.value)
        } else {
          const err = summaryRes.reason
          setError(err instanceof ApiError ? err.message : 'Unable to load seat summary.')
        }

        if (seatsRes.status === 'fulfilled') {
          setSeats(Array.isArray(seatsRes.value) ? seatsRes.value : [])
        } else {
          const err = seatsRes.reason
          setError((prev) => prev || (err instanceof ApiError ? err.message : 'Unable to load seats.'))
        }

        if (invitesRes.status === 'fulfilled') {
          setInvites(Array.isArray(invitesRes.value) ? invitesRes.value : [])
        } else {
          const err = invitesRes.reason
          setError((prev) => prev || (err instanceof ApiError ? err.message : 'Unable to load invites.'))
        }

        if (orgRes.status === 'fulfilled') {
          setOrg(orgRes.value)
        } else {
          const err = orgRes.reason
          setError((prev) => prev || (err instanceof ApiError ? err.message : 'Unable to load organization.'))
        }

        if (projectsRes.status === 'fulfilled') {
          setProjects(Array.isArray(projectsRes.value) ? projectsRes.value : [])
        }

        if (usersRes.status === 'fulfilled') {
          setUsers(Array.isArray(usersRes.value) ? usersRes.value : [])
        }
      } catch (err: any) {
        setError(err instanceof ApiError ? err.message : 'Unable to load seats.')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [reloadAt])

  const pendingInvites = useMemo(() => invites.filter((i) => i.status === 'pending').length, [invites])

  const projectById = useMemo(() => {
    const map = new Map<string, Project>()
    projects.forEach((project) => {
      const id = project.id || project._id
      if (id) map.set(id, project)
    })
    return map
  }, [projects])

  const userById = useMemo(() => {
    const map = new Map<string, UserRecord>()
    users.forEach((record) => {
      const id = record.id || record._id
      if (id) map.set(id, record)
    })
    return map
  }, [users])

  return (
    <section className="space-y-6">
      <div className="glass-card space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="badge">Org Settings</div>
            <h1>Seats</h1>
            <p className="subtitle">Seats are allocated on invite acceptance. Pending invites do not consume seats.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button className="btn secondary" type="button" onClick={refresh} disabled={loading}>
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>
        </div>

        {error && <div className={cn('feedback error')}>{error}</div>}
        {orgLegalHold && (
          <div className="feedback subtle">
            Legal hold is enabled for this organization. Seat updates are blocked until the hold is lifted.
          </div>
        )}
        {orgArchived && <div className="feedback subtle">This organization is archived. Seat updates are blocked.</div>}
        {orgPiiStripped && (
          <div className="feedback subtle">PII stripped is enabled for this organization. Some fields may be redacted.</div>
        )}
      </div>

      {canView && summary && (
        <div className="glass-card">
          <div className="info-grid">
            <div className="info-block">
              <div className="muted">Total seats</div>
              <div className="stat-value">{summary.total}</div>
            </div>
            <div className="info-block">
              <div className="muted">Active seats</div>
              <div className="stat-value">{summary.active}</div>
            </div>
            <div className="info-block">
              <div className="muted">Vacant seats</div>
              <div className="stat-value">{summary.vacant}</div>
            </div>
            <div className="info-block">
              <div className="muted">Pending invites</div>
              <div className="stat-value">{pendingInvites}</div>
            </div>
          </div>
        </div>
      )}

      {canView && (
        <div className="glass-card space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2>Seat allocations</h2>
            <div className="muted">{seats.length} seats</div>
          </div>

          {seats.length === 0 ? (
            <div className="muted">No seats found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Status</th>
                    <th>User</th>
                    <th>Role</th>
                    <th>Project</th>
                    <th>Activated</th>
                  </tr>
                </thead>
                <tbody>
                  {seats.map((seat) => {
                    const userLabel = seat.userId ? userById.get(seat.userId)?.email || seat.userId : '-'
                    const projectLabel = seat.projectId ? projectById.get(seat.projectId)?.name || seat.projectId : '-'
                    return (
                      <tr key={seat._id || `${seat.orgId}-${seat.seatNumber}`}>
                        <td>{seat.seatNumber}</td>
                        <td>{seat.status}</td>
                        <td className="muted">{userLabel}</td>
                        <td className="muted">{formatRole(seat.role)}</td>
                        <td className="muted">{projectLabel}</td>
                        <td className="muted">{formatDateTime(seat.activatedAt)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
