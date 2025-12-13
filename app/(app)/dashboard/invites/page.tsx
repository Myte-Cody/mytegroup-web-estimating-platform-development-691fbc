'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'

import { ApiError, apiFetch } from '../../../lib/api'
import { cn } from '../../../lib/utils'

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

export default function InvitesPage() {
  const [role, setRole] = useState<string | null>(null)
  const [invites, setInvites] = useState<Invite[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [reloadAt, setReloadAt] = useState(0)

  const [email, setEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('viewer')
  const [expiresInHours, setExpiresInHours] = useState(72)
  const [submitting, setSubmitting] = useState(false)

  const canSubmit = useMemo(() => {
    return email.trim() !== '' && inviteRole.trim() !== '' && !submitting
  }, [email, inviteRole, submitting])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      setActionMessage(null)
      try {
        const me = await apiFetch<{ user?: { role?: string } }>('/auth/me')
        const currentRole = me?.user?.role || null
        setRole(currentRole)
        if (!currentRole || !ALLOWED_ROLES.includes(currentRole)) {
          setError('Org admin access required to manage invites.')
          setInvites([])
          return
        }
        const res = await apiFetch<Invite[]>('/invites')
        setInvites(Array.isArray(res) ? res : [])
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.status === 401 || err.status === 403
              ? 'You need an admin session to manage invites.'
              : err.message
            : 'Unable to load invites.'
        setError(message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [reloadAt])

  const refresh = () => setReloadAt(Date.now())

  const handleCreateInvite = async (event: FormEvent) => {
    event.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setActionMessage(null)
    setError(null)
    try {
      await apiFetch('/invites', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          role: inviteRole,
          expiresInHours: Number(expiresInHours) || undefined,
        }),
      })
      setActionMessage(`Invite sent to ${email.trim()}.`)
      setEmail('')
      setInviteRole('viewer')
      setExpiresInHours(72)
      refresh()
    } catch (err: any) {
      setError(err?.message || 'Failed to send invite.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleResend = async (inviteId: string) => {
    setActionMessage(null)
    setError(null)
    try {
      await apiFetch(`/invites/${inviteId}/resend`, { method: 'POST' })
      setActionMessage('Invite resent.')
      refresh()
    } catch (err: any) {
      setError(err?.message || 'Failed to resend invite.')
    }
  }

  return (
    <section className="dashboard-grid">
      <section className="glass-card space-y-4">
        <div className="badge">Org admin</div>
        <div className="space-y-2">
          <h1>Invites</h1>
          <p className="subtitle">Invite teammates into your organization and assign a starting role.</p>
        </div>

        {actionMessage && <div className="feedback success">{actionMessage}</div>}
        {error && <div className="feedback error">{error}</div>}

        {role && ALLOWED_ROLES.includes(role) && (
          <form onSubmit={handleCreateInvite} className="space-y-3 rounded-2xl border border-border/60 bg-white/5 p-4">
            <div className="grid gap-3 md:grid-cols-3">
              <label className="flex flex-col gap-1 text-sm font-semibold text-[color:var(--text)] md:col-span-2">
                Work email
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="teammate@company.com"
                  className="w-full rounded-xl border border-border/60 bg-white/5 px-3 py-2 text-base text-[var(--text)] outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[var(--accent)]"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-semibold text-[color:var(--text)]">
                Role
                <select
                  name="role"
                  className="w-full rounded-xl border border-border/60 bg-white/5 px-3 py-2 text-base text-[var(--text)] outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[var(--accent)]"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm font-semibold text-[color:var(--text)]">
                Expires (hours)
                <input
                  name="expiresInHours"
                  type="number"
                  min={1}
                  max={168}
                  className="w-full rounded-xl border border-border/60 bg-white/5 px-3 py-2 text-base text-[var(--text)] outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[var(--accent)]"
                  value={expiresInHours}
                  onChange={(e) => setExpiresInHours(Number(e.target.value))}
                />
              </label>
            </div>

            <button className="btn primary" type="submit" disabled={!canSubmit}>
              {submitting ? 'Sending…' : 'Send invite'}
            </button>

            <p className="text-sm text-muted-foreground">
              Invite emails contain a one-time token. The recipient sets their password and joins your org with the
              assigned role.
            </p>
          </form>
        )}

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-muted-foreground">
              {loading ? 'Loading…' : `${invites.length} invite${invites.length === 1 ? '' : 's'}`}
            </div>
            <button className="btn secondary" type="button" onClick={refresh} disabled={loading}>
              Refresh
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-border/60">
            <table className="min-w-full text-sm">
              <thead className="bg-white/5 text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Role</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Expires</th>
                  <th className="px-4 py-2">Accepted</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invites.map((inv) => {
                  const id = inv.id || inv._id || ''
                  const expires = inv.tokenExpires ? new Date(inv.tokenExpires).toLocaleString() : '-'
                  const accepted = inv.acceptedAt ? new Date(inv.acceptedAt).toLocaleString() : '-'
                  const canResend = inv.status === 'pending' && !!id
                  return (
                    <tr key={id || inv.email} className={cn('border-t border-border/60')}>
                      <td className="px-4 py-2 font-medium text-[color:var(--text)]">{inv.email}</td>
                      <td className="px-4 py-2 text-[color:var(--text)]">{inv.role}</td>
                      <td className="px-4 py-2 text-[color:var(--text)]">{inv.status}</td>
                      <td className="px-4 py-2 text-[color:var(--text)]">{expires}</td>
                      <td className="px-4 py-2 text-[color:var(--text)]">{accepted}</td>
                      <td className="px-4 py-2 text-right">
                        <button
                          className="btn secondary"
                          type="button"
                          disabled={!canResend}
                          onClick={() => handleResend(id)}
                        >
                          Resend
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {!loading && invites.length === 0 && (
                  <tr>
                    <td className="px-4 py-4 text-muted-foreground" colSpan={6}>
                      No invites yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </section>
  )
}

