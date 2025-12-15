'use client'

import Link from 'next/link'
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

type Contact = {
  _id?: string
  id?: string
  orgId?: string
  name: string
  personType?: 'staff' | 'ironworker' | 'external' | string
  email?: string | null
  phone?: string | null
  company?: string | null
  officeId?: string | null
  ironworkerNumber?: string | null
  unionLocal?: string | null
  skills?: string[]
  certifications?: Array<{
    name: string
    issuedAt?: string | null
    expiresAt?: string | null
    documentUrl?: string | null
    notes?: string | null
  }>
  rating?: number | null
  tags?: string[]
  invitedUserId?: string | null
  inviteStatus?: 'pending' | 'accepted' | null
  invitedAt?: string | null
  archivedAt?: string | null
  piiStripped?: boolean
  legalHold?: boolean
  createdAt?: string
  updatedAt?: string
}

type PeopleTab = 'staff' | 'ironworkers' | 'external'

const TAB_LABELS: Record<PeopleTab, string> = {
  staff: 'Staff (Users + contacts)',
  ironworkers: 'Ironworkers',
  external: 'External',
}

const formatDateTime = (value?: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

export default function PeoplePage() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [tab, setTab] = useState<PeopleTab>('staff')
  const [includeArchived, setIncludeArchived] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [users, setUsers] = useState<UserRecord[]>([])
  const [staffContacts, setStaffContacts] = useState<Contact[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])

  const [reloadAt, setReloadAt] = useState(0)
  const refresh = () => setReloadAt(Date.now())

  const canView = useMemo(() => hasAnyRole(user, ['admin']), [user])
  const canViewArchived = canView

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const me = await apiFetch<{ user?: SessionUser }>('/auth/me')
        const currentUser = me?.user || null
        setUser(currentUser)
        setUsers([])
        setStaffContacts([])
        setContacts([])

        if (!currentUser?.id) {
          setError('You need to sign in to manage people.')
          return
        }

        if (!hasAnyRole(currentUser, ['admin'])) {
          setError('Org admin access required to view the People directory.')
          return
        }

        if (tab === 'staff') {
          const qsUsers = new URLSearchParams()
          if (includeArchived) qsUsers.set('includeArchived', '1')

          const qsContacts = new URLSearchParams()
          if (includeArchived && canViewArchived) qsContacts.set('includeArchived', '1')
          qsContacts.set('personType', 'staff')

          const results = await Promise.allSettled([
            apiFetch<UserRecord[]>(`/users?${qsUsers.toString()}`),
            apiFetch<Contact[]>(`/contacts?${qsContacts.toString()}`),
          ])

          const usersRes = results[0]
          const contactsRes = results[1]

          if (usersRes.status === 'fulfilled') {
            setUsers(Array.isArray(usersRes.value) ? usersRes.value : [])
          } else {
            throw usersRes.reason
          }

          if (contactsRes.status === 'fulfilled') {
            setStaffContacts(Array.isArray(contactsRes.value) ? contactsRes.value : [])
          } else {
            throw contactsRes.reason
          }
          return
        }

        const qs = new URLSearchParams()
        if (includeArchived && canViewArchived) qs.set('includeArchived', '1')
        const personType = tab === 'ironworkers' ? 'ironworker' : 'external'
        qs.set('personType', personType)
        const res = await apiFetch<Contact[]>(`/contacts?${qs.toString()}`)
        setContacts(Array.isArray(res) ? res : [])
      } catch (err: any) {
        const message =
          err instanceof ApiError
            ? err.status === 401 || err.status === 403
              ? 'You need a valid admin session to view people.'
              : err.message
            : 'Unable to load people.'
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [tab, includeArchived, canViewArchived, reloadAt])

  const userRows = useMemo(() => {
    const sorted = [...users]
    sorted.sort((a, b) => (a.email || '').localeCompare(b.email || ''))
    return sorted
  }, [users])

  const contactRows = useMemo(() => {
    const sorted = [...contacts]
    sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    return sorted
  }, [contacts])

  const staffContactRows = useMemo(() => {
    const sorted = [...staffContacts]
    sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    return sorted
  }, [staffContacts])

  const createHref = useMemo(() => {
    const base = '/dashboard/settings/people/contacts/new'
    if (tab === 'staff') return `${base}?personType=staff`
    if (tab === 'ironworkers') return `${base}?personType=ironworker`
    return `${base}?personType=external`
  }, [tab])

  const createLabel = useMemo(() => {
    if (tab === 'staff') return 'New staff contact'
    if (tab === 'ironworkers') return 'New ironworker'
    return 'New external contact'
  }, [tab])

  return (
    <section className="space-y-6">
      <div className="glass-card space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="badge">Directory</div>
            <h1>People</h1>
            <p className="subtitle">Staff users, ironworkers, and external contacts (suppliers/subcontractors).</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn secondary" onClick={refresh} disabled={loading}>
              {loading ? 'Loading…' : 'Refresh'}
            </button>
            <Link href={createHref} className="btn secondary">
              {createLabel}
            </Link>
            <Link href="/dashboard/settings/people/import" className="btn primary">
              Import
            </Link>
            <Link href="/dashboard/invites" className="btn secondary">
              Invites
            </Link>
          </div>
        </div>

        {error && <div className={cn('feedback error')}>{error}</div>}

        {canView && (
          <div className="flex flex-wrap items-center gap-2">
            {(Object.keys(TAB_LABELS) as PeopleTab[]).map((key) => (
              <button
                key={key}
                type="button"
                className={cn('btn', key === tab ? 'primary' : 'secondary')}
                onClick={() => setTab(key)}
              >
                {TAB_LABELS[key]}
              </button>
            ))}
            <label className="ml-auto flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(e) => setIncludeArchived(e.target.checked)}
                disabled={!canViewArchived}
              />
              Include archived
            </label>
          </div>
        )}
      </div>

      {canView && tab === 'staff' && (
        <div className="space-y-6">
          <div className="glass-card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2>Staff users</h2>
              <div className="muted">{userRows.length} users</div>
            </div>

            {userRows.length === 0 ? (
              <div className="muted">No users found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table w-full">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userRows.map((row) => {
                      const id = row.id || row._id || row.email || Math.random().toString(16)
                      const archived = !!row.archivedAt
                      return (
                        <tr key={id} className={cn(archived && 'opacity-70')}>
                          <td>{row.email || '-'}</td>
                          <td>{row.role || 'user'}</td>
                          <td>{archived ? `Archived (${formatDateTime(row.archivedAt)})` : 'Active'}</td>
                          <td>{formatDateTime(row.createdAt)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="glass-card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2>Staff contacts (directory)</h2>
              <div className="muted">{staffContactRows.length} contacts</div>
            </div>

            {staffContactRows.length === 0 ? (
              <div className="muted">No staff contacts yet. Use “{createLabel}” to add a directory record.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table w-full">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Invite</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffContactRows.map((row) => {
                      const id = row.id || row._id || row.email || row.name
                      const href = row.id || row._id ? `/dashboard/settings/people/contacts/${row.id || row._id}` : null
                      const archived = !!row.archivedAt
                      return (
                        <tr key={id} className={cn(archived && 'opacity-70')}>
                          <td>
                            {href ? (
                              <Link href={href} className="font-semibold text-[color:var(--text)]">
                                {row.name}
                              </Link>
                            ) : (
                              row.name
                            )}
                          </td>
                          <td>{row.email || '-'}</td>
                          <td>{row.phone || '-'}</td>
                          <td>{row.inviteStatus ? row.inviteStatus : '-'}</td>
                          <td>{archived ? `Archived (${formatDateTime(row.archivedAt)})` : 'Active'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {canView && tab !== 'staff' && (
        <div className="glass-card space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2>{TAB_LABELS[tab]}</h2>
            <div className="muted">{contactRows.length} contacts</div>
          </div>

          {contactRows.length === 0 ? (
            <div className="muted">No contacts found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Company</th>
                    <th>Ironworker #</th>
                    <th>Rating</th>
                    <th>Invite</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {contactRows.map((row) => {
                    const id = row.id || row._id || row.email || row.name
                    const href = row.id || row._id ? `/dashboard/settings/people/contacts/${row.id || row._id}` : null
                    const archived = !!row.archivedAt
                    return (
                      <tr key={id} className={cn(archived && 'opacity-70')}>
                        <td>
                          {href ? (
                            <Link href={href} className="font-semibold text-[color:var(--text)]">
                              {row.name}
                            </Link>
                          ) : (
                            row.name
                          )}
                        </td>
                        <td>{row.email || '-'}</td>
                        <td>{row.phone || '-'}</td>
                        <td>{row.company || '-'}</td>
                        <td>{row.ironworkerNumber || '-'}</td>
                        <td>{typeof row.rating === 'number' ? row.rating : '-'}</td>
                        <td>{row.inviteStatus ? row.inviteStatus : '-'}</td>
                        <td>{archived ? `Archived (${formatDateTime(row.archivedAt)})` : 'Active'}</td>
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
