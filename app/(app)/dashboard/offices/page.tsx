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
  description?: string | null
  timezone?: string | null
  orgLocationTypeKey?: string | null
  tagKeys?: string[]
  parentOrgLocationId?: string | null
  sortOrder?: number | null
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

type GraphEdge = {
  _id?: string
  id?: string
  orgId?: string
  edgeTypeKey: string
  fromNodeType: string
  fromNodeId: string
  toNodeType: string
  toNodeId: string
  archivedAt?: string | null
  createdAt?: string
}

type OfficeTreeNode = {
  id: string
  office: Office
  depth: number
  children: OfficeTreeNode[]
}

type OfflineAction =
  | {
      id: string
      orgId?: string
      type: 'office.create'
      queuedAt: number
      payload: {
        name: string
        address?: string
        description?: string | null
        timezone?: string | null
        orgLocationTypeKey?: string | null
        tagKeys?: string[]
        parentOrgLocationId?: string | null
        sortOrder?: number | null
      }
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

const splitList = (value: string) => {
  return (value || '')
    .split(/[,;\n]/g)
    .map((item) => item.trim())
    .filter(Boolean)
}

const joinList = (items?: Array<string | null | undefined>) => {
  return (items || [])
    .map((item) => (item || '').trim())
    .filter(Boolean)
    .join(', ')
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
  const [viewMode, setViewMode] = useState<'table' | 'tree'>('table')
  const [expandedOfficeIds, setExpandedOfficeIds] = useState<Set<string>>(() => new Set())
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const [syncingQueue, setSyncingQueue] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [reloadAt, setReloadAt] = useState(0)

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [orgLocationTypeKey, setOrgLocationTypeKey] = useState('')
  const [tagKeysText, setTagKeysText] = useState('')
  const [parentOrgLocationId, setParentOrgLocationId] = useState('')
  const [description, setDescription] = useState('')
  const [timezone, setTimezone] = useState('')
  const [sortOrderText, setSortOrderText] = useState('')

  const [detailsMessage, setDetailsMessage] = useState<string | null>(null)
  const [detailsError, setDetailsError] = useState<string | null>(null)
  const [editingDetails, setEditingDetails] = useState(false)
  const [savingDetails, setSavingDetails] = useState(false)
  const [detailName, setDetailName] = useState('')
  const [detailAddress, setDetailAddress] = useState('')
  const [detailTypeKey, setDetailTypeKey] = useState('')
  const [detailTagsText, setDetailTagsText] = useState('')
  const [detailParentId, setDetailParentId] = useState('')
  const [detailDescription, setDetailDescription] = useState('')
  const [detailTimezone, setDetailTimezone] = useState('')
  const [detailSortOrderText, setDetailSortOrderText] = useState('')

  const [edgesOut, setEdgesOut] = useState<GraphEdge[]>([])
  const [edgesIn, setEdgesIn] = useState<GraphEdge[]>([])
  const [edgesLoading, setEdgesLoading] = useState(false)
  const [edgesError, setEdgesError] = useState<string | null>(null)
  const [newEdgeType, setNewEdgeType] = useState<'depends_on' | 'supports'>('depends_on')
  const [newEdgeTargetId, setNewEdgeTargetId] = useState('')
  const [creatingEdge, setCreatingEdge] = useState(false)

  const canViewOffices = useMemo(() => hasAnyRole(user, ['viewer']), [user])
  const canManageOffices = useMemo(() => hasAnyRole(user, ['admin', 'manager']), [user])
  const canManageEdges = useMemo(() => hasAnyRole(user, ['admin']), [user])
  const canViewArchived = canManageOffices
  const canViewOrgDetails = useMemo(() => hasAnyRole(user, ['admin']), [user])

  const orgName = org?.name || 'Org locations'
  const orgLegalHold = !!org?.legalHold
  const orgArchived = !!org?.archivedAt
  const orgPiiStripped = !!org?.piiStripped
  const orgBlocked = orgLegalHold || orgArchived

  const officeNameById = useMemo(() => {
    const map = new Map<string, string>()
    offices.forEach((office) => {
      const id = office.id || office._id
      if (!id) return
      map.set(id, office.name)
    })
    return map
  }, [offices])

  const officeTree = useMemo(() => {
    const byId = new Map<string, Office>()
    offices.forEach((office) => {
      const id = (office.id || office._id || '').trim()
      if (!id) return
      byId.set(id, office)
    })

    const childrenByParent = new Map<string, Office[]>()
    const rootKey = '__root__'

    const getBucket = (key: string) => {
      const existing = childrenByParent.get(key)
      if (existing) return existing
      const created: Office[] = []
      childrenByParent.set(key, created)
      return created
    }

    byId.forEach((office, id) => {
      const parentIdRaw = (office.parentOrgLocationId || '').trim()
      const parentKey = parentIdRaw && byId.has(parentIdRaw) ? parentIdRaw : rootKey
      getBucket(parentKey).push({ ...office, id })
    })

    const sortBucket = (bucket: Office[]) => {
      bucket.sort((a, b) => {
        const aSort = typeof a.sortOrder === 'number' ? a.sortOrder : Number.POSITIVE_INFINITY
        const bSort = typeof b.sortOrder === 'number' ? b.sortOrder : Number.POSITIVE_INFINITY
        if (aSort !== bSort) return aSort - bSort
        return (a.name || '').localeCompare(b.name || '')
      })
    }

    childrenByParent.forEach((bucket) => sortBucket(bucket))

    const buildNodes = (parentId: string, depth: number, path: Set<string>): OfficeTreeNode[] => {
      const bucket = childrenByParent.get(parentId) || []
      return bucket
        .map((office) => {
          const id = (office.id || office._id || '').trim()
          if (!id) return null
          if (path.has(id)) {
            return { id, office, depth, children: [] }
          }
          const nextPath = new Set(path)
          nextPath.add(id)
          const children = buildNodes(id, depth + 1, nextPath)
          return { id, office, depth, children }
        })
        .filter(Boolean) as OfficeTreeNode[]
    }

    return buildNodes(rootKey, 0, new Set())
  }, [offices])

  const officeTreeAllIds = useMemo(() => {
    const ids: string[] = []
    const walk = (nodes: OfficeTreeNode[]) => {
      nodes.forEach((node) => {
        ids.push(node.id)
        if (node.children.length) walk(node.children)
      })
    }
    walk(officeTree)
    return ids
  }, [officeTree])

  useEffect(() => {
    if (expandedOfficeIds.size) return
    const rootIds = officeTree.map((node) => node.id)
    if (!rootIds.length) return
    setExpandedOfficeIds(new Set(rootIds))
  }, [officeTree, expandedOfficeIds.size])

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
            await apiFetch('/org-locations', {
              method: 'POST',
              body: JSON.stringify({
                name: action.payload.name,
                address: action.payload.address || undefined,
                description: action.payload.description ?? undefined,
                timezone: action.payload.timezone ?? undefined,
                orgLocationTypeKey: action.payload.orgLocationTypeKey ?? undefined,
                tagKeys: action.payload.tagKeys?.length ? action.payload.tagKeys : undefined,
                parentOrgLocationId: action.payload.parentOrgLocationId ?? undefined,
                sortOrder: typeof action.payload.sortOrder === 'number' ? action.payload.sortOrder : undefined,
              }),
            })
            continue
          }

          if (action.type === 'office.archive' || action.type === 'office.unarchive') {
            const endpoint = action.type === 'office.archive' ? 'archive' : 'unarchive'
            await apiFetch(`/org-locations/${action.payload.officeId}/${endpoint}`, { method: 'POST' })
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
          setError('You need to sign in to view org locations.')
          setOffices([])
          return
        }

        if (!hasAnyRole(currentUser, ['viewer'])) {
          setError('Org location access required to view this page.')
          setOffices([])
          return
        }

        const includeArchivedQuery = includeArchived && hasAnyRole(currentUser, ['admin', 'manager'])
        const qs = new URLSearchParams()
        if (includeArchivedQuery) qs.set('includeArchived', '1')

        const fetches: Array<Promise<any>> = [apiFetch<Office[]>(`/org-locations?${qs.toString()}`)]
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
          const msg = err instanceof ApiError ? err.message : 'Unable to load org locations.'
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
              ? 'You need a valid session to view org locations.'
              : err.message
            : 'Unable to load org locations.'
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

    const tags = splitList(tagKeysText)
    const trimmedType = orgLocationTypeKey.trim()
    const trimmedParent = parentOrgLocationId.trim()
    const trimmedDescription = description.trim()
    const trimmedTimezone = timezone.trim()
    const sortOrderRaw = sortOrderText.trim()
    const sortOrder = sortOrderRaw ? Number(sortOrderRaw) : null
    if (sortOrderRaw && (!Number.isFinite(sortOrder) || !Number.isInteger(sortOrder))) {
      setError('Sort order must be an integer.')
      return
    }

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
            description: trimmedDescription || null,
            timezone: trimmedTimezone || null,
            orgLocationTypeKey: trimmedType || null,
            tagKeys: tags.length ? tags : undefined,
            parentOrgLocationId: trimmedParent || null,
            sortOrder,
          },
        })
        setActionMessage(`Queued "${trimmedName}" for sync when you're back online.`)
        setName('')
        setAddress('')
        setOrgLocationTypeKey('')
        setTagKeysText('')
        setParentOrgLocationId('')
        setDescription('')
        setTimezone('')
        setSortOrderText('')
        return
      }

      await apiFetch('/org-locations', {
        method: 'POST',
        body: JSON.stringify({
          name: trimmedName,
          address: address.trim() || undefined,
          description: trimmedDescription || undefined,
          timezone: trimmedTimezone || undefined,
          orgLocationTypeKey: trimmedType || undefined,
          tagKeys: tags.length ? tags : undefined,
          parentOrgLocationId: trimmedParent || undefined,
          sortOrder: typeof sortOrder === 'number' ? sortOrder : undefined,
        }),
      })
      setActionMessage(`Org location "${trimmedName}" created.`)
      setName('')
      setAddress('')
      setOrgLocationTypeKey('')
      setTagKeysText('')
      setParentOrgLocationId('')
      setDescription('')
      setTimezone('')
      setSortOrderText('')
      refresh()
    } catch (err: any) {
      setError(err?.message || 'Unable to create org location.')
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
        setActionMessage(archived ? 'Queued org location restore.' : 'Queued org location archive.')
        return
      }

      await apiFetch(`/org-locations/${officeId}/${archived ? 'unarchive' : 'archive'}`, { method: 'POST' })
      setActionMessage(archived ? 'Org location restored.' : 'Org location archived.')
      refresh()
    } catch (err: any) {
      setError(err?.message || 'Unable to update org location state.')
    }
  }

  const closeDetails = () => {
    setSelectedOffice(null)
    setDetailsMessage(null)
    setDetailsError(null)
    setEditingDetails(false)
    setSavingDetails(false)
    setEdgesOut([])
    setEdgesIn([])
    setEdgesError(null)
    setNewEdgeTargetId('')
    setCreatingEdge(false)
  }

  const openDetails = (office: Office) => {
    setSelectedOffice(office)
    setDetailsMessage(null)
    setDetailsError(null)
    setEditingDetails(false)
    setEdgesError(null)
    setNewEdgeTargetId('')
  }

  const selectedOfficeId = selectedOffice?.id || selectedOffice?._id || ''
  const selectedOfficeArchived = !!selectedOffice?.archivedAt
  const selectedOfficeLegalHold = !!selectedOffice?.legalHold
  const canEditSelectedOffice = canManageOffices && !!selectedOfficeId && !selectedOfficeArchived && !selectedOfficeLegalHold && !orgBlocked

  useEffect(() => {
    const applyToForm = (office: Office | null) => {
      setEditingDetails(false)
      setSavingDetails(false)
      setDetailName(office?.name || '')
      setDetailAddress(office?.address || '')
      setDetailTypeKey(office?.orgLocationTypeKey || '')
      setDetailTagsText(joinList(office?.tagKeys))
      setDetailParentId(office?.parentOrgLocationId || '')
      setDetailDescription(office?.description || '')
      setDetailTimezone(office?.timezone || '')
      setDetailSortOrderText(typeof office?.sortOrder === 'number' ? String(office.sortOrder) : '')
    }

    const load = async () => {
      if (!selectedOfficeId) {
        setDetailsMessage(null)
        setDetailsError(null)
        applyToForm(null)
        return
      }

      setDetailsMessage(null)
      setDetailsError(null)

      if (!isOnline) {
        applyToForm(selectedOffice)
        return
      }

      try {
        const office = await apiFetch<Office>(`/org-locations/${selectedOfficeId}?includeArchived=1`)
        setSelectedOffice(office)
        applyToForm(office)
      } catch (err: any) {
        applyToForm(selectedOffice)
        setDetailsError(err instanceof ApiError ? err.message : 'Unable to load org location details.')
      }
    }

    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOfficeId, isOnline])

  useEffect(() => {
    const loadEdges = async () => {
      if (!selectedOfficeId || !canManageEdges) {
        setEdgesOut([])
        setEdgesIn([])
        setEdgesError(null)
        setEdgesLoading(false)
        return
      }

      setEdgesLoading(true)
      setEdgesError(null)

      try {
        const qsFrom = new URLSearchParams()
        qsFrom.set('fromNodeType', 'org_location')
        qsFrom.set('fromNodeId', selectedOfficeId)

        const qsTo = new URLSearchParams()
        qsTo.set('toNodeType', 'org_location')
        qsTo.set('toNodeId', selectedOfficeId)

        const [outRes, inRes] = await Promise.allSettled([
          apiFetch<GraphEdge[]>(`/graph-edges?${qsFrom.toString()}`),
          apiFetch<GraphEdge[]>(`/graph-edges?${qsTo.toString()}`),
        ])

        const outRows = outRes.status === 'fulfilled' && Array.isArray(outRes.value) ? outRes.value : []
        const inRows = inRes.status === 'fulfilled' && Array.isArray(inRes.value) ? inRes.value : []

        const allowed = new Set(['depends_on', 'supports'])
        setEdgesOut(outRows.filter((edge) => allowed.has(edge.edgeTypeKey)))
        setEdgesIn(inRows.filter((edge) => allowed.has(edge.edgeTypeKey)))

        if (outRes.status === 'rejected' || inRes.status === 'rejected') {
          const rejected = outRes.status === 'rejected' ? outRes.reason : inRes.status === 'rejected' ? inRes.reason : null
          setEdgesError(rejected instanceof ApiError ? rejected.message : 'Unable to load dependencies.')
        }
      } catch (err: any) {
        setEdgesError(err instanceof ApiError ? err.message : 'Unable to load dependencies.')
      } finally {
        setEdgesLoading(false)
      }
    }

    void loadEdges()
  }, [selectedOfficeId, canManageEdges, reloadAt])

  const onSaveDetails = async () => {
    if (!selectedOfficeId) return
    if (!canEditSelectedOffice) return
    if (!isOnline) {
      setDetailsError('You are offline. Reconnect to save changes.')
      return
    }

    const trimmedName = detailName.trim()
    if (!trimmedName) {
      setDetailsError('Name is required.')
      return
    }

    const tags = splitList(detailTagsText)
    const trimmedType = detailTypeKey.trim()
    const trimmedParent = detailParentId.trim()
    const trimmedDescription = detailDescription.trim()
    const trimmedTimezone = detailTimezone.trim()
    const sortOrderRaw = detailSortOrderText.trim()
    const sortOrder = sortOrderRaw ? Number(sortOrderRaw) : null
    if (sortOrderRaw && (!Number.isFinite(sortOrder) || !Number.isInteger(sortOrder))) {
      setDetailsError('Sort order must be an integer.')
      return
    }

    setSavingDetails(true)
    setDetailsError(null)
    setDetailsMessage(null)

    try {
      await apiFetch(`/org-locations/${selectedOfficeId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: trimmedName,
          address: detailAddress.trim() || null,
          description: trimmedDescription || null,
          timezone: trimmedTimezone || null,
          orgLocationTypeKey: trimmedType || null,
          tagKeys: tags,
          parentOrgLocationId: trimmedParent || null,
          sortOrder,
        }),
      })

      const refreshed = await apiFetch<Office>(`/org-locations/${selectedOfficeId}?includeArchived=1`)
      setSelectedOffice(refreshed)
      setDetailsMessage('Org location updated.')
      setEditingDetails(false)
      refresh()
    } catch (err: any) {
      setDetailsError(err instanceof ApiError ? err.message : 'Unable to update org location.')
    } finally {
      setSavingDetails(false)
    }
  }

  const onCreateDependency = async () => {
    if (!selectedOfficeId || !canManageEdges) return
    if (!isOnline) {
      setEdgesError('You are offline. Reconnect to add dependencies.')
      return
    }
    if (!newEdgeTargetId) return

    setCreatingEdge(true)
    setEdgesError(null)

    try {
      await apiFetch('/graph-edges', {
        method: 'POST',
        body: JSON.stringify({
          edgeTypeKey: newEdgeType,
          fromNodeType: 'org_location',
          fromNodeId: selectedOfficeId,
          toNodeType: 'org_location',
          toNodeId: newEdgeTargetId,
        }),
      })
      setNewEdgeTargetId('')
      setDetailsMessage('Dependency added.')
      refresh()
    } catch (err: any) {
      setEdgesError(err instanceof ApiError ? err.message : 'Unable to create dependency.')
    } finally {
      setCreatingEdge(false)
    }
  }

  const onArchiveDependency = async (edgeId: string) => {
    if (!edgeId || !canManageEdges) return
    if (!isOnline) {
      setEdgesError('You are offline. Reconnect to remove dependencies.')
      return
    }

    setEdgesError(null)
    try {
      await apiFetch(`/graph-edges/${edgeId}/archive`, { method: 'POST' })
      setDetailsMessage('Dependency removed.')
      refresh()
    } catch (err: any) {
      setEdgesError(err instanceof ApiError ? err.message : 'Unable to remove dependency.')
    }
  }

  return (
    <section className="dashboard-grid">
      <section className="glass-card space-y-4">
        <div className="badge">Org locations</div>
        <div className="space-y-2">
          <h1>{orgName}</h1>
          <p className="subtitle">
            Manage org locations (internal offices and divisions). These help scope projects, reporting, and org structure.
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
          <div className="feedback subtle">You do not have permission to view org locations. Ask an Org Admin for access.</div>
        )}

        {canViewOffices && (
          <>
            {canViewOrgDetails && orgLegalHold && (
              <div className="feedback error">
                Legal hold is enabled for this organization. Org location creation and archival actions are blocked until the hold is lifted.
              </div>
            )}

            {canViewOrgDetails && orgArchived && (
              <div className="feedback error">
                This organization is archived. Org location changes may be restricted. Contact a platform admin if you need access restored.
              </div>
            )}

            {canViewOrgDetails && orgPiiStripped && (
              <div className="feedback subtle">PII stripping is enabled. Some org location fields and audit data may be redacted.</div>
            )}

            {canManageOffices && (
              <form onSubmit={handleCreateOffice} className="space-y-3 rounded-2xl border border-border/60 bg-white/5 p-4">
                <div className="grid gap-3 lg:grid-cols-3">
                  <label className="flex flex-col gap-1 text-sm font-semibold text-[color:var(--text)] lg:col-span-2">
                    Org location name
                    <input
                      name="name"
                      type="text"
                      placeholder="e.g., HQ / North Yard / Fabrication"
                      className="w-full rounded-xl border border-border/60 bg-white/5 px-3 py-2 text-base text-[var(--text)] outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[var(--accent)]"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      disabled={submitting || orgBlocked}
                    />
                  </label>

                  <label className="flex flex-col gap-1 text-sm font-semibold text-[color:var(--text)] lg:col-span-1">
                    Parent (optional)
                    <select
                      className="w-full rounded-xl border border-border/60 bg-white/5 px-3 py-2 text-base text-[var(--text)] outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[var(--accent)]"
                      value={parentOrgLocationId}
                      onChange={(e) => setParentOrgLocationId(e.target.value)}
                      disabled={submitting || orgBlocked}
                    >
                      <option value="">None</option>
                      {offices
                        .filter((office) => !office.archivedAt)
                        .map((office) => {
                          const id = office.id || office._id
                          if (!id) return null
                          return (
                            <option key={id} value={id}>
                              {office.name}
                            </option>
                          )
                        })}
                    </select>
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

                  <label className="flex flex-col gap-1 text-sm font-semibold text-[color:var(--text)] lg:col-span-1">
                    Type (optional)
                    <input
                      name="orgLocationTypeKey"
                      type="text"
                      placeholder="e.g., yard, shop, hq"
                      className="w-full rounded-xl border border-border/60 bg-white/5 px-3 py-2 text-base text-[var(--text)] outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[var(--accent)]"
                      value={orgLocationTypeKey}
                      onChange={(e) => setOrgLocationTypeKey(e.target.value)}
                      disabled={submitting || orgBlocked}
                    />
                  </label>

                  <label className="flex flex-col gap-1 text-sm font-semibold text-[color:var(--text)] lg:col-span-2">
                    Tags <span className="text-muted-foreground font-normal">(comma-separated)</span>
                    <input
                      name="tagKeys"
                      type="text"
                      placeholder="e.g., fabrication, field"
                      className="w-full rounded-xl border border-border/60 bg-white/5 px-3 py-2 text-base text-[var(--text)] outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[var(--accent)]"
                      value={tagKeysText}
                      onChange={(e) => setTagKeysText(e.target.value)}
                      disabled={submitting || orgBlocked}
                    />
                  </label>

                  <label className="flex flex-col gap-1 text-sm font-semibold text-[color:var(--text)] lg:col-span-1">
                    Timezone (optional)
                    <input
                      name="timezone"
                      type="text"
                      placeholder="America/New_York"
                      className="w-full rounded-xl border border-border/60 bg-white/5 px-3 py-2 text-base text-[var(--text)] outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[var(--accent)]"
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      disabled={submitting || orgBlocked}
                    />
                  </label>

                  <label className="flex flex-col gap-1 text-sm font-semibold text-[color:var(--text)] lg:col-span-1">
                    Sort order (optional)
                    <input
                      name="sortOrder"
                      type="number"
                      placeholder="e.g., 10"
                      className="w-full rounded-xl border border-border/60 bg-white/5 px-3 py-2 text-base text-[var(--text)] outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[var(--accent)]"
                      value={sortOrderText}
                      onChange={(e) => setSortOrderText(e.target.value)}
                      disabled={submitting || orgBlocked}
                    />
                  </label>

                  <label className="flex flex-col gap-1 text-sm font-semibold text-[color:var(--text)] lg:col-span-3">
                    Description (optional)
                    <textarea
                      name="description"
                      placeholder="Short description, division notes, etc."
                      className="min-h-[88px] w-full rounded-xl border border-border/60 bg-white/5 px-3 py-2 text-base text-[var(--text)] outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[var(--accent)]"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      disabled={submitting || orgBlocked}
                    />
                  </label>
                </div>

                <button className="btn primary" type="submit" disabled={submitting || name.trim() === '' || orgBlocked}>
                  {submitting ? 'Saving.' : isOnline ? 'Create org location' : 'Queue org location'}
                </button>
              </form>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span>{loading ? 'Loading.' : `${offices.length} org location${offices.length === 1 ? '' : 's'}`}</span>
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
                <div className="inline-flex rounded-xl border border-border/60 bg-white/5 p-1">
                  <button
                    type="button"
                    className={cn('px-3 py-1 text-sm rounded-lg', viewMode === 'table' ? 'bg-white/10 text-[color:var(--text)]' : 'text-muted-foreground')}
                    onClick={() => setViewMode('table')}
                    disabled={loading}
                  >
                    Table
                  </button>
                  <button
                    type="button"
                    className={cn('px-3 py-1 text-sm rounded-lg', viewMode === 'tree' ? 'bg-white/10 text-[color:var(--text)]' : 'text-muted-foreground')}
                    onClick={() => setViewMode('tree')}
                    disabled={loading}
                  >
                    Tree
                  </button>
                </div>

                <button className="btn secondary" type="button" onClick={refresh} disabled={loading}>
                  Refresh
                </button>
              </div>
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
                        ? `Create org location: ${action.payload.name}`
                        : action.type === 'office.archive'
                          ? `Archive org location: ${action.payload.officeId}`
                          : `Restore org location: ${action.payload.officeId}`
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

            {viewMode === 'table' ? (
              <div className="overflow-x-auto rounded-2xl border border-border/60">
                <table className="min-w-full text-sm">
                  <thead className="bg-white/5 text-left text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2">Name</th>
                      <th className="px-4 py-2">Type</th>
                      <th className="px-4 py-2">Parent</th>
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
                      const parentLabel = office.parentOrgLocationId
                        ? officeNameById.get(office.parentOrgLocationId) || office.parentOrgLocationId
                        : '-'
                      return (
                        <tr key={id || office.name} className={cn('border-t border-border/60')}>
                          <td className="px-4 py-2 font-medium text-[color:var(--text)]">{office.name}</td>
                          <td className="px-4 py-2 text-muted-foreground">{office.orgLocationTypeKey || '-'}</td>
                          <td className="px-4 py-2 text-muted-foreground">{parentLabel}</td>
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
                        <td className="px-4 py-4 text-muted-foreground" colSpan={7}>
                          No org locations found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-2xl border border-border/60 overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-white/5 px-4 py-2 text-sm text-muted-foreground">
                  <div>Hierarchy view (parentOrgLocationId)</div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="btn secondary"
                      type="button"
                      onClick={() => setExpandedOfficeIds(new Set(officeTreeAllIds))}
                      disabled={loading || !officeTreeAllIds.length}
                    >
                      Expand all
                    </button>
                    <button
                      className="btn secondary"
                      type="button"
                      onClick={() => setExpandedOfficeIds(new Set())}
                      disabled={loading || !expandedOfficeIds.size}
                    >
                      Collapse all
                    </button>
                  </div>
                </div>

                <div className="divide-y divide-border/60">
                  {officeTree.length === 0 && !loading && <div className="px-4 py-4 text-muted-foreground">No org locations found.</div>}
                  {officeTree.map((node) => {
                    const renderNode = (current: OfficeTreeNode) => {
                      const office = current.office
                      const id = current.id
                      const archived = !!office.archivedAt
                      const canToggle = canManageOffices && !!id && !office.legalHold && !orgBlocked
                      const hasChildren = current.children.length > 0
                      const isExpanded = expandedOfficeIds.has(id)
                      return (
                        <div key={id}>
                          <div className={cn('flex flex-wrap items-center justify-between gap-2 px-4 py-2', archived && 'opacity-70')}>
                            <div className="flex min-w-0 flex-1 items-center gap-2" style={{ paddingLeft: current.depth * 16 }}>
                              {hasChildren ? (
                                <button
                                  type="button"
                                  className="h-7 w-7 rounded-lg border border-border/60 bg-white/5 text-[color:var(--text)]"
                                  onClick={() => {
                                    setExpandedOfficeIds((prev) => {
                                      const next = new Set(prev)
                                      if (next.has(id)) next.delete(id)
                                      else next.add(id)
                                      return next
                                    })
                                  }}
                                  aria-expanded={isExpanded}
                                >
                                  {isExpanded ? '-' : '+'}
                                </button>
                              ) : (
                                <span className="inline-block h-7 w-7" />
                              )}

                              <button
                                type="button"
                                className="min-w-0 truncate text-left font-medium text-[color:var(--text)] hover:underline"
                                onClick={() => openDetails(office)}
                              >
                                {office.name}
                              </button>

                              {office.orgLocationTypeKey && (
                                <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-muted-foreground">
                                  {office.orgLocationTypeKey}
                                </span>
                              )}
                              {archived && <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs">Archived</span>}
                            </div>

                            <div className="flex items-center gap-2">
                              <button className="btn secondary" type="button" onClick={() => openDetails(office)}>
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
                          </div>

                          {hasChildren && isExpanded && <div>{current.children.map((child) => renderNode(child))}</div>}
                        </div>
                      )
                    }

                    return renderNode(node)
                  })}
                </div>
              </div>
            )}

            {!canManageOffices && (
              <div className="feedback subtle">
                You have read-only access to org locations. Ask an Org Admin if you need to create or archive org locations.
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
                <div className="text-sm text-muted-foreground">Org location details, structure, and dependencies.</div>
              </div>
              <div className="flex items-center gap-2">
                {canEditSelectedOffice && (
                  <button
                    className="btn secondary"
                    type="button"
                    onClick={() => {
                      setEditingDetails((prev) => !prev)
                      setDetailsError(null)
                      setDetailsMessage(null)
                    }}
                  >
                    {editingDetails ? 'Cancel edit' : 'Edit'}
                  </button>
                )}
                <button className="btn secondary" type="button" onClick={closeDetails}>
                  Close
                </button>
              </div>
            </div>

            {detailsMessage && <div className="feedback success">{detailsMessage}</div>}
            {detailsError && <div className="feedback error">{detailsError}</div>}

            {selectedOffice.legalHold && (
              <div className="feedback error">This org location is on legal hold. Destructive actions are blocked.</div>
            )}

            {selectedOffice.archivedAt && (
              <div className="feedback subtle">This org location is archived. Restore it to edit fields or dependencies.</div>
            )}

            {!isOnline && <div className="feedback subtle">You are offline. Actions will be queued.</div>}

            <div className="info-grid">
              <div className="info-block">
                <div className="muted">Org location ID</div>
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

            <div className="rounded-2xl border border-border/60 bg-white/5 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold text-[color:var(--text)]">Details</div>
                {!canEditSelectedOffice && (
                  <div className="text-xs text-muted-foreground">
                    {selectedOfficeLegalHold ? 'Legal hold blocks edits.' : selectedOfficeArchived ? 'Restore to edit.' : null}
                  </div>
                )}
              </div>

              <div className="form-grid md:grid-cols-2">
                <label className="md:col-span-2">
                  Org location name
                  <input
                    value={detailName}
                    onChange={(e) => setDetailName(e.target.value)}
                    disabled={!editingDetails || savingDetails || !canEditSelectedOffice}
                  />
                </label>

                <label>
                  Parent
                  <select
                    value={detailParentId}
                    onChange={(e) => setDetailParentId(e.target.value)}
                    disabled={!editingDetails || savingDetails || !canEditSelectedOffice}
                  >
                    <option value="">None</option>
                    {offices
                      .filter((office) => {
                        const id = office.id || office._id
                        if (!id) return false
                        if (id === selectedOfficeId) return false
                        return !office.archivedAt
                      })
                      .map((office) => {
                        const id = office.id || office._id
                        if (!id) return null
                        return (
                          <option key={id} value={id}>
                            {office.name}
                          </option>
                        )
                      })}
                  </select>
                </label>

                <label>
                  Type key
                  <input
                    value={detailTypeKey}
                    onChange={(e) => setDetailTypeKey(e.target.value)}
                    placeholder="e.g., yard, shop, hq"
                    disabled={!editingDetails || savingDetails || !canEditSelectedOffice}
                  />
                </label>

                <label className="md:col-span-2">
                  Address
                  <input
                    value={detailAddress}
                    onChange={(e) => setDetailAddress(e.target.value)}
                    placeholder="Street, City, State"
                    disabled={!editingDetails || savingDetails || !canEditSelectedOffice}
                  />
                </label>

                <label>
                  Timezone
                  <input
                    value={detailTimezone}
                    onChange={(e) => setDetailTimezone(e.target.value)}
                    placeholder="America/New_York"
                    disabled={!editingDetails || savingDetails || !canEditSelectedOffice}
                  />
                </label>

                <label>
                  Sort order
                  <input
                    type="number"
                    value={detailSortOrderText}
                    onChange={(e) => setDetailSortOrderText(e.target.value)}
                    placeholder="e.g., 10"
                    disabled={!editingDetails || savingDetails || !canEditSelectedOffice}
                  />
                </label>

                <label className="md:col-span-2">
                  Tags <span className="muted">(comma-separated)</span>
                  <input
                    value={detailTagsText}
                    onChange={(e) => setDetailTagsText(e.target.value)}
                    placeholder="e.g., fabrication, field"
                    disabled={!editingDetails || savingDetails || !canEditSelectedOffice}
                  />
                </label>

                <label className="md:col-span-2">
                  Description
                  <textarea
                    rows={3}
                    value={detailDescription}
                    onChange={(e) => setDetailDescription(e.target.value)}
                    placeholder="Short description, division notes, etc."
                    disabled={!editingDetails || savingDetails || !canEditSelectedOffice}
                  />
                </label>
              </div>

              {editingDetails && (
                <div className="flex flex-wrap justify-end gap-2">
                  <button className="btn secondary" type="button" onClick={() => setEditingDetails(false)} disabled={savingDetails}>
                    Cancel
                  </button>
                  <button className="btn primary" type="button" onClick={onSaveDetails} disabled={savingDetails || !canEditSelectedOffice}>
                    {savingDetails ? 'Saving.' : 'Save changes'}
                  </button>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border/60 bg-white/5 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold text-[color:var(--text)]">Dependencies</div>
                {edgesLoading && <div className="text-xs text-muted-foreground">Loading.</div>}
              </div>

              {!canManageEdges ? (
                <div className="muted">Dependencies are available to org admins.</div>
              ) : (
                <>
                  {edgesError && <div className="feedback error">{edgesError}</div>}

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <div className="muted">This location links to</div>
                      {edgesOut.length === 0 ? (
                        <div className="muted">No outgoing dependencies.</div>
                      ) : (
                        <div className="space-y-2">
                          {edgesOut.map((edge) => {
                            const edgeId = edge.id || edge._id || ''
                            const label = edge.edgeTypeKey === 'depends_on' ? 'Depends on' : 'Supports'
                            const targetLabel = officeNameById.get(edge.toNodeId) || edge.toNodeId
                            return (
                              <div key={edgeId} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-[color:var(--panel)] px-3 py-2">
                                <div className="min-w-0 text-sm text-[color:var(--text)]">
                                  <span className="font-semibold">{label}:</span> <span className="text-muted-foreground">{targetLabel}</span>
                                </div>
                                <button
                                  type="button"
                                  className="btn secondary"
                                  disabled={!canEditSelectedOffice || !edgeId}
                                  onClick={() => void onArchiveDependency(edgeId)}
                                >
                                  Remove
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="muted">Locations that link to this</div>
                      {edgesIn.length === 0 ? (
                        <div className="muted">No incoming dependencies.</div>
                      ) : (
                        <div className="space-y-2">
                          {edgesIn.map((edge) => {
                            const edgeId = edge.id || edge._id || ''
                            const label = edge.edgeTypeKey === 'depends_on' ? 'Depends on' : 'Supports'
                            const sourceLabel = officeNameById.get(edge.fromNodeId) || edge.fromNodeId
                            return (
                              <div key={edgeId} className="rounded-xl border border-border/60 bg-[color:var(--panel)] px-3 py-2 text-sm text-muted-foreground">
                                <span className="font-semibold text-[color:var(--text)]">{sourceLabel}</span> <span>{label.toLowerCase()} this location</span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="form-grid md:grid-cols-3">
                    <label>
                      Type
                      <select value={newEdgeType} onChange={(e) => setNewEdgeType(e.target.value as any)} disabled={!canEditSelectedOffice || creatingEdge}>
                        <option value="depends_on">depends_on</option>
                        <option value="supports">supports</option>
                      </select>
                    </label>

                    <label className="md:col-span-2">
                      Target org location
                      <select
                        value={newEdgeTargetId}
                        onChange={(e) => setNewEdgeTargetId(e.target.value)}
                        disabled={!canEditSelectedOffice || creatingEdge}
                      >
                        <option value="">Select...</option>
                        {offices
                          .filter((office) => {
                            const id = office.id || office._id
                            if (!id) return false
                            if (id === selectedOfficeId) return false
                            return !office.archivedAt
                          })
                          .map((office) => {
                            const id = office.id || office._id
                            if (!id) return null
                            return (
                              <option key={id} value={id}>
                                {office.name}
                              </option>
                            )
                          })}
                      </select>
                    </label>

                    <div className="md:col-span-3 flex justify-end">
                      <button
                        type="button"
                        className="btn primary"
                        disabled={!canEditSelectedOffice || creatingEdge || !newEdgeTargetId}
                        onClick={() => void onCreateDependency()}
                      >
                        {creatingEdge ? 'Adding.' : 'Add dependency'}
                      </button>
                    </div>
                  </div>
                </>
              )}
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
                  {selectedOffice.archivedAt ? 'Restore org location' : 'Archive org location'}
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
