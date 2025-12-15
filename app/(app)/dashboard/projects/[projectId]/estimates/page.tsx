'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { FormEvent, useEffect, useMemo, useState } from 'react'

import { ApiError, apiFetch } from '../../../../../lib/api'
import { hasAnyRole } from '../../../../../lib/rbac'
import { cn } from '../../../../../lib/utils'

type SessionUser = {
  id?: string
  role?: string
  roles?: string[]
  orgId?: string
}

type Project = {
  _id?: string
  id?: string
  name?: string
  archivedAt?: string | null
  piiStripped?: boolean
  legalHold?: boolean
}

type Organization = {
  _id?: string
  id?: string
  name: string
  archivedAt?: string | null
  piiStripped: boolean
  legalHold: boolean
}

type Estimate = {
  _id?: string
  id?: string
  projectId?: string
  organizationId?: string
  createdByUserId?: string
  name: string
  description?: string
  notes?: string
  status?: 'draft' | 'final' | 'archived'
  totalAmount?: number
  revision?: number
  archivedAt?: string | null
  piiStripped?: boolean
  legalHold?: boolean
  createdAt?: string
  updatedAt?: string
}

type OfflineAction =
  | {
      id: string
      orgId?: string
      projectId: string
      type: 'estimate.create'
      queuedAt: number
      payload: { name: string; description?: string; notes?: string }
      error?: string
    }
  | {
      id: string
      orgId?: string
      projectId: string
      type: 'estimate.archive' | 'estimate.unarchive'
      queuedAt: number
      payload: { estimateId: string }
      error?: string
    }

const queueStorageKey = 'myte.offlineQueue.estimates.v1'

const formatDateTime = (value?: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

const formatMoney = (value?: number | null) => {
  const amount = typeof value === 'number' && Number.isFinite(value) ? value : 0
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(amount)
}

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

export default function ProjectEstimatesPage() {
  const params = useParams()
  const projectIdRaw = (params as any)?.projectId
  const projectId = Array.isArray(projectIdRaw) ? projectIdRaw[0] : projectIdRaw || ''

  const [user, setUser] = useState<SessionUser | null>(null)
  const [org, setOrg] = useState<Organization | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [estimates, setEstimates] = useState<Estimate[]>([])
  const [includeArchived, setIncludeArchived] = useState(false)

  const [offlineQueue, setOfflineQueue] = useState<OfflineAction[]>([])
  const [isOnline, setIsOnline] = useState(true)
  const [syncingQueue, setSyncingQueue] = useState(false)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')

  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [reloadAt, setReloadAt] = useState(0)

  const canViewEstimates = useMemo(() => hasAnyRole(user, ['estimator', 'pm', 'admin']), [user])
  const canManageEstimates = canViewEstimates
  const canViewArchived = useMemo(() => hasAnyRole(user, ['admin']), [user])
  const canViewOrgDetails = canViewArchived

  const orgBlocked = !!org?.archivedAt || !!org?.legalHold
  const projectBlocked = !!project?.archivedAt || !!project?.legalHold

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
    persistQueue([action, ...offlineQueue])
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

          if (action.type === 'estimate.create') {
            await apiFetch(`/projects/${action.projectId}/estimates`, {
              method: 'POST',
              body: JSON.stringify({
                name: action.payload.name,
                description: action.payload.description,
                notes: action.payload.notes,
              }),
            })
            continue
          }

          if (action.type === 'estimate.archive' || action.type === 'estimate.unarchive') {
            const endpoint = action.type === 'estimate.archive' ? 'archive' : 'unarchive'
            await apiFetch(`/projects/${action.projectId}/estimates/${action.payload.estimateId}/${endpoint}`, { method: 'POST' })
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
      if (!projectId) return

      setLoading(true)
      setError(null)
      setActionMessage(null)
      try {
        const me = await apiFetch<{ user?: SessionUser }>('/auth/me')
        const currentUser = me?.user || null
        setUser(currentUser)
        setOrg(null)
        setProject(null)

        if (!currentUser?.id) {
          setError('You need to sign in to view estimates.')
          setEstimates([])
          return
        }

        if (!hasAnyRole(currentUser, ['estimator', 'pm', 'admin'])) {
          setError('You do not have access to project estimates.')
          setEstimates([])
          return
        }

        if (currentUser.orgId) {
          try {
            const orgRes = await apiFetch<Organization>(`/organizations/${currentUser.orgId}`)
            setOrg(orgRes)
          } catch {
            setOrg(null)
          }
        }

        try {
          const projectRes = await apiFetch<Project>(`/projects/${projectId}${canViewArchived ? '?includeArchived=1' : ''}`)
          setProject(projectRes)
        } catch {
          setProject(null)
        }

        const list = await apiFetch<Estimate[]>(
          `/projects/${projectId}/estimates${includeArchived && canViewArchived ? '?includeArchived=1' : ''}`
        )
        setEstimates(Array.isArray(list) ? list : [])
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.status === 401 || err.status === 403
              ? 'You need a valid session to view estimates.'
              : err.message
            : 'Unable to load estimates.'
        setError(message)
        setEstimates([])
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [projectId, includeArchived, canViewArchived, reloadAt])

  const handleCreateEstimate = async (event: FormEvent) => {
    event.preventDefault()
    if (!canManageEstimates || !projectId) return
    const trimmedName = name.trim()
    if (!trimmedName) return
    if (orgBlocked || projectBlocked) return

    setSubmitting(true)
    setError(null)
    setActionMessage(null)
    try {
      if (!isOnline) {
        enqueueAction({
          id: makeId(),
          orgId: user?.orgId,
          projectId,
          type: 'estimate.create',
          queuedAt: Date.now(),
          payload: {
            name: trimmedName,
            description: description.trim() || undefined,
            notes: notes.trim() || undefined,
          },
        })
        setActionMessage(`Queued "${trimmedName}" for sync when you're back online.`)
        setName('')
        setDescription('')
        setNotes('')
        return
      }

      await apiFetch(`/projects/${projectId}/estimates`, {
        method: 'POST',
        body: JSON.stringify({
          name: trimmedName,
          description: description.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      })
      setActionMessage(`Estimate "${trimmedName}" created.`)
      setName('')
      setDescription('')
      setNotes('')
      refresh()
    } catch (err: any) {
      setError(err?.message || 'Unable to create estimate.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleArchiveToggle = async (estimateId: string, archived: boolean) => {
    if (!canManageEstimates || !projectId) return
    if (orgBlocked || projectBlocked) return
    setError(null)
    setActionMessage(null)
    try {
      if (!isOnline) {
        enqueueAction({
          id: makeId(),
          orgId: user?.orgId,
          projectId,
          type: archived ? 'estimate.unarchive' : 'estimate.archive',
          queuedAt: Date.now(),
          payload: { estimateId },
        })
        setActionMessage(archived ? 'Queued estimate restore.' : 'Queued estimate archive.')
        return
      }

      await apiFetch(`/projects/${projectId}/estimates/${estimateId}/${archived ? 'unarchive' : 'archive'}`, {
        method: 'POST',
      })
      setActionMessage(archived ? 'Estimate restored.' : 'Estimate archived.')
      refresh()
    } catch (err: any) {
      setError(err?.message || 'Unable to update estimate state.')
    }
  }

  const projectTitle = project?.name ? `${project.name} · Estimates` : 'Project estimates'

  return (
    <section className="dashboard-grid">
      <section className="glass-card space-y-4">
        <div className="badge">Estimates</div>
        <div className="space-y-2">
          <h1>{projectTitle}</h1>
          <p className="subtitle">Create, finalize, and archive estimates for this project.</p>
        </div>

        {actionMessage && <div className="feedback success">{actionMessage}</div>}
        {error && <div className="feedback error">{error}</div>}

        {!isOnline && (
          <div className="feedback subtle">
            You appear to be offline. Actions can be queued and will sync automatically when you reconnect.
          </div>
        )}

        {project?.legalHold && <div className="feedback error">This project is on legal hold. Estimate writes are blocked.</div>}
        {project?.archivedAt && <div className="feedback subtle">This project is archived. Estimate writes are blocked.</div>}

        {canViewOrgDetails && org?.legalHold && (
          <div className="feedback error">Organization legal hold is active. Estimate writes are blocked.</div>
        )}
        {canViewOrgDetails && org?.archivedAt && <div className="feedback subtle">Organization is archived. Estimate writes are blocked.</div>}

        {canManageEstimates && (
          <form className="rounded-2xl border border-border/60 bg-white/5 p-4 space-y-3" onSubmit={handleCreateEstimate}>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <div className="text-sm font-semibold text-[color:var(--text)]">Estimate name</div>
                <input
                  className="input w-full"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Base estimate"
                  disabled={submitting || orgBlocked || projectBlocked}
                />
              </label>
              <label className="space-y-1">
                <div className="text-sm font-semibold text-[color:var(--text)]">Description</div>
                <input
                  className="input w-full"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional scope notes"
                  disabled={submitting || orgBlocked || projectBlocked}
                />
              </label>
              <label className="space-y-1 md:col-span-2">
                <div className="text-sm font-semibold text-[color:var(--text)]">Notes</div>
                <textarea
                  className="input w-full min-h-[84px]"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional internal notes"
                  disabled={submitting || orgBlocked || projectBlocked}
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <button className="btn primary" type="submit" disabled={submitting || name.trim() === '' || orgBlocked || projectBlocked}>
                {submitting ? 'Saving.' : isOnline ? 'Create estimate' : 'Queue estimate'}
              </button>
              <p className="text-sm text-muted-foreground">Line items can be edited after creation.</p>
            </div>
          </form>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span>
              {loading ? 'Loading.' : `${estimates.length} estimate${estimates.length === 1 ? '' : 's'}`}
            </span>
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

          <div className="flex flex-wrap items-center gap-2">
            <Link href="/dashboard/projects" className="btn secondary">
              Back to projects
            </Link>
            <button className="btn secondary" type="button" onClick={refresh} disabled={loading}>
              Refresh
            </button>
          </div>
        </div>

        {canManageEstimates && offlineQueue.length > 0 && (
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
                  action.type === 'estimate.create'
                    ? `Create estimate: ${action.payload.name}`
                    : action.type === 'estimate.archive'
                      ? `Archive estimate: ${action.payload.estimateId}`
                      : `Restore estimate: ${action.payload.estimateId}`
                return (
                  <div key={action.id} className="rounded-2xl border border-border/60 bg-[color:var(--panel)] px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-[color:var(--text)] truncate">{title}</div>
                        <div className="text-xs text-muted-foreground">{when}</div>
                        {action.error && <div className="text-xs text-[color:var(--danger)] mt-1">{action.error}</div>}
                      </div>
                      <button
                        className="btn secondary"
                        type="button"
                        onClick={() => removeQueuedAction(action.id)}
                        disabled={syncingQueue}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )
              })}
              {offlineQueue.length > 5 && <div className="text-sm text-muted-foreground">+ {offlineQueue.length - 5} more queued action(s)</div>}
            </div>
          </div>
        )}

        <div className="overflow-x-auto rounded-2xl border border-border/60">
          <table className="min-w-full text-sm">
            <thead className="bg-white/5 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Revision</th>
                <th className="px-4 py-2">Total</th>
                <th className="px-4 py-2">Updated</th>
                <th className="px-4 py-2">Archived</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {estimates.map((estimate) => {
                const id = estimate.id || estimate._id || ''
                const archived = !!estimate.archivedAt
                const blocked = orgBlocked || projectBlocked || !!estimate.legalHold
                return (
                  <tr key={id || estimate.name} className={cn('border-t border-border/60')}>
                    <td className="px-4 py-2 font-medium text-[color:var(--text)]">
                      {id ? (
                        <Link className="underline underline-offset-2 hover:text-[color:var(--accent)]" href={`/dashboard/projects/${projectId}/estimates/${id}`}>
                          {estimate.name}
                        </Link>
                      ) : (
                        estimate.name
                      )}
                      {estimate.legalHold && <div className="text-xs text-[color:var(--danger)] mt-1">Legal hold</div>}
                      {estimate.piiStripped && <div className="text-xs text-muted-foreground mt-1">PII stripped</div>}
                    </td>
                    <td className="px-4 py-2 text-[color:var(--text)]">{estimate.status || (archived ? 'archived' : 'draft')}</td>
                    <td className="px-4 py-2 text-[color:var(--text)]">{estimate.revision ?? '-'}</td>
                    <td className="px-4 py-2 text-[color:var(--text)]">{formatMoney(estimate.totalAmount)}</td>
                    <td className="px-4 py-2 text-muted-foreground">{formatDateTime(estimate.updatedAt)}</td>
                    <td className="px-4 py-2 text-[color:var(--text)]">{archived ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        {id ? (
                          <Link className="btn secondary" href={`/dashboard/projects/${projectId}/estimates/${id}`}>
                            Open
                          </Link>
                        ) : (
                          <button className="btn secondary" type="button" disabled>
                            Open
                          </button>
                        )}
                        {canManageEstimates && id && (
                          <button
                            className="btn secondary"
                            type="button"
                            disabled={blocked}
                            onClick={() => handleArchiveToggle(id, archived)}
                          >
                            {archived ? 'Restore' : 'Archive'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {!loading && estimates.length === 0 && (
                <tr>
                  <td className="px-4 py-4 text-muted-foreground" colSpan={7}>
                    No estimates found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {!canManageEstimates && (
          <div className="feedback subtle">You have read-only access. Ask an Org Admin if you need to manage estimates.</div>
        )}
      </section>
    </section>
  )
}
