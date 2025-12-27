'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useMemo, useState } from 'react'

import { ApiError, apiFetch } from '../../../lib/api'
import { hasAnyRole } from '../../../lib/rbac'
import { cn } from '../../../lib/utils'

type SessionUser = {
  id?: string
  role?: string
  roles?: string[]
  orgId?: string
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
  personId?: string | null
}

type Organization = {
  _id?: string
  id?: string
  name?: string
  archivedAt?: string | null
  piiStripped?: boolean
  legalHold?: boolean
}

type Person = {
  _id?: string
  id?: string
  personType: 'internal_staff' | 'internal_union' | 'external_person'
  displayName: string
  ironworkerNumber?: string | null
  userId?: string | null
  emails?: Array<{ value: string; isPrimary?: boolean }>
  primaryEmail?: string | null
}

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

const getId = (item: { id?: string; _id?: string }) => item.id || item._id || ''

const getPrimaryEmail = (person: Person | null) => {
  if (!person) return ''
  const email = person.emails?.find((e) => e?.isPrimary)?.value || person.emails?.[0]?.value
  return email || person.primaryEmail || ''
}

export default function InvitesPage() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [org, setOrg] = useState<Organization | null>(null)
  const [invites, setInvites] = useState<Invite[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [reloadAt, setReloadAt] = useState(0)

  const [personSearch, setPersonSearch] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<Person[]>([])
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null)

  const [inviteRole, setInviteRole] = useState('viewer')
  const [expiresInHours, setExpiresInHours] = useState(72)
  const [submitting, setSubmitting] = useState(false)

  const canView = useMemo(() => hasAnyRole(user, ['admin']), [user])
  const orgLegalHold = !!org?.legalHold
  const orgArchived = !!org?.archivedAt
  const orgPiiStripped = !!org?.piiStripped
  const orgBlocked = orgLegalHold || orgArchived
  const refresh = () => setReloadAt(Date.now())

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      setActionMessage(null)
      try {
        const me = await apiFetch<{ user?: SessionUser }>('/auth/me')
        const currentUser = me?.user || null
        setUser(currentUser)
        setOrg(null)
        if (!currentUser?.id) {
          setError('You need to sign in to manage invites.')
          setInvites([])
          return
        }
        if (!currentUser?.orgId) {
          setError('Your session is missing an organization scope. Ask a platform admin to assign you to an org.')
          setInvites([])
          return
        }
        if (!hasAnyRole(currentUser, ['admin'])) {
          setError('Org admin access required to manage invites.')
          setInvites([])
          return
        }
        const results = await Promise.allSettled([
          apiFetch<Invite[]>('/invites'),
          apiFetch<Organization>(`/organizations/${currentUser.orgId}`),
        ])
        const invitesRes = results[0]
        const orgRes = results[1]
        if (invitesRes.status === 'fulfilled') {
          setInvites(Array.isArray(invitesRes.value) ? invitesRes.value : [])
        } else {
          throw invitesRes.reason
        }
        if (orgRes.status === 'fulfilled') {
          setOrg(orgRes.value)
        } else {
          const err = orgRes.reason
          setError((prev) => prev || (err instanceof ApiError ? err.message : 'Unable to load organization.'))
        }
      } catch (err: any) {
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
    void load()
  }, [reloadAt])

  useEffect(() => {
    const run = async () => {
      const term = personSearch.trim()
      if (!canView || term.length < 2) {
        setSearchResults([])
        return
      }
      setSearching(true)
      try {
        const qs = new URLSearchParams()
        qs.set('search', term)
        const res = await apiFetch<Person[]>(`/persons?${qs.toString()}`)
        const next = Array.isArray(res) ? res.slice(0, 10) : []
        setSearchResults(next)
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }
    void run()
  }, [personSearch, canView])

  const selectedPersonId = selectedPerson ? getId(selectedPerson) : ''
  const selectedPrimaryEmail = getPrimaryEmail(selectedPerson)

  const pendingInviteForSelected = useMemo(() => {
    if (!selectedPersonId) return null
    return invites.find((inv) => (inv.personId || '') === selectedPersonId && inv.status === 'pending') || null
  }, [invites, selectedPersonId])

  const inviteRoleOptions = useMemo(() => {
    if (!selectedPerson) return ROLE_OPTIONS.filter((opt) => opt.value !== 'foreman')
    if (selectedPerson.personType === 'internal_union') {
      return ROLE_OPTIONS.filter((opt) => opt.value === 'foreman' || opt.value === 'superintendent')
    }
    if (selectedPerson.personType === 'internal_staff') {
      return ROLE_OPTIONS.filter((opt) => opt.value !== 'foreman')
    }
    return []
  }, [selectedPerson])

  useEffect(() => {
    if (!inviteRoleOptions.some((opt) => opt.value === inviteRole)) {
      setInviteRole(inviteRoleOptions[0]?.value || 'viewer')
    }
  }, [inviteRoleOptions, inviteRole])

  const canSubmit = useMemo(() => {
    if (!canView) return false
    if (!selectedPersonId) return false
    if (!selectedPrimaryEmail) return false
    if (orgBlocked) return false
    if (!inviteRole.trim()) return false
    if (submitting) return false
    if (pendingInviteForSelected) return false
    if (selectedPerson?.userId) return false
    if (selectedPerson?.personType === 'external_person') return false
    if (selectedPerson?.personType === 'internal_union' && inviteRole === 'foreman' && !selectedPerson.ironworkerNumber) return false
    return true
  }, [
    canView,
    selectedPersonId,
    selectedPrimaryEmail,
    inviteRole,
    submitting,
    pendingInviteForSelected,
    selectedPerson?.userId,
    selectedPerson?.personType,
    selectedPerson?.ironworkerNumber,
    orgBlocked,
  ])

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
          personId: selectedPersonId,
          role: inviteRole,
          expiresInHours: Number(expiresInHours) || undefined,
        }),
      })
      setActionMessage(`Invite sent to ${selectedPrimaryEmail}.`)
      setPersonSearch('')
      setSearchResults([])
      setSelectedPerson(null)
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
          <p className="subtitle">Invites must originate from an existing People record (Person).</p>
        </div>

        {actionMessage && <div className="feedback success">{actionMessage}</div>}
        {error && <div className="feedback error">{error}</div>}
        {orgLegalHold && (
          <div className="feedback subtle">
            Legal hold is enabled for this organization. Invites are blocked until the hold is lifted.
          </div>
        )}
        {orgArchived && <div className="feedback subtle">This organization is archived. Invites are blocked.</div>}
        {orgPiiStripped && (
          <div className="feedback subtle">PII stripped is enabled for this organization. Some fields may be redacted.</div>
        )}

        {canView && (
          <form onSubmit={handleCreateInvite} className="space-y-3 rounded-2xl border border-border/60 bg-white/5 p-4">
            <div className="grid gap-3 md:grid-cols-3">
              <label className="flex flex-col gap-1 text-sm font-semibold text-[color:var(--text)] md:col-span-2">
                Find person
                <input
                  name="personSearch"
                  type="text"
                  placeholder="Search name, email, ironworker #..."
                  className="w-full rounded-xl border border-border/60 bg-white/5 px-3 py-2 text-base text-[var(--text)] outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[var(--accent)]"
                  value={personSearch}
                  onChange={(e) => setPersonSearch(e.target.value)}
                  disabled={submitting}
                />
                <div className="muted">
                  {searching ? 'Searching.' : selectedPerson ? `Selected: ${selectedPerson.displayName}` : 'Pick a person from results.'}
                </div>
              </label>

              <label className="flex flex-col gap-1 text-sm font-semibold text-[color:var(--text)]">
                Role
                <select
                  name="role"
                  className="w-full rounded-xl border border-border/60 bg-white/5 px-3 py-2 text-base text-[var(--text)] outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[var(--accent)]"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  disabled={submitting || !selectedPerson || inviteRoleOptions.length === 0}
                >
                  {inviteRoleOptions.map((opt) => (
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
                  disabled={submitting}
                />
              </label>
            </div>

            {!selectedPerson ? (
              <div className="muted">Search and pick a person below.</div>
            ) : !selectedPrimaryEmail ? (
              <div className="feedback subtle">Selected person has no primary email. Add one in People first.</div>
            ) : selectedPerson.userId ? (
              <div className="feedback subtle">Selected person is already linked to a user.</div>
            ) : pendingInviteForSelected ? (
              <div className="feedback subtle">Pending invite already exists for this person.</div>
            ) : selectedPerson.personType === 'external_person' ? (
              <div className="feedback subtle">External contacts cannot be invited into the app.</div>
            ) : selectedPerson.personType === 'internal_union' && inviteRole === 'foreman' && !selectedPerson.ironworkerNumber ? (
              <div className="feedback subtle">Foreman invites require an ironworker # on the Person.</div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm text-muted-foreground">
                  Invite email: <span className="font-semibold text-[color:var(--text)]">{selectedPrimaryEmail}</span>
                </div>
                <Link href={`/dashboard/settings/people/persons/${selectedPersonId}`} className="btn secondary">
                  View person
                </Link>
              </div>
            )}

            {searchResults.length > 0 && (
              <div className="rounded-2xl border border-border/60 bg-white/5 p-3">
                <div className="muted mb-2">Results</div>
                <div className="grid gap-2">
                  {searchResults.map((p) => {
                    const pid = getId(p)
                    const email = getPrimaryEmail(p)
                    return (
                      <button
                        type="button"
                        key={pid}
                        className={cn('flex items-center justify-between rounded-xl border border-border/60 bg-white/5 px-3 py-2 text-left', selectedPersonId === pid && 'border-[color:var(--accent)]')}
                        onClick={() => setSelectedPerson(p)}
                      >
                        <div>
                          <div className="font-semibold text-[color:var(--text)]">{p.displayName}</div>
                          <div className="muted text-xs">
                            {p.personType} {email ? `· ${email}` : ''} {p.ironworkerNumber ? `· IW# ${p.ironworkerNumber}` : ''}
                          </div>
                        </div>
                        <div className="muted text-xs">{selectedPersonId === pid ? 'Selected' : 'Select'}</div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <button className="btn primary" type="submit" disabled={!canSubmit}>
              {submitting ? 'Sending.' : 'Send invite'}
            </button>
          </form>
        )}

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-muted-foreground">
              {loading ? 'Loading.' : `${invites.length} invite${invites.length === 1 ? '' : 's'}`}
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
                  const inviteId = inv.id || inv._id || ''
                  const expires = inv.tokenExpires ? new Date(inv.tokenExpires).toLocaleString() : '-'
                  const accepted = inv.acceptedAt ? new Date(inv.acceptedAt).toLocaleString() : '-'
                  const canResend = !orgBlocked && inv.status === 'pending' && !!inviteId
                  return (
                    <tr key={inviteId || inv.email} className={cn('border-t border-border/60')}>
                      <td className="px-4 py-2 font-medium text-[color:var(--text)]">{inv.email}</td>
                      <td className="px-4 py-2 text-[color:var(--text)]">{inv.role}</td>
                      <td className="px-4 py-2 text-[color:var(--text)]">{inv.status}</td>
                      <td className="px-4 py-2 text-[color:var(--text)]">{expires}</td>
                      <td className="px-4 py-2 text-[color:var(--text)]">{accepted}</td>
                      <td className="px-4 py-2 text-right">
                        <button className="btn secondary" type="button" disabled={!canResend} onClick={() => handleResend(inviteId)}>
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
