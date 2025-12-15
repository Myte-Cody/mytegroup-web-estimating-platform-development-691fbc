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

type Project = {
  _id?: string
  id?: string
  name: string
  description?: string
  organizationId?: string
  officeId?: string | null
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
      type: 'project.create'
      queuedAt: number
      payload: { name: string; description?: string; officeId?: string }
      error?: string
    }
  | {
      id: string
      orgId?: string
      type: 'project.archive' | 'project.unarchive'
      queuedAt: number
      payload: { projectId: string }
      error?: string
    }

type Office = {
  _id?: string
  id?: string
  name: string
  address?: string
  archivedAt?: string | null
}

type Organization = {
  _id?: string
  id?: string
  name: string
  archivedAt?: string | null
  piiStripped: boolean
  legalHold: boolean
}

const formatDate = (value?: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString()
}

const queueStorageKey = 'myte.offlineQueue.v1'

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

export default function ProjectsPage() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [org, setOrg] = useState<Organization | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [offices, setOffices] = useState<Office[]>([])
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
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
  const [description, setDescription] = useState('')
  const [officeId, setOfficeId] = useState<string>('')

  const canViewProjects = useMemo(() => hasAnyRole(user, ['viewer']), [user])
  const canManageProjects = useMemo(() => hasAnyRole(user, ['admin', 'manager']), [user])
  const canViewArchived = canManageProjects
  const canViewOrgDetails = useMemo(() => hasAnyRole(user, ['admin']), [user])
  const canViewEstimates = useMemo(() => hasAnyRole(user, ['estimator', 'pm', 'admin']), [user])

  const orgName = org?.name || 'Projects'
  const orgLegalHold = !!org?.legalHold
  const orgArchived = !!org?.archivedAt
  const orgPiiStripped = !!org?.piiStripped
  const orgBlocked = orgLegalHold || orgArchived

  const officeMap = useMemo(() => {
    const map = new Map<string, Office>()
    offices.forEach((office) => {
      const id = office.id || office._id
      if (id) map.set(id, office)
    })
    return map
  }, [offices])

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

          if (action.type === 'project.create') {
            await apiFetch('/projects', {
              method: 'POST',
              body: JSON.stringify({
                name: action.payload.name,
                description: action.payload.description || undefined,
                officeId: action.payload.officeId || undefined,
              }),
            })
            continue
          }

          if (action.type === 'project.archive' || action.type === 'project.unarchive') {
            const endpoint = action.type === 'project.archive' ? 'archive' : 'unarchive'
            await apiFetch(`/projects/${action.payload.projectId}/${endpoint}`, { method: 'POST' })
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
          setError('You need to sign in to view projects.')
          setProjects([])
          setOffices([])
          return
        }

        if (!hasAnyRole(currentUser, ['viewer'])) {
          setError('Project access required to view this page.')
          setProjects([])
          setOffices([])
          return
        }

        const includeArchivedQuery = includeArchived && hasAnyRole(currentUser, ['admin', 'manager'])

        const qs = new URLSearchParams()
        if (includeArchivedQuery) qs.set('includeArchived', '1')

        const fetches: Array<Promise<any>> = [apiFetch<Project[]>(`/projects?${qs.toString()}`), apiFetch<Office[]>(`/offices?${qs.toString()}`)]
        const includeOrg = !!currentUser.orgId && hasAnyRole(currentUser, ['admin'])
        if (includeOrg) {
          fetches.push(apiFetch<Organization>(`/organizations/${currentUser.orgId}`))
        }

        const results = await Promise.allSettled(fetches)
        const projectsRes = results[0]
        const officesRes = results[1]
        const orgRes = includeOrg ? results[2] : null

        if (projectsRes.status === 'fulfilled') {
          setProjects(Array.isArray(projectsRes.value) ? projectsRes.value : [])
        } else {
          const err = projectsRes.reason
          const msg = err instanceof ApiError ? err.message : 'Unable to load projects.'
          setError(msg)
          setProjects([])
        }

        if (officesRes.status === 'fulfilled') {
          setOffices(Array.isArray(officesRes.value) ? officesRes.value : [])
        } else {
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
              ? 'You need a valid session to view projects.'
              : err.message
            : 'Unable to load projects.'
        setError(message)
        setProjects([])
        setOffices([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [includeArchived, reloadAt])

  const handleCreateProject = async (event: FormEvent) => {
    event.preventDefault()
    if (!canManageProjects || orgBlocked) return
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
          type: 'project.create',
          queuedAt: Date.now(),
          payload: {
            name: trimmedName,
            description: description.trim() || undefined,
            officeId: officeId.trim() || undefined,
          },
        })
        setActionMessage(`Queued "${trimmedName}" for sync when you're back online.`)
        setName('')
        setDescription('')
        setOfficeId('')
        return
      }

      await apiFetch('/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: trimmedName,
          description: description.trim() || undefined,
          officeId: officeId.trim() || undefined,
        }),
      })
      setActionMessage(`Project "${trimmedName}" created.`)
      setName('')
      setDescription('')
      setOfficeId('')
      refresh()
    } catch (err: any) {
      setError(err?.message || 'Unable to create project.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleArchiveToggle = async (projectId: string, archived: boolean) => {
    if (!canManageProjects || orgBlocked) return
    setError(null)
    setActionMessage(null)
    try {
      if (!isOnline) {
        enqueueAction({
          id: makeId(),
          orgId: user?.orgId,
          type: archived ? 'project.unarchive' : 'project.archive',
          queuedAt: Date.now(),
          payload: { projectId },
        })
        setActionMessage(archived ? 'Queued project restore.' : 'Queued project archive.')
        return
      }

      await apiFetch(`/projects/${projectId}/${archived ? 'unarchive' : 'archive'}`, { method: 'POST' })
      setActionMessage(archived ? 'Project restored.' : 'Project archived.')
      refresh()
    } catch (err: any) {
      setError(err?.message || 'Unable to update project state.')
    }
  }

  const closeDetails = () => setSelectedProject(null)

  const openDetails = (project: Project) => setSelectedProject(project)

  const selectedProjectId = selectedProject?.id || selectedProject?._id || ''
  const selectedOffice = selectedProject?.officeId ? officeMap.get(selectedProject.officeId) : null
  const selectedOfficeLabel = selectedOffice ? selectedOffice.name : selectedProject?.officeId ? selectedProject.officeId : '-'

  return (
    <section className="dashboard-grid">
      <section className="glass-card space-y-4">
        <div className="badge">Projects</div>
        <div className="space-y-2">
          <h1>{orgName}</h1>
          <p className="subtitle">Manage the list of projects in your organization: create, archive, and review scope.</p>
        </div>

        {actionMessage && <div className="feedback success">{actionMessage}</div>}
        {error && <div className="feedback error">{error}</div>}

        {!user && !loading && !error && <div className="feedback subtle">Checking your session.</div>}

        {!isOnline && (
          <div className="feedback subtle">
            You appear to be offline. Actions can be queued and will sync automatically when you reconnect.
          </div>
        )}

        {!canViewProjects && user?.id && (
          <div className="feedback subtle">You do not have permission to view projects. Ask an Org Admin for access.</div>
        )}

        {canViewProjects && (
          <>
            {canViewOrgDetails && orgLegalHold && (
              <div className="feedback error">
                Legal hold is enabled for this organization. Project creation and archival actions are blocked until the hold is lifted.
              </div>
            )}

            {canViewOrgDetails && orgArchived && (
              <div className="feedback error">
                This organization is archived. Project changes may be restricted. Contact a platform admin if you need access restored.
              </div>
            )}

            {canViewOrgDetails && orgPiiStripped && (
              <div className="feedback subtle">PII stripping is enabled. Some project fields and audit data may be redacted.</div>
            )}

            {canManageProjects && (
              <form onSubmit={handleCreateProject} className="space-y-3 rounded-2xl border border-border/60 bg-white/5 p-4">
                <div className="grid gap-3 lg:grid-cols-3">
                  <label className="flex flex-col gap-1 text-sm font-semibold text-[color:var(--text)] lg:col-span-2">
                    Project name
                    <input
                      name="name"
                      type="text"
                      placeholder="e.g., Riverside HQ buildout"
                      className="w-full rounded-xl border border-border/60 bg-white/5 px-3 py-2 text-base text-[var(--text)] outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[var(--accent)]"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      disabled={submitting || orgBlocked}
                    />
                  </label>

                  <label className="flex flex-col gap-1 text-sm font-semibold text-[color:var(--text)]">
                    <div className="flex items-center justify-between gap-2">
                      <span>Office (optional)</span>
                      <Link href="/dashboard/offices" className="text-xs text-[color:var(--accent)] hover:underline">
                        Manage offices
                      </Link>
                    </div>
                    <select
                      name="officeId"
                      className="w-full rounded-xl border border-border/60 bg-white/5 px-3 py-2 text-base text-[var(--text)] outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[var(--accent)]"
                      value={officeId}
                      onChange={(e) => setOfficeId(e.target.value)}
                      disabled={submitting || orgBlocked}
                    >
                      <option value="">No office</option>
                      {offices
                        .filter((o) => !o.archivedAt)
                        .map((o) => (
                          <option key={o.id || o._id || o.name} value={o.id || o._id || ''}>
                            {o.name}
                          </option>
                        ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1 text-sm font-semibold text-[color:var(--text)] lg:col-span-3">
                    Description (optional)
                    <textarea
                      name="description"
                      rows={3}
                      placeholder="Short scope / notes…"
                      className="w-full resize-y rounded-xl border border-border/60 bg-white/5 px-3 py-2 text-base text-[var(--text)] outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[var(--accent)]"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      disabled={submitting || orgBlocked}
                    />
                  </label>
                </div>

                <button className="btn primary" type="submit" disabled={submitting || name.trim() === '' || orgBlocked}>
                  {submitting ? 'Saving.' : isOnline ? 'Create project' : 'Queue project'}
                </button>

                <p className="text-sm text-muted-foreground">
                  Projects are scoped to your organization. Archiving a project hides it from day-to-day views without deleting data.
                </p>
              </form>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span>
                  {loading ? 'Loading.' : `${projects.length} project${projects.length === 1 ? '' : 's'}`}
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

              <button className="btn secondary" type="button" onClick={refresh} disabled={loading}>
                Refresh
              </button>
            </div>

            {canManageProjects && offlineQueue.length > 0 && (
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
                      action.type === 'project.create'
                        ? `Create project: ${action.payload.name}`
                        : action.type === 'project.archive'
                          ? `Archive project: ${action.payload.projectId}`
                          : `Restore project: ${action.payload.projectId}`
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
                    <th className="px-4 py-2">Office</th>
                    <th className="px-4 py-2">Created</th>
                    <th className="px-4 py-2">Archived</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((project) => {
                    const id = project.id || project._id || ''
                    const archived = !!project.archivedAt
                    const office = project.officeId ? officeMap.get(project.officeId) : null
                    const officeLabel = office ? office.name : project.officeId ? project.officeId : '-'
                    const canToggle = canManageProjects && !!id && !project.legalHold && !orgBlocked
                    const canView = !!id
                    return (
                      <tr key={id || project.name} className={cn('border-t border-border/60')}>
                        <td className="px-4 py-2 font-medium text-[color:var(--text)]">{project.name}</td>
                        <td className="px-4 py-2 text-[color:var(--text)]">{officeLabel}</td>
                        <td className="px-4 py-2 text-muted-foreground">{formatDate(project.createdAt)}</td>
                        <td className="px-4 py-2 text-[color:var(--text)]">{archived ? 'Yes' : 'No'}</td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex justify-end gap-2">
                            <button className="btn secondary" type="button" disabled={!canView} onClick={() => openDetails(project)}>
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
                  {!loading && projects.length === 0 && (
                    <tr>
                      <td className="px-4 py-4 text-muted-foreground" colSpan={5}>
                        No projects found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {!canManageProjects && (
              <div className="feedback subtle">
                You have read-only access to projects. Ask an Org Admin if you need to create or archive projects.
              </div>
            )}
          </>
        )}
      </section>

      {selectedProject && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="w-full max-w-2xl rounded-2xl bg-[color:var(--panel)] border border-border p-6 space-y-4 shadow-card">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-lg font-semibold text-[color:var(--text)] truncate">{selectedProject.name}</div>
                <div className="text-sm text-muted-foreground">Project details and compliance flags.</div>
              </div>
              <button className="btn secondary" type="button" onClick={closeDetails}>
                Close
              </button>
            </div>

            {selectedProject.legalHold && (
              <div className="feedback error">This project is on legal hold. Destructive actions are blocked.</div>
            )}

            {canViewOrgDetails && orgBlocked && (
              <div className="feedback subtle">
                Organization restrictions are active. Some actions may be blocked until legal hold is lifted or the org is restored.
              </div>
            )}

            {!isOnline && <div className="feedback subtle">You are offline. Actions are disabled.</div>}

            <div className="info-grid">
              <div className="info-block">
                <div className="muted">Project ID</div>
                <div className="stat-value">{selectedProjectId || '-'}</div>
              </div>
              <div className="info-block">
                <div className="muted">Office</div>
                <div className="stat-value">{selectedOfficeLabel}</div>
              </div>
              <div className="info-block">
                <div className="muted">Created</div>
                <div className="stat-value">{selectedProject.createdAt ? new Date(selectedProject.createdAt).toLocaleString() : '-'}</div>
              </div>
              <div className="info-block">
                <div className="muted">Archived</div>
                <div className="stat-value">{selectedProject.archivedAt ? new Date(selectedProject.archivedAt).toLocaleString() : 'No'}</div>
              </div>
              <div className="info-block">
                <div className="muted">Legal hold</div>
                <div className="stat-value">{selectedProject.legalHold ? 'On' : 'Off'}</div>
              </div>
              <div className="info-block">
                <div className="muted">PII stripped</div>
                <div className="stat-value">{selectedProject.piiStripped ? 'Yes' : 'No'}</div>
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-white/5 p-4 space-y-2">
              <div className="text-sm font-semibold text-[color:var(--text)]">Description</div>
              <div className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedProject.description?.trim() || '-'}</div>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              {selectedProjectId && canViewEstimates ? (
                <Link
                  href={`/dashboard/projects/${selectedProjectId}/estimates`}
                  className="btn secondary"
                  onClick={closeDetails}
                >
                  Estimates
                </Link>
              ) : null}
              {canManageProjects && selectedProjectId ? (
                <button
                  className="btn secondary"
                  type="button"
                  disabled={!!selectedProject.legalHold || orgBlocked}
                  onClick={async () => {
                    await handleArchiveToggle(selectedProjectId, !!selectedProject.archivedAt)
                    closeDetails()
                  }}
                >
                  {selectedProject.archivedAt ? 'Restore project' : 'Archive project'}
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
