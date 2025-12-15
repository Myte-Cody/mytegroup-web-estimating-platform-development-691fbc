'use client'

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

type Office = {
  _id?: string
  id?: string
  name: string
  address?: string
  organizationId?: string
  archivedAt?: string | null
  piiStripped?: boolean
  legalHold?: boolean
  createdAt?: string
  updatedAt?: string
}

type Organization = {
  _id?: string
  id?: string
  name: string
  archivedAt?: string | null
  piiStripped: boolean
  legalHold: boolean
}

type OfflineAction =
  | {
      id: string
      orgId?: string
      type: 'office.create'
      queuedAt: number
      payload: { name: string; address?: string }
      error?: string
    }
  | {
      id: string
      orgId?: string
      type: 'office.archive' | 'office.unarchive'
      queuedAt: number
      payload: { officeId: string }
      error?: string
    }

const formatDate = (value?: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString()
}

const queueStorageKey = 'myte.offlineQueue.offices.v1'

const safeJsonParse = <T,>(value: string | null): T | null => {
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

const makeId = () => {
  const cryptoRef = (globalThis as any).crypto
  if (cryptoRef?.randomUUID) return cryptoRef.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export default function OfficesPage() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [org, setOrg] = useState<Organization | null>(null)
  const [offices, setOffices] = useState<Office[]>([])
  const [selectedOffice, setSelectedOffice] = useState<Office | null>(null)
  const [offlineQueue, setOfflineQueue] = useState<OfflineAction[]>([])

  const [includeArchived, setIncludeArchived] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const [syncingQueue, setSyncingQueue] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [reloadAt, setReloadAt] = useState(0)

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')

  const canViewOffices = useMemo(() => hasAnyRole(user, ['viewer']), [user])
  const canManageOffices = useMemo(() => hasAnyRole(user, ['admin', 'manager']), [user])
  const canViewArchived = canManageOffices
  const canViewOrgDetails = useMemo(() => hasAnyRole(user, ['admin']), [user])

  const orgName = org?.name || 'Offices'
  const orgLegalHold = !!org?.legalHold
  const orgArchived = !!org?.archivedAt
  const orgPiiStripped = !!org?.piiStripped
  const orgBlocked = orgLegalHold || orgArchived

  const refresh = () => setReloadAt(Date.now())

  const persistQueue = (nextQueue: OfflineAction[]) => {
    setOfflineQueue(nextQueue)
    try {
      localStorage.setItem(queueStorageKey, JSON.stringify(nextQueue))
    } catch {
      // ignore storage failures
    }
  }

  const enqueueAction = (action: OfflineAction) => {
    const next = [action, ...offlineQueue]
    persistQueue(next)
  }

  const removeQueuedAction = (actionId: string) => {
    persistQueue(offlineQueue.filter((a) => a.id !== actionId))
  }

  const clearQueue = () => persistQueue([])

  const flushQueue = async () => {
    if (!isOnline) return
    if (!offlineQueue.length) return
    if (syncingQueue) return

    setSyncingQueue(true)
    setError(null)
    setActionMessage(null)

    try {
      const me = await apiFetch<{ user?: SessionUser }>('/auth/me')
      const currentUser = me?.user || null
      if (!currentUser?.id) {
        setError('Sign in to sync queued actions.')
        return
      }

      const remaining: OfflineAction[] = []
      for (const action of offlineQueue) {
        try {
          if (action.orgId && currentUser.orgId && action.orgId !== currentUser.orgId) {
            remaining.push({ ...action, error: 'org_scope_mismatch' })
            continue
          }

          if (action.type === 'office.create') {
            await apiFetch('/offices', {
              method: 'POST',
              body: JSON.stringify({
                name: action.payload.name,
                address: action.payload.address || undefined,
              }),
            })
            continue
          }

          if (action.type === 'office.archive' || action.type === 'office.unarchive') {
            const endpoint = action.type === 'office.archive' ? 'archive' : 'unarchive'
            await apiFetch(`/offices/${action.payload.officeId}/${endpoint}`, { method: 'POST' })
            continue
          }

          remaining.push({ ...action, error: 'unknown_action' })
        } catch (err: any) {
          remaining.push({ ...action, error: err?.message || 'sync_failed' })
        }
      }

      persistQueue(remaining)
      if (remaining.length) {
        setActionMessage('Some queued actions could not be synced. Review the queue and retry.')
      } else {
        setActionMessage('Queued actions synced.')
      }
      refresh()
    } catch (err: any) {
      setError(err?.message || 'Unable to sync queued actions.')
    } finally {
      setSyncingQueue(false)
    }
  }

  useEffect(() => {
    const update = () => setIsOnline(typeof navigator === 'undefined' ? true : navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  useEffect(() => {
    const existing = safeJsonParse<OfflineAction[]>(localStorage.getItem(queueStorageKey))
    if (Array.isArray(existing)) {
      setOfflineQueue(existing)
    }
  }, [])

  useEffect(() => {
    if (isOnline && offlineQueue.length > 0) {
      void flushQueue()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline])

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
          setError('You need to sign in to view offices.')
          setOffices([])
          return
        }

        if (!hasAnyRole(currentUser, ['viewer'])) {
          setError('Office access required to view this page.')
          setOffices([])
          return
        }

        const includeArchivedQuery = includeArchived && hasAnyRole(currentUser, ['admin', 'manager'])
        const qs = new URLSearchParams()
        if (includeArchivedQuery) qs.set('includeArchived', '1')

        const fetches: Array<Promise<any>> = [apiFetch<Office[]>(`/offices?${qs.toString()}`)]
        const includeOrg = !!currentUser.orgId && hasAnyRole(currentUser, ['admin'])
        if (includeOrg) {
          fetches.push(apiFetch<Organization>(`/organizations/${currentUser.orgId}`))
        }

        const results = await Promise.allSettled(fetches)
        const officesRes = results[0]
        const orgRes = includeOrg ? results[1] : null

        if (officesRes.status === 'fulfilled') {
          setOffices(Array.isArray(officesRes.value) ? officesRes.value : [])
        } else {
          const err = officesRes.reason
          const msg = err instanceof ApiError ? err.message : 'Unable to load offices.'
          setError(msg)
          setOffices([])
        }

        if (orgRes) {
          if (orgRes.status === 'fulfilled') {
            setOrg(orgRes.value || null)
          } else {
            setOrg(null)
          }
        }
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.status === 401 || err.status === 403
              ? 'You need a valid session to view offices.'
              : err.message
            : 'Unable to load offices.'
        setError(message)
        setOffices([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [includeArchived, reloadAt])

  const handleCreateOffice = async (event: FormEvent) => {
    event.preventDefault()
    if (!canManageOffices || orgBlocked) return
    const trimmedName = name.trim()
    if (!trimmedName) return

    setSubmitting(true)
    setError(null)
    setActionMessage(null)
    try {
      if (!isOnline) {
        enqueueAction({
          id: makeId(),
          orgId: user?.orgId,
          type: 'office.create',
          queuedAt: Date.now(),
          payload: {
            name: trimmedName,
            address: address.trim() || undefined,
          },
        })
        setActionMessage(`Queued "${trimmedName}" for sync when you're back online.`)
        setName('')
        setAddress('')
        return
      }

      await apiFetch('/offices', {
        method: 'POST',
        body: JSON.stringify({
          name: trimmedName,
          address: address.trim() || undefined,
        }),
      })
      setActionMessage(`Office "${trimmedName}" created.`)
      setName('')
      setAddress('')
      refresh()
    } catch (err: any) {
      setError(err?.message || 'Unable to create office.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleArchiveToggle = async (officeId: string, archived: boolean) => {
    if (!canManageOffices || orgBlocked) return
    setError(null)
    setActionMessage(null)
    try {
      if (!isOnline) {
        enqueueAction({
          id: makeId(),
          orgId: user?.orgId,
          type: archived ? 'office.unarchive' : 'office.archive',
          queuedAt: Date.now(),
          payload: { officeId },
        })
        setActionMessage(archived ? 'Queued office restore.' : 'Queued office archive.')
        return
      }

      await apiFetch(`/offices/${officeId}/${archived ? 'unarchive' : 'archive'}`, { method: 'POST' })
      setActionMessage(archived ? 'Office restored.' : 'Office archived.')
      refresh()
    } catch (err: any) {
      setError(err?.message || 'Unable to update office state.')
    }
  }

  const closeDetails = () => setSelectedOffice(null)
  const openDetails = (office: Office) => setSelectedOffice(office)

  const selectedOfficeId = selectedOffice?.id || selectedOffice?._id || ''

  return (
    <section className="dashboard-grid">
      <section className="glass-card space-y-4">
        <div className="badge">Offices</div>
        <div className="space-y-2">
          <h1>{orgName}</h1>
          <p className="subtitle">
            Manage office locations for your organization. Offices help scope projects, reporting, and job cost structure.
          </p>
        </div>

        {actionMessage && <div className="feedback success">{actionMessage}</div>}
        {error && <div className="feedback error">{error}</div>}

        {!user && !loading && !error && <div className="feedback subtle">Checking your session.</div>}

        {!isOnline && (
          <div className="feedback subtle">
            You appear to be offline. Actions can be queued and will sync automatically when you reconnect.
          </div>
        )}

        {!canViewOffices && user?.id && (
          <div className="feedback subtle">You do not have permission to view offices. Ask an Org Admin for access.</div>
        )}

        {canViewOffices && (
          <>
            {canViewOrgDetails && orgLegalHold && (
              <div className="feedback error">
                Legal hold is enabled for this organization. Office creation and archival actions are blocked until the hold is lifted.
              </div>
            )}

            {canViewOrgDetails && orgArchived && (
              <div className="feedback error">
                This organization is archived. Office changes may be restricted. Contact a platform admin if you need access restored.
              </div>
            )}

            {canViewOrgDetails && orgPiiStripped && (
              <div className="feedback subtle">PII stripping is enabled. Some office fields and audit data may be redacted.</div>
            )}

            {canManageOffices && (
              <form onSubmit={handleCreateOffice} className="space-y-3 rounded-2xl border border-border/60 bg-white/5 p-4">
                <div className="grid gap-3 lg:grid-cols-3">
                  <label className="flex flex-col gap-1 text-sm font-semibold text-[color:var(--text)] lg:col-span-2">
                    Office name
                    <input
                      name="name"
                      type="text"
                      placeholder="e.g., HQ / North Yard"
                      className="w-full rounded-xl border border-border/60 bg-white/5 px-3 py-2 text-base text-[var(--text)] outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[var(--accent)]"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      disabled={submitting || orgBlocked}
                    />
                  </label>

                  <label className="flex flex-col gap-1 text-sm font-semibold text-[color:var(--text)] lg:col-span-3">
                    Address (optional)
                    <input
                      name="address"
                      type="text"
                      placeholder="Street, City, State"
                      className="w-full rounded-xl border border-border/60 bg-white/5 px-3 py-2 text-base text-[var(--text)] outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[var(--accent)]"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      disabled={submitting || orgBlocked}
                    />
                  </label>
                </div>

                <button className="btn primary" type="submit" disabled={submitting || name.trim() === '' || orgBlocked}>
                  {submitting ? 'Saving.' : isOnline ? 'Create office' : 'Queue office'}
                </button>
              </form>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span>{loading ? 'Loading.' : `${offices.length} office${offices.length === 1 ? '' : 's'}`}</span>
                {canViewArchived && (
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[color:var(--accent)]"
                      checked={includeArchived}
                      onChange={(e) => setIncludeArchived(e.target.checked)}
                      disabled={loading}
                    />
                    Show archived
                  </label>
                )}
              </div>

              <button className="btn secondary" type="button" onClick={refresh} disabled={loading}>
                Refresh
              </button>
            </div>

            {canManageOffices && offlineQueue.length > 0 && (
              <div className="rounded-2xl border border-border/60 bg-white/5 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-[color:var(--text)]">Sync queue</div>
                    <div className="text-sm text-muted-foreground">{offlineQueue.length} queued action(s) pending.</div>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn secondary" type="button" onClick={clearQueue} disabled={syncingQueue}>
                      Clear
                    </button>
                    <button className="btn primary" type="button" onClick={flushQueue} disabled={!isOnline || syncingQueue}>
                      {syncingQueue ? 'Syncing.' : 'Sync now'}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {offlineQueue.slice(0, 5).map((action) => {
                    const when = new Date(action.queuedAt).toLocaleString()
                    const title =
                      action.type === 'office.create'
                        ? `Create office: ${action.payload.name}`
                        : action.type === 'office.archive'
                          ? `Archive office: ${action.payload.officeId}`
                          : `Restore office: ${action.payload.officeId}`
                    return (
                      <div key={action.id} className="rounded-2xl border border-border/60 bg-[color:var(--panel)] px-4 py-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-semibold text-[color:var(--text)] truncate">{title}</div>
                            <div className="text-xs text-muted-foreground">{when}</div>
                            {action.error && <div className="text-xs text-[color:var(--danger)] mt-1">{action.error}</div>}
                          </div>
                          <button className="btn secondary" type="button" onClick={() => removeQueuedAction(action.id)} disabled={syncingQueue}>
                            Remove
                          </button>
                        </div>
                      </div>
                    )
                  })}
                  {offlineQueue.length > 5 && (
                    <div className="text-sm text-muted-foreground">+ {offlineQueue.length - 5} more queued action(s)</div>
                  )}
                </div>
              </div>
            )}

            <div className="overflow-x-auto rounded-2xl border border-border/60">
              <table className="min-w-full text-sm">
                <thead className="bg-white/5 text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2">Name</th>
                    <th className="px-4 py-2">Address</th>
                    <th className="px-4 py-2">Created</th>
                    <th className="px-4 py-2">Archived</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {offices.map((office) => {
                    const id = office.id || office._id || ''
                    const archived = !!office.archivedAt
                    const canToggle = canManageOffices && !!id && !office.legalHold && !orgBlocked
                    const canView = !!id
                    return (
                      <tr key={id || office.name} className={cn('border-t border-border/60')}>
                        <td className="px-4 py-2 font-medium text-[color:var(--text)]">{office.name}</td>
                        <td className="px-4 py-2 text-muted-foreground">{office.address || '-'}</td>
                        <td className="px-4 py-2 text-muted-foreground">{formatDate(office.createdAt)}</td>
                        <td className="px-4 py-2 text-[color:var(--text)]">{archived ? 'Yes' : 'No'}</td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex justify-end gap-2">
                            <button className="btn secondary" type="button" disabled={!canView} onClick={() => openDetails(office)}>
                              View
                            </button>
                            <button
                              className="btn secondary"
                              type="button"
                              disabled={!canToggle}
                              onClick={() => handleArchiveToggle(id, archived)}
                            >
                              {archived ? 'Restore' : 'Archive'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {!loading && offices.length === 0 && (
                    <tr>
                      <td className="px-4 py-4 text-muted-foreground" colSpan={5}>
                        No offices found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {!canManageOffices && (
              <div className="feedback subtle">
                You have read-only access to offices. Ask an Org Admin if you need to create or archive offices.
              </div>
            )}
          </>
        )}
      </section>

      {selectedOffice && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="w-full max-w-2xl rounded-2xl bg-[color:var(--panel)] border border-border p-6 space-y-4 shadow-card">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-lg font-semibold text-[color:var(--text)] truncate">{selectedOffice.name}</div>
                <div className="text-sm text-muted-foreground">Office details and compliance flags.</div>
              </div>
              <button className="btn secondary" type="button" onClick={closeDetails}>
                Close
              </button>
            </div>

            {selectedOffice.legalHold && (
              <div className="feedback error">This office is on legal hold. Destructive actions are blocked.</div>
            )}

            {!isOnline && <div className="feedback subtle">You are offline. Actions will be queued.</div>}

            <div className="info-grid">
              <div className="info-block">
                <div className="muted">Office ID</div>
                <div className="stat-value">{selectedOfficeId || '-'}</div>
              </div>
              <div className="info-block">
                <div className="muted">Created</div>
                <div className="stat-value">
                  {selectedOffice.createdAt ? new Date(selectedOffice.createdAt).toLocaleString() : '-'}
                </div>
              </div>
              <div className="info-block">
                <div className="muted">Archived</div>
                <div className="stat-value">{selectedOffice.archivedAt ? new Date(selectedOffice.archivedAt).toLocaleString() : 'No'}</div>
              </div>
              <div className="info-block">
                <div className="muted">Legal hold</div>
                <div className="stat-value">{selectedOffice.legalHold ? 'On' : 'Off'}</div>
              </div>
              <div className="info-block">
                <div className="muted">PII stripped</div>
                <div className="stat-value">{selectedOffice.piiStripped ? 'Yes' : 'No'}</div>
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-white/5 p-4 space-y-2">
              <div className="text-sm font-semibold text-[color:var(--text)]">Address</div>
              <div className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedOffice.address?.trim() || '-'}</div>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              {canManageOffices && selectedOfficeId ? (
                <button
                  className="btn secondary"
                  type="button"
                  disabled={!!selectedOffice.legalHold || orgBlocked}
                  onClick={async () => {
                    await handleArchiveToggle(selectedOfficeId, !!selectedOffice.archivedAt)
                    closeDetails()
                  }}
                >
                  {selectedOffice.archivedAt ? 'Restore office' : 'Archive office'}
                </button>
              ) : null}
              <button className="btn primary" type="button" onClick={closeDetails}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

