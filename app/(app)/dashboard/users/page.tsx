'use client'

import { useEffect, useMemo, useState } from 'react'

import { ApiError, apiFetch } from '../../../lib/api'
import { cn } from '../../../lib/utils'

type UserRecord = {
  _id?: string
  id?: string
  email: string
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

const ALLOWED_ROLES = ['org_owner', 'org_admin', 'admin', 'superadmin', 'platform_admin']

const ROLE_OPTIONS = [
  { value: 'org_owner', label: 'Org Owner (full suite)' },
  { value: 'org_admin', label: 'Org Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'pm', label: 'PM' },
  { value: 'estimator', label: 'Estimator' },
  { value: 'engineer', label: 'Engineer' },
  { value: 'detailer', label: 'Detailer' },
  { value: 'foreman', label: 'Foreman' },
  { value: 'superintendent', label: 'Superintendent' },
  { value: 'qaqc', label: 'QAQC' },
  { value: 'hs', label: 'H&S' },
  { value: 'purchasing', label: 'Purchasing' },
  { value: 'finance', label: 'Finance' },
  { value: 'viewer', label: 'Viewer (read-only)' },
  { value: 'user', label: 'User (basic)' },
]

export default function UsersPage() {
  const [role, setRole] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [includeArchived, setIncludeArchived] = useState(false)
  const [users, setUsers] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [reloadAt, setReloadAt] = useState(0)

  const canManage = useMemo(() => {
    return role ? ALLOWED_ROLES.includes(role) : false
  }, [role])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      setActionMessage(null)
      try {
        const me = await apiFetch<{ user?: { id?: string; role?: string } }>('/auth/me')
        const currentRole = me?.user?.role || null
        setRole(currentRole)
        setCurrentUserId(me?.user?.id || null)
        if (!currentRole || !ALLOWED_ROLES.includes(currentRole)) {
          setError('Org admin access required to view users.')
          setUsers([])
          return
        }

        const qs = new URLSearchParams()
        if (includeArchived) qs.set('includeArchived', '1')
        const res = await apiFetch<UserRecord[]>(`/users?${qs.toString()}`)
        setUsers(Array.isArray(res) ? res : [])
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.status === 401 || err.status === 403
              ? 'You need an admin session to manage users.'
              : err.message
            : 'Unable to load users.'
        setError(message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [includeArchived, reloadAt])

  const refresh = () => setReloadAt(Date.now())

  const handleArchiveToggle = async (userId: string, archived: boolean) => {
    setError(null)
    setActionMessage(null)
    try {
      await apiFetch(`/users/${userId}/${archived ? 'unarchive' : 'archive'}`, { method: 'PATCH' })
      setActionMessage(archived ? 'User restored.' : 'User archived.')
      refresh()
    } catch (err: any) {
      setError(err?.message || 'Unable to update user status.')
    }
  }

  const handleRoleUpdate = async (userId: string, nextRole: string) => {
    setError(null)
    setActionMessage(null)
    try {
      await apiFetch(`/users/${userId}/roles`, {
        method: 'PATCH',
        body: JSON.stringify({ roles: [nextRole] }),
      })
      setActionMessage('Roles updated.')
      refresh()
    } catch (err: any) {
      setError(err?.message || 'Unable to update roles.')
    }
  }

  return (
    <section className="dashboard-grid">
      <section className="glass-card space-y-4">
        <div className="badge">Org admin</div>
        <div className="space-y-2">
          <h1>Users</h1>
          <p className="subtitle">Manage people in your organization: roles, archival state, and compliance flags.</p>
        </div>

        {actionMessage && <div className="feedback success">{actionMessage}</div>}
        {error && <div className="feedback error">{error}</div>}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[color:var(--accent)]"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
              disabled={!canManage}
            />
            Show archived
          </label>
          <button className="btn secondary" type="button" onClick={refresh} disabled={loading || !canManage}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-border/60">
          <table className="min-w-full text-sm">
            <thead className="bg-white/5 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Primary role</th>
                <th className="px-4 py-2">Org</th>
                <th className="px-4 py-2">Archived</th>
                <th className="px-4 py-2">Legal hold</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const id = u.id || u._id || ''
                const archived = !!u.archivedAt
                const isSelf = !!currentUserId && id === currentUserId
                return (
                  <tr key={id || u.email} className={cn('border-t border-border/60')}>
                    <td className="px-4 py-2 font-medium text-[color:var(--text)]">{u.email}</td>
                    <td className="px-4 py-2 text-[color:var(--text)]">
                      <select
                        className="w-full max-w-[240px] rounded-xl border border-border/60 bg-white/5 px-3 py-2 text-sm text-[var(--text)] outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[var(--accent)]"
                        value={u.role || 'user'}
                        disabled={!canManage || isSelf}
                        onChange={(e) => handleRoleUpdate(id, e.target.value)}
                      >
                        {ROLE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      {isSelf && <div className="text-xs text-muted-foreground mt-1">You can’t change your own role.</div>}
                    </td>
                    <td className="px-4 py-2 text-[color:var(--text)]">{u.organizationId || '-'}</td>
                    <td className="px-4 py-2 text-[color:var(--text)]">{archived ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-2 text-[color:var(--text)]">{u.legalHold ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-2 text-right">
                      <button
                        className="btn secondary"
                        type="button"
                        disabled={!canManage || !id || isSelf || !!u.legalHold}
                        onClick={() => handleArchiveToggle(id, archived)}
                      >
                        {archived ? 'Restore' : 'Archive'}
                      </button>
                    </td>
                  </tr>
                )
              })}
              {!loading && users.length === 0 && (
                <tr>
                  <td className="px-4 py-4 text-muted-foreground" colSpan={6}>
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  )
}

