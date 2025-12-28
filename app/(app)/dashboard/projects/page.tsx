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

type ProjectBudget = {
  hours?: number | null
  labourRate?: number | null
  currency?: string | null
  amount?: number | null
}

type ProjectQuantities = {
  structural?: { tonnage?: number | null; pieces?: number | null }
  miscMetals?: { tonnage?: number | null; pieces?: number | null }
  metalDeck?: { pieces?: number | null; sqft?: number | null }
  cltPanels?: { pieces?: number | null; sqft?: number | null }
  glulam?: { volumeM3?: number | null; pieces?: number | null }
}

type ProjectStaffing = {
  projectManagerPersonId?: string | null
  superintendentPersonId?: string | null
  foremanPersonIds?: string[]
}

type ProjectCostCodeBudget = {
  costCodeId: string
  budgetedHours?: number | null
  costBudget?: number | null
}

type ProjectSeatAssignment = {
  seatId: string
  personId?: string | null
  role?: string | null
  assignedAt?: string | null
  removedAt?: string | null
}

type Project = {
  _id?: string
  id?: string
  name: string
  description?: string
  organizationId?: string
  officeId?: string | null
  projectCode?: string | null
  status?: string | null
  location?: string | null
  bidDate?: string | null
  awardDate?: string | null
  fabricationStartDate?: string | null
  fabricationEndDate?: string | null
  erectionStartDate?: string | null
  erectionEndDate?: string | null
  completionDate?: string | null
  budget?: ProjectBudget | null
  quantities?: ProjectQuantities | null
  staffing?: ProjectStaffing | null
  costCodeBudgets?: ProjectCostCodeBudget[]
  seatAssignments?: ProjectSeatAssignment[]
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
      payload: { name: string; description?: string; officeId?: string; projectCode?: string; status?: string; location?: string }
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

type ListResponse<T> = {
  data: T[]
  total: number
  page: number
  limit: number
}

type Office = {
  _id?: string
  id?: string
  name: string
  address?: string
  archivedAt?: string | null
}

type CostCode = {
  _id?: string
  id?: string
  category: string
  code: string
  description: string
  active: boolean
  archivedAt?: string | null
}

type PersonSummary = {
  _id?: string
  id?: string
  displayName: string
  personType?: string
  userId?: string | null
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

const toDateInputValue = (value?: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

const toNumberOrNull = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
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
  const [costCodes, setCostCodes] = useState<CostCode[]>([])
  const [staffPeople, setStaffPeople] = useState<PersonSummary[]>([])
  const [ironworkers, setIronworkers] = useState<PersonSummary[]>([])
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [editProject, setEditProject] = useState<Project | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [detailSaving, setDetailSaving] = useState(false)
  const [newCostCodeId, setNewCostCodeId] = useState('')
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
  const [projectCode, setProjectCode] = useState('')
  const [projectStatus, setProjectStatus] = useState('')
  const [projectLocation, setProjectLocation] = useState('')

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

  const costCodeById = useMemo(() => {
    const map = new Map<string, CostCode>()
    costCodes.forEach((code) => {
      const id = code.id || code._id
      if (id) map.set(id, code)
    })
    return map
  }, [costCodes])

  const costCodeOptions = useMemo(() => {
    return [...costCodes].sort((a, b) => (a.code || '').localeCompare(b.code || ''))
  }, [costCodes])

  const staffOptions = useMemo(() => {
    return [...staffPeople].filter((p) => !p.archivedAt).sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''))
  }, [staffPeople])

  const ironworkerOptions = useMemo(() => {
    return [...ironworkers].filter((p) => !p.archivedAt).sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''))
  }, [ironworkers])

  const staffAssignable = useMemo(() => staffOptions.filter((p) => !!p.userId), [staffOptions])
  const ironworkerAssignable = useMemo(() => ironworkerOptions.filter((p) => !!p.userId), [ironworkerOptions])

  const superintendentOptions = useMemo(() => {
    const combined = [...staffAssignable, ...ironworkerAssignable]
    combined.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''))
    return combined
  }, [staffAssignable, ironworkerAssignable])

  const personLabelById = useMemo(() => {
    const map = new Map<string, string>()
    staffPeople.forEach((p) => {
      const id = p.id || p._id
      if (id) map.set(id, p.displayName || id)
    })
    ironworkers.forEach((p) => {
      const id = p.id || p._id
      if (id && !map.has(id)) map.set(id, p.displayName || id)
    })
    return map
  }, [staffPeople, ironworkers])

  const refresh = () => setReloadAt(Date.now())

  const updateEditProject = (patch: Partial<Project>) => {
    setEditProject((prev) => (prev ? { ...prev, ...patch } : prev))
  }

  const updateBudgetField = (field: keyof ProjectBudget, value: number | string | null) => {
    setEditProject((prev) => {
      if (!prev) return prev
      const next: ProjectBudget = { ...(prev.budget || {}) }
      ;(next as Record<string, number | string | null | undefined>)[field] =
        typeof value === 'string' ? (value ? value : null) : value
      return { ...prev, budget: next }
    })
  }

  const updateQuantityField = (
    section: keyof ProjectQuantities,
    field: string,
    value: number | null
  ) => {
    setEditProject((prev) => {
      if (!prev) return prev
      const quantities = { ...(prev.quantities || {}) }
      const bucket = { ...(quantities[section] || {}) } as Record<string, number | null>
      bucket[field] = value
      quantities[section] = bucket
      return { ...prev, quantities }
    })
  }

  const updateStaffingField = (patch: Partial<ProjectStaffing>) => {
    setEditProject((prev) => {
      if (!prev) return prev
      const staffing = { ...(prev.staffing || {}) }
      return { ...prev, staffing: { ...staffing, ...patch } }
    })
  }

  const updateCostCodeBudget = (index: number, patch: Partial<ProjectCostCodeBudget>) => {
    setEditProject((prev) => {
      if (!prev) return prev
      const rows = Array.isArray(prev.costCodeBudgets) ? [...prev.costCodeBudgets] : []
      const current = rows[index] || { costCodeId: '' }
      rows[index] = { ...current, ...patch }
      return { ...prev, costCodeBudgets: rows }
    })
  }

  const addCostCodeBudgetRow = () => {
    if (!newCostCodeId) return
    setEditProject((prev) => {
      if (!prev) return prev
      const rows = Array.isArray(prev.costCodeBudgets) ? [...prev.costCodeBudgets] : []
      if (rows.some((row) => row.costCodeId === newCostCodeId)) return prev
      rows.push({ costCodeId: newCostCodeId, budgetedHours: 0, costBudget: 0 })
      return { ...prev, costCodeBudgets: rows }
    })
    setNewCostCodeId('')
  }

  const removeCostCodeBudgetRow = (index: number) => {
    setEditProject((prev) => {
      if (!prev) return prev
      const rows = Array.isArray(prev.costCodeBudgets) ? [...prev.costCodeBudgets] : []
      rows.splice(index, 1)
      return { ...prev, costCodeBudgets: rows }
    })
  }

  const seedCostCodeBudgets = () => {
    if (!costCodes.length) return
    const active = costCodes.filter((code) => code.active)
    setEditProject((prev) => {
      if (!prev) return prev
      const rows = active.map((code) => ({
        costCodeId: code.id || code._id || '',
        budgetedHours: 0,
        costBudget: 0,
      }))
      return { ...prev, costCodeBudgets: rows.filter((row) => row.costCodeId) }
    })
  }

  const toggleForeman = (personId: string) => {
    updateStaffingField({
      foremanPersonIds: Array.from(
        new Set([
          ...((editProject?.staffing?.foremanPersonIds || []) as string[]),
          personId,
        ])
      ),
    })
  }

  const removeForeman = (personId: string) => {
    updateStaffingField({
      foremanPersonIds: (editProject?.staffing?.foremanPersonIds || []).filter((id) => id !== personId),
    })
  }

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
                projectCode: action.payload.projectCode || undefined,
                status: action.payload.status || undefined,
                location: action.payload.location || undefined,
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
    if (!selectedProject) return
    const loadDetails = async () => {
      setDetailLoading(true)
      setDetailError(null)
      try {
        const results = await Promise.allSettled([
          apiFetch<CostCode[] | { data: CostCode[] }>('/cost-codes?noPagination=true'),
          apiFetch<ListResponse<PersonSummary> | PersonSummary[]>('/persons?personType=internal_staff&limit=200'),
          apiFetch<ListResponse<PersonSummary> | PersonSummary[]>('/persons?personType=internal_union&limit=200'),
        ])

        const costCodesRes = results[0]
        if (costCodesRes.status === 'fulfilled') {
          const payload = costCodesRes.value as any
          const rows = Array.isArray(payload) ? payload : payload?.data
          setCostCodes(Array.isArray(rows) ? rows : [])
        }

        const staffRes = results[1]
        if (staffRes.status === 'fulfilled') {
          const payload = staffRes.value as any
          const rows = Array.isArray(payload) ? payload : payload?.data
          setStaffPeople(Array.isArray(rows) ? rows : [])
        }

        const ironRes = results[2]
        if (ironRes.status === 'fulfilled') {
          const payload = ironRes.value as any
          const rows = Array.isArray(payload) ? payload : payload?.data
          setIronworkers(Array.isArray(rows) ? rows : [])
        }
      } catch (err: any) {
        setDetailError(err?.message || 'Unable to load project details data.')
      } finally {
        setDetailLoading(false)
      }
    }

    void loadDetails()
  }, [selectedProject?.id])

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

        const fetches: Array<Promise<any>> = [apiFetch<Project[]>(`/projects?${qs.toString()}`), apiFetch<Office[]>(`/org-locations?${qs.toString()}`)]
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
            projectCode: projectCode.trim() || undefined,
            status: projectStatus.trim() || undefined,
            location: projectLocation.trim() || undefined,
          },
        })
        setActionMessage(`Queued "${trimmedName}" for sync when you're back online.`)
        setName('')
        setDescription('')
        setOfficeId('')
        setProjectCode('')
        setProjectStatus('')
        setProjectLocation('')
        return
      }

      await apiFetch('/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: trimmedName,
          description: description.trim() || undefined,
          officeId: officeId.trim() || undefined,
          projectCode: projectCode.trim() || undefined,
          status: projectStatus.trim() || undefined,
          location: projectLocation.trim() || undefined,
        }),
      })
      setActionMessage(`Project "${trimmedName}" created.`)
      setName('')
      setDescription('')
      setOfficeId('')
      setProjectCode('')
      setProjectStatus('')
      setProjectLocation('')
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

  const handleSaveDetails = async () => {
    if (!editProject || !selectedProjectId) return
    setDetailSaving(true)
    setDetailError(null)
    try {
      const trimmedName = editProject.name?.trim() || ''
      if (!trimmedName) {
        setDetailError('Project name is required.')
        return
      }
      const budget = editProject.budget
        ? {
            hours: typeof editProject.budget.hours === 'number' ? editProject.budget.hours : null,
            labourRate: typeof editProject.budget.labourRate === 'number' ? editProject.budget.labourRate : null,
            currency: editProject.budget.currency || null,
          }
        : null

      const payload = {
        name: trimmedName,
        description: editProject.description?.trim() || '',
        officeId: editProject.officeId || null,
        projectCode: editProject.projectCode || null,
        status: editProject.status || null,
        location: editProject.location || null,
        bidDate: editProject.bidDate || null,
        awardDate: editProject.awardDate || null,
        fabricationStartDate: editProject.fabricationStartDate || null,
        fabricationEndDate: editProject.fabricationEndDate || null,
        erectionStartDate: editProject.erectionStartDate || null,
        erectionEndDate: editProject.erectionEndDate || null,
        completionDate: editProject.completionDate || null,
        budget,
        quantities: editProject.quantities || null,
        staffing: editProject.staffing || null,
        costCodeBudgets: editProject.costCodeBudgets || [],
      }

      const updated = await apiFetch<Project>(`/projects/${selectedProjectId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
      setSelectedProject(updated)
      setEditProject(JSON.parse(JSON.stringify(updated)) as Project)
      setActionMessage('Project updated.')
      refresh()
    } catch (err: any) {
      setDetailError(err?.message || 'Unable to update project.')
    } finally {
      setDetailSaving(false)
    }
  }

  const closeDetails = () => {
    setSelectedProject(null)
    setEditProject(null)
    setDetailError(null)
    setNewCostCodeId('')
  }

  const openDetails = (project: Project) => {
    setSelectedProject(project)
    setEditProject(JSON.parse(JSON.stringify(project)) as Project)
    setDetailError(null)
  }

  const detailProject = editProject || selectedProject
  const selectedProjectId = detailProject?.id || detailProject?._id || ''
  const selectedOffice = detailProject?.officeId ? officeMap.get(detailProject.officeId) : null
  const selectedOfficeLabel = selectedOffice ? selectedOffice.name : detailProject?.officeId ? detailProject.officeId : '-'
  const detailDisabled = !canManageProjects || detailSaving || orgBlocked || !!detailProject?.legalHold || !isOnline
  const budgetAmount =
    typeof editProject?.budget?.hours === 'number' && typeof editProject?.budget?.labourRate === 'number'
      ? editProject.budget.hours * editProject.budget.labourRate
      : null

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
                This organization is archived. Project changes may be restricted. Contact Platform Ops if you need access restored.
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
                    Project code
                    <input
                      name="projectCode"
                      type="text"
                      placeholder="Optional"
                      className="w-full rounded-xl border border-border/60 bg-white/5 px-3 py-2 text-base text-[var(--text)] outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[var(--accent)]"
                      value={projectCode}
                      onChange={(e) => setProjectCode(e.target.value)}
                      disabled={submitting || orgBlocked}
                    />
                  </label>

                  <label className="flex flex-col gap-1 text-sm font-semibold text-[color:var(--text)]">
                    Status
                    <input
                      name="status"
                      type="text"
                      placeholder="e.g., bidding, awarded"
                      className="w-full rounded-xl border border-border/60 bg-white/5 px-3 py-2 text-base text-[var(--text)] outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[var(--accent)]"
                      value={projectStatus}
                      onChange={(e) => setProjectStatus(e.target.value)}
                      disabled={submitting || orgBlocked}
                    />
                  </label>

                  <label className="flex flex-col gap-1 text-sm font-semibold text-[color:var(--text)] lg:col-span-2">
                    Location
                    <input
                      name="location"
                      type="text"
                      placeholder="e.g., 1200 Main St, Montreal"
                      className="w-full rounded-xl border border-border/60 bg-white/5 px-3 py-2 text-base text-[var(--text)] outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[var(--accent)]"
                      value={projectLocation}
                      onChange={(e) => setProjectLocation(e.target.value)}
                      disabled={submitting || orgBlocked}
                    />
                  </label>

                  <label className="flex flex-col gap-1 text-sm font-semibold text-[color:var(--text)]">
                    <div className="flex items-center justify-between gap-2">
                      <span>Org location (optional)</span>
                      <Link href="/dashboard/org-locations" className="text-xs text-[color:var(--accent)] hover:underline">
                        Manage org locations
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
                      placeholder="Short scope / notes..."
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
                    <th className="px-4 py-2">Code</th>
                    <th className="px-4 py-2">Status</th>
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
                        <td className="px-4 py-2 text-[color:var(--text)]">{project.projectCode || '-'}</td>
                        <td className="px-4 py-2 text-[color:var(--text)]">{project.status || '-'}</td>
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
                      <td className="px-4 py-4 text-muted-foreground" colSpan={7}>
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

      {selectedProject && detailProject && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="w-full max-w-5xl rounded-2xl bg-[color:var(--panel)] border border-border p-6 space-y-5 shadow-card overflow-y-auto max-h-[90vh]">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-lg font-semibold text-[color:var(--text)] truncate">{detailProject.name}</div>
                <div className="text-sm text-muted-foreground">Project scope, staffing, and cost code budgets.</div>
              </div>
              <button className="btn secondary" type="button" onClick={closeDetails}>
                Close
              </button>
            </div>

            {detailError && <div className="feedback error">{detailError}</div>}
            {detailLoading && <div className="feedback subtle">Loading staffing + cost code data.</div>}

            {detailProject.legalHold && (
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
                <div className="muted">Project code</div>
                <div className="stat-value">{detailProject.projectCode || '-'}</div>
              </div>
              <div className="info-block">
                <div className="muted">Status</div>
                <div className="stat-value">{detailProject.status || '-'}</div>
              </div>
              <div className="info-block">
                <div className="muted">Office</div>
                <div className="stat-value">{selectedOfficeLabel}</div>
              </div>
              <div className="info-block">
                <div className="muted">Created</div>
                <div className="stat-value">{detailProject.createdAt ? new Date(detailProject.createdAt).toLocaleString() : '-'}</div>
              </div>
              <div className="info-block">
                <div className="muted">Archived</div>
                <div className="stat-value">{detailProject.archivedAt ? new Date(detailProject.archivedAt).toLocaleString() : 'No'}</div>
              </div>
              <div className="info-block">
                <div className="muted">Legal hold</div>
                <div className="stat-value">{detailProject.legalHold ? 'On' : 'Off'}</div>
              </div>
              <div className="info-block">
                <div className="muted">PII stripped</div>
                <div className="stat-value">{detailProject.piiStripped ? 'Yes' : 'No'}</div>
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-white/5 p-4 space-y-3">
              <div className="text-sm font-semibold text-[color:var(--text)]">Basics</div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="font-semibold">Project name</span>
                  <input
                    value={editProject?.name || detailProject.name}
                    onChange={(e) => updateEditProject({ name: e.target.value })}
                    disabled={detailDisabled}
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-semibold">Project code</span>
                  <input
                    value={editProject?.projectCode || ''}
                    onChange={(e) => updateEditProject({ projectCode: e.target.value })}
                    disabled={detailDisabled}
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-semibold">Status</span>
                  <input
                    value={editProject?.status || ''}
                    onChange={(e) => updateEditProject({ status: e.target.value })}
                    disabled={detailDisabled}
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-semibold">Location</span>
                  <input
                    value={editProject?.location || ''}
                    onChange={(e) => updateEditProject({ location: e.target.value })}
                    disabled={detailDisabled}
                  />
                </label>
                <label className="space-y-1 text-sm md:col-span-2">
                  <span className="font-semibold">Org location</span>
                  <select
                    value={editProject?.officeId || ''}
                    onChange={(e) => updateEditProject({ officeId: e.target.value || null })}
                    disabled={detailDisabled}
                  >
                    <option value="">Unassigned</option>
                    {offices.map((office) => {
                      const id = office.id || office._id || ''
                      if (!id) return null
                      return (
                        <option key={id} value={id} disabled={!!office.archivedAt}>
                          {office.name}
                          {office.archivedAt ? ' (archived)' : ''}
                        </option>
                      )
                    })}
                  </select>
                </label>
                <label className="space-y-1 text-sm md:col-span-2">
                  <span className="font-semibold">Description</span>
                  <textarea
                    rows={3}
                    value={editProject?.description || ''}
                    onChange={(e) => updateEditProject({ description: e.target.value })}
                    disabled={detailDisabled}
                  />
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-white/5 p-4 space-y-3">
              <div className="text-sm font-semibold text-[color:var(--text)]">Schedule</div>
              <div className="grid gap-3 md:grid-cols-3">
                <label className="space-y-1 text-sm">
                  <span className="font-semibold">Bid date</span>
                  <input
                    type="date"
                    value={toDateInputValue(editProject?.bidDate)}
                    onChange={(e) => updateEditProject({ bidDate: e.target.value || null })}
                    disabled={detailDisabled}
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-semibold">Award date</span>
                  <input
                    type="date"
                    value={toDateInputValue(editProject?.awardDate)}
                    onChange={(e) => updateEditProject({ awardDate: e.target.value || null })}
                    disabled={detailDisabled}
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-semibold">Fabrication start</span>
                  <input
                    type="date"
                    value={toDateInputValue(editProject?.fabricationStartDate)}
                    onChange={(e) => updateEditProject({ fabricationStartDate: e.target.value || null })}
                    disabled={detailDisabled}
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-semibold">Fabrication end</span>
                  <input
                    type="date"
                    value={toDateInputValue(editProject?.fabricationEndDate)}
                    onChange={(e) => updateEditProject({ fabricationEndDate: e.target.value || null })}
                    disabled={detailDisabled}
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-semibold">Erection start</span>
                  <input
                    type="date"
                    value={toDateInputValue(editProject?.erectionStartDate)}
                    onChange={(e) => updateEditProject({ erectionStartDate: e.target.value || null })}
                    disabled={detailDisabled}
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-semibold">Erection end</span>
                  <input
                    type="date"
                    value={toDateInputValue(editProject?.erectionEndDate)}
                    onChange={(e) => updateEditProject({ erectionEndDate: e.target.value || null })}
                    disabled={detailDisabled}
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-semibold">Completion</span>
                  <input
                    type="date"
                    value={toDateInputValue(editProject?.completionDate)}
                    onChange={(e) => updateEditProject({ completionDate: e.target.value || null })}
                    disabled={detailDisabled}
                  />
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-white/5 p-4 space-y-3">
              <div className="text-sm font-semibold text-[color:var(--text)]">Budget</div>
              <div className="grid gap-3 md:grid-cols-4">
                <label className="space-y-1 text-sm">
                  <span className="font-semibold">Hours</span>
                  <input
                    type="number"
                    value={editProject?.budget?.hours ?? ''}
                    onChange={(e) => updateBudgetField('hours', toNumberOrNull(e.target.value))}
                    disabled={detailDisabled}
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-semibold">Labour rate</span>
                  <input
                    type="number"
                    value={editProject?.budget?.labourRate ?? ''}
                    onChange={(e) => updateBudgetField('labourRate', toNumberOrNull(e.target.value))}
                    disabled={detailDisabled}
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-semibold">Currency</span>
                  <input
                    value={editProject?.budget?.currency || ''}
                    onChange={(e) => updateBudgetField('currency', e.target.value)}
                    disabled={detailDisabled}
                  />
                </label>
                <div className="space-y-1 text-sm">
                  <div className="font-semibold">Amount</div>
                  <div className="rounded-xl border border-border/60 bg-white/5 px-3 py-2">
                    {budgetAmount !== null ? budgetAmount.toFixed(2) : '-'}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-white/5 p-4 space-y-3">
              <div className="text-sm font-semibold text-[color:var(--text)]">Quantities</div>
              <div className="grid gap-3 md:grid-cols-3">
                <label className="space-y-1 text-sm">
                  <span className="font-semibold">Structural tonnage</span>
                  <input
                    type="number"
                    value={editProject?.quantities?.structural?.tonnage ?? ''}
                    onChange={(e) => updateQuantityField('structural', 'tonnage', toNumberOrNull(e.target.value))}
                    disabled={detailDisabled}
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-semibold">Structural pieces</span>
                  <input
                    type="number"
                    value={editProject?.quantities?.structural?.pieces ?? ''}
                    onChange={(e) => updateQuantityField('structural', 'pieces', toNumberOrNull(e.target.value))}
                    disabled={detailDisabled}
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-semibold">Misc metals tonnage</span>
                  <input
                    type="number"
                    value={editProject?.quantities?.miscMetals?.tonnage ?? ''}
                    onChange={(e) => updateQuantityField('miscMetals', 'tonnage', toNumberOrNull(e.target.value))}
                    disabled={detailDisabled}
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-semibold">Misc metals pieces</span>
                  <input
                    type="number"
                    value={editProject?.quantities?.miscMetals?.pieces ?? ''}
                    onChange={(e) => updateQuantityField('miscMetals', 'pieces', toNumberOrNull(e.target.value))}
                    disabled={detailDisabled}
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-semibold">Metal deck pieces</span>
                  <input
                    type="number"
                    value={editProject?.quantities?.metalDeck?.pieces ?? ''}
                    onChange={(e) => updateQuantityField('metalDeck', 'pieces', toNumberOrNull(e.target.value))}
                    disabled={detailDisabled}
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-semibold">Metal deck sqft</span>
                  <input
                    type="number"
                    value={editProject?.quantities?.metalDeck?.sqft ?? ''}
                    onChange={(e) => updateQuantityField('metalDeck', 'sqft', toNumberOrNull(e.target.value))}
                    disabled={detailDisabled}
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-semibold">CLT panels pieces</span>
                  <input
                    type="number"
                    value={editProject?.quantities?.cltPanels?.pieces ?? ''}
                    onChange={(e) => updateQuantityField('cltPanels', 'pieces', toNumberOrNull(e.target.value))}
                    disabled={detailDisabled}
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-semibold">CLT panels sqft</span>
                  <input
                    type="number"
                    value={editProject?.quantities?.cltPanels?.sqft ?? ''}
                    onChange={(e) => updateQuantityField('cltPanels', 'sqft', toNumberOrNull(e.target.value))}
                    disabled={detailDisabled}
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-semibold">Glulam volume (m3)</span>
                  <input
                    type="number"
                    value={editProject?.quantities?.glulam?.volumeM3 ?? ''}
                    onChange={(e) => updateQuantityField('glulam', 'volumeM3', toNumberOrNull(e.target.value))}
                    disabled={detailDisabled}
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-semibold">Glulam pieces</span>
                  <input
                    type="number"
                    value={editProject?.quantities?.glulam?.pieces ?? ''}
                    onChange={(e) => updateQuantityField('glulam', 'pieces', toNumberOrNull(e.target.value))}
                    disabled={detailDisabled}
                  />
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-white/5 p-4 space-y-3">
              <div className="text-sm font-semibold text-[color:var(--text)]">Staffing</div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="font-semibold">Project manager</span>
                  <select
                    value={editProject?.staffing?.projectManagerPersonId || ''}
                    onChange={(e) => updateStaffingField({ projectManagerPersonId: e.target.value || null })}
                    disabled={detailDisabled}
                  >
                    <option value="">Unassigned</option>
                    {staffAssignable.map((person) => {
                      const pid = person.id || person._id
                      if (!pid) return null
                      return (
                        <option key={pid} value={pid}>
                          {person.displayName}
                        </option>
                      )
                    })}
                  </select>
                  <div className="muted">PMs must be staff with user access.</div>
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-semibold">Superintendent</span>
                  <select
                    value={editProject?.staffing?.superintendentPersonId || ''}
                    onChange={(e) => updateStaffingField({ superintendentPersonId: e.target.value || null })}
                    disabled={detailDisabled}
                  >
                    <option value="">Unassigned</option>
                    {superintendentOptions.map((person) => {
                      const pid = person.id || person._id
                      if (!pid) return null
                      return (
                        <option key={pid} value={pid}>
                          {person.displayName}
                        </option>
                      )
                    })}
                  </select>
                  <div className="muted">Superintendents can be staff or ironworkers with user access.</div>
                </label>
                <div className="space-y-2 md:col-span-2">
                  <div className="text-sm font-semibold">Foremen</div>
                  {ironworkerAssignable.length === 0 ? (
                    <div className="muted text-sm">No ironworkers with user accounts available.</div>
                  ) : (
                    <div className="grid gap-2 md:grid-cols-2">
                      {ironworkerAssignable.map((person) => {
                        const pid = person.id || person._id
                        if (!pid) return null
                        const selected = (editProject?.staffing?.foremanPersonIds || []).includes(pid)
                        return (
                          <label key={pid} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={(e) => {
                                if (e.target.checked) toggleForeman(pid)
                                else removeForeman(pid)
                              }}
                              disabled={detailDisabled}
                            />
                            {person.displayName}
                          </label>
                        )
                      })}
                    </div>
                  )}
                  <div className="muted">Foremen must be ironworkers with user access.</div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-white/5 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold text-[color:var(--text)]">Cost code budgets</div>
                <div className="flex gap-2">
                  <button type="button" className="btn secondary" onClick={seedCostCodeBudgets} disabled={detailDisabled}>
                    Seed active codes
                  </button>
                </div>
              </div>

              {Array.isArray(editProject?.costCodeBudgets) && editProject.costCodeBudgets.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="table w-full">
                    <thead>
                      <tr>
                        <th>Cost code</th>
                        <th>Budgeted hours</th>
                        <th>Cost budget</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {editProject.costCodeBudgets.map((row, idx) => {
                        const code = costCodeById.get(row.costCodeId)
                        const label = code ? `${code.category} - ${code.code} - ${code.description}` : row.costCodeId
                        return (
                          <tr key={`${row.costCodeId}-${idx}`}>
                            <td className="text-sm">{label || '-'}</td>
                            <td>
                              <input
                                type="number"
                                value={row.budgetedHours ?? ''}
                                onChange={(e) => updateCostCodeBudget(idx, { budgetedHours: toNumberOrNull(e.target.value) })}
                                disabled={detailDisabled}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                value={row.costBudget ?? ''}
                                onChange={(e) => updateCostCodeBudget(idx, { costBudget: toNumberOrNull(e.target.value) })}
                                disabled={detailDisabled}
                              />
                            </td>
                            <td className="text-right">
                              <button type="button" className="btn secondary" onClick={() => removeCostCodeBudgetRow(idx)} disabled={detailDisabled}>
                                Remove
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="muted text-sm">No cost code budgets yet.</div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <select value={newCostCodeId} onChange={(e) => setNewCostCodeId(e.target.value)} disabled={detailDisabled}>
                  <option value="">Add cost code...</option>
                  {costCodeOptions.map((code) => {
                    const id = code.id || code._id
                    if (!id) return null
                    return (
                      <option key={id} value={id}>
                        {code.category} - {code.code} - {code.description}
                      </option>
                    )
                  })}
                </select>
                <button type="button" className="btn secondary" onClick={addCostCodeBudgetRow} disabled={detailDisabled || !newCostCodeId}>
                  Add
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-white/5 p-4 space-y-3">
              <div className="text-sm font-semibold text-[color:var(--text)]">Seat assignments</div>
              {detailProject.seatAssignments && detailProject.seatAssignments.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="table w-full">
                    <thead>
                      <tr>
                        <th>Person</th>
                        <th>Role</th>
                        <th>Seat</th>
                        <th>Assigned</th>
                        <th>Removed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailProject.seatAssignments.map((row, idx) => (
                        <tr key={`${row.seatId}-${idx}`}>
                          <td>{row.personId ? personLabelById.get(row.personId) || row.personId : '-'}</td>
                          <td>{row.role || '-'}</td>
                          <td>{row.seatId}</td>
                          <td>{row.assignedAt ? new Date(row.assignedAt).toLocaleString() : '-'}</td>
                          <td>{row.removedAt ? new Date(row.removedAt).toLocaleString() : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="muted text-sm">No seat assignments yet.</div>
              )}
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
                  disabled={!!detailProject.legalHold || orgBlocked}
                  onClick={async () => {
                    await handleArchiveToggle(selectedProjectId, !!detailProject.archivedAt)
                    closeDetails()
                  }}
                >
                  {detailProject.archivedAt ? 'Restore project' : 'Archive project'}
                </button>
              ) : null}
              {canManageProjects ? (
                <button className="btn primary" type="button" onClick={handleSaveDetails} disabled={detailDisabled}>
                  {detailSaving ? 'Saving.' : 'Save changes'}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </section>

  )
}

