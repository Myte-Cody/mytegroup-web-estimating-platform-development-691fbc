'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'

import { ApiError, apiFetch } from '../../../../lib/api'
import { hasAnyRole } from '../../../../lib/rbac'
import { cn } from '../../../../lib/utils'

type SessionUser = {
  id?: string
  role?: string
  roles?: string[]
  orgId?: string
}

type NodeType = 'person' | 'org_location' | 'company' | 'company_location'

type GraphEdge = {
  _id?: string
  id?: string
  orgId?: string
  fromNodeType: NodeType
  fromNodeId: string
  toNodeType: NodeType
  toNodeId: string
  edgeTypeKey: string
  metadata?: Record<string, any>
  archivedAt?: string | null
  createdAt?: string
}

type ListResponse<T> = {
  data: T[]
  total: number
  page: number
  limit: number
}

type NodeOption = { id: string; label: string }

type ViewMode = 'table' | 'graph'

type EdgeRule = { from: NodeType; to: NodeType | NodeType[]; label: string }

const EDGE_RULES: Record<string, EdgeRule> = {
  depends_on: { from: 'org_location', to: 'org_location', label: 'depends_on (OrgLocation → OrgLocation)' },
  supports: { from: 'org_location', to: 'org_location', label: 'supports (OrgLocation → OrgLocation)' },
  works_with: { from: 'person', to: 'person', label: 'works_with (Person → Person)' },
  reports_to: { from: 'person', to: 'person', label: 'reports_to (Person → Person)' },
  primary_for: { from: 'person', to: ['company', 'company_location'], label: 'primary_for (Person → Company/Location)' },
}

const labelKey = (type: NodeType, id: string) => `${type}:${id}`

const safeJsonParse = (value: string) => {
  const trimmed = (value || '').trim()
  if (!trimmed) return { ok: true as const, value: undefined as any }
  try {
    const parsed = JSON.parse(trimmed)
    if (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object') {
      return { ok: false as const, error: 'Metadata must be a JSON object.' }
    }
    return { ok: true as const, value: parsed }
  } catch (err: any) {
    return { ok: false as const, error: err?.message || 'Invalid JSON.' }
  }
}

const truncateLabel = (value: string, max = 36) => {
  const text = (value || '').trim()
  if (text.length <= max) return text
  return `${text.slice(0, Math.max(0, max - 1))}…`
}

export default function GraphEdgesExplorerPage() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canManage = useMemo(() => hasAnyRole(user, ['admin']), [user])
  const [viewMode, setViewMode] = useState<ViewMode>('table')

  const [edgeTypeKey, setEdgeTypeKey] = useState<string>('depends_on')
  const rule = EDGE_RULES[edgeTypeKey] || EDGE_RULES.depends_on

  const [toNodeTypeChoice, setToNodeTypeChoice] = useState<NodeType>(
    Array.isArray(rule.to) ? (rule.to[0] as NodeType) : (rule.to as NodeType)
  )

  useEffect(() => {
    if (Array.isArray(rule.to)) {
      if (!rule.to.includes(toNodeTypeChoice)) setToNodeTypeChoice(rule.to[0] as NodeType)
    } else {
      setToNodeTypeChoice(rule.to as NodeType)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edgeTypeKey])

  const fromNodeType = rule.from
  const toNodeType: NodeType = Array.isArray(rule.to) ? toNodeTypeChoice : (rule.to as NodeType)

  const [fromSearch, setFromSearch] = useState('')
  const [toSearch, setToSearch] = useState('')
  const [fromOptions, setFromOptions] = useState<NodeOption[]>([])
  const [toOptions, setToOptions] = useState<NodeOption[]>([])
  const [fromNodeId, setFromNodeId] = useState('')
  const [toNodeId, setToNodeId] = useState('')
  const [metadataText, setMetadataText] = useState('')
  const [creating, setCreating] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  const [includeArchived, setIncludeArchived] = useState(false)
  const [filterFromNodeId, setFilterFromNodeId] = useState('')
  const [filterToNodeId, setFilterToNodeId] = useState('')
  const [edges, setEdges] = useState<GraphEdge[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [reloadAt, setReloadAt] = useState(0)
  const limit = 25

  const [graphLoading, setGraphLoading] = useState(false)
  const [graphEdges, setGraphEdges] = useState<GraphEdge[]>([])
  const [graphTotal, setGraphTotal] = useState(0)
  const [selectedGraphEdgeId, setSelectedGraphEdgeId] = useState<string | null>(null)
  const graphLimit = 200

  const [nodeLabels, setNodeLabels] = useState<Record<string, string>>({})

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit])
  const selectedGraphEdge = useMemo(() => {
    if (!selectedGraphEdgeId) return null
    return graphEdges.find((edge) => (edge.id || edge._id) === selectedGraphEdgeId) || null
  }, [selectedGraphEdgeId, graphEdges])

  const graphLayout = useMemo(() => {
    const rows = graphEdges || []
    const fromIds = Array.from(new Set(rows.map((e) => (e.fromNodeId || '').trim()).filter(Boolean)))
    const toIds = Array.from(new Set(rows.map((e) => (e.toNodeId || '').trim()).filter(Boolean)))

    const getLabel = (type: NodeType, id: string) => nodeLabels[labelKey(type, id)] || id

    const fromNodes = fromIds
      .map((nodeId) => ({ id: nodeId, label: getLabel(fromNodeType, nodeId) }))
      .sort((a, b) => a.label.localeCompare(b.label))
    const toNodes = toIds
      .map((nodeId) => ({ id: nodeId, label: getLabel(toNodeType, nodeId) }))
      .sort((a, b) => a.label.localeCompare(b.label))

    const NODE_W = 300
    const NODE_H = 44
    const ROW_GAP = 16
    const COL_GAP = 180
    const PAD = 24

    const xFrom = PAD
    const xTo = PAD + NODE_W + COL_GAP

    const fromPos: Record<string, { x: number; y: number }> = {}
    fromNodes.forEach((node, idx) => {
      fromPos[node.id] = { x: xFrom, y: PAD + idx * (NODE_H + ROW_GAP) }
    })

    const toPos: Record<string, { x: number; y: number }> = {}
    toNodes.forEach((node, idx) => {
      toPos[node.id] = { x: xTo, y: PAD + idx * (NODE_H + ROW_GAP) }
    })

    const height = PAD * 2 + Math.max(fromNodes.length, toNodes.length) * (NODE_H + ROW_GAP)
    const width = xTo + NODE_W + PAD

    return { NODE_W, NODE_H, xFrom, xTo, width, height, fromNodes, toNodes, fromPos, toPos }
  }, [graphEdges, nodeLabels, fromNodeType, toNodeType])

  useEffect(() => {
    if (viewMode !== 'graph') return
    if (!selectedGraphEdgeId) return
    const exists = graphEdges.some((edge) => (edge.id || edge._id) === selectedGraphEdgeId)
    if (!exists) setSelectedGraphEdgeId(null)
  }, [viewMode, selectedGraphEdgeId, graphEdges])

  const refresh = () => setReloadAt(Date.now())

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const me = await apiFetch<{ user?: SessionUser }>('/auth/me')
        const currentUser = me?.user || null
        setUser(currentUser)
        if (!currentUser?.id) {
          setError('You need to sign in to manage relationships.')
          return
        }
        if (!hasAnyRole(currentUser, ['admin'])) {
          setError('Org admin access required to manage graph edges.')
          return
        }
      } catch (err: any) {
        setError(err instanceof ApiError ? err.message : 'Unable to load session.')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  const fetchNodeOptions = async (nodeType: NodeType, term: string): Promise<NodeOption[]> => {
    const search = (term || '').trim()
    if (!search) return []
    const qs = new URLSearchParams()
    qs.set('search', search)
    qs.set('page', '1')
    qs.set('limit', '10')
    qs.set('includeArchived', '1')

    if (nodeType === 'person') {
      const res = await apiFetch<ListResponse<any> | any[]>(`/persons?${qs.toString()}`)
      const rows = Array.isArray(res) ? res : res.data
      return (rows || [])
        .map((p: any) => {
          const id = p.id || p._id
          if (!id) return null
          const label = p.displayName || p.primaryEmail || id
          return { id, label } as NodeOption
        })
        .filter(Boolean) as NodeOption[]
    }

    if (nodeType === 'company') {
      const res = await apiFetch<ListResponse<any> | any[]>(`/companies?${qs.toString()}`)
      const rows = Array.isArray(res) ? res : res.data
      return (rows || [])
        .map((c: any) => {
          const id = c.id || c._id
          if (!id) return null
          const label = c.name || id
          return { id, label } as NodeOption
        })
        .filter(Boolean) as NodeOption[]
    }

    if (nodeType === 'company_location') {
      const res = await apiFetch<ListResponse<any> | any[]>(`/company-locations?${qs.toString()}`)
      const rows = Array.isArray(res) ? res : res.data
      return (rows || [])
        .map((loc: any) => {
          const id = loc.id || loc._id
          if (!id) return null
          const label = loc.name || id
          return { id, label } as NodeOption
        })
        .filter(Boolean) as NodeOption[]
    }

    const res = await apiFetch<ListResponse<any> | any[]>(`/org-locations?${qs.toString()}`)
    const rows = Array.isArray(res) ? res : res.data
    return (rows || [])
      .map((loc: any) => {
        const id = loc.id || loc._id
        if (!id) return null
        const label = loc.name || id
        return { id, label } as NodeOption
      })
      .filter(Boolean) as NodeOption[]
  }

  const fetchNodeLabel = async (nodeType: NodeType, nodeId: string) => {
    const id = (nodeId || '').trim()
    if (!id) return ''
    const cacheKey = labelKey(nodeType, id)
    if (nodeLabels[cacheKey]) return nodeLabels[cacheKey]

    try {
      const includeArchivedParam = 'includeArchived=1'
      if (nodeType === 'person') {
        const res = await apiFetch<any>(`/persons/${id}?${includeArchivedParam}`)
        return res?.displayName || res?.primaryEmail || id
      }
      if (nodeType === 'company') {
        const res = await apiFetch<any>(`/companies/${id}?${includeArchivedParam}`)
        return res?.name || id
      }
      if (nodeType === 'company_location') {
        const res = await apiFetch<any>(`/company-locations/${id}?${includeArchivedParam}`)
        return res?.name || id
      }
      const res = await apiFetch<any>(`/org-locations/${id}?${includeArchivedParam}`)
      return res?.name || id
    } catch {
      return id
    }
  }

  useEffect(() => {
    if (!canManage) return
    const loadEdges = async () => {
      setLoading(true)
      setError(null)
      try {
        const qs = new URLSearchParams()
        qs.set('edgeTypeKey', edgeTypeKey)
        qs.set('fromNodeType', fromNodeType)
        qs.set('toNodeType', toNodeType)
        qs.set('page', String(page))
        qs.set('limit', String(limit))
        if (includeArchived) qs.set('includeArchived', '1')
        if (filterFromNodeId.trim()) qs.set('fromNodeId', filterFromNodeId.trim())
        if (filterToNodeId.trim()) qs.set('toNodeId', filterToNodeId.trim())

        const res = await apiFetch<ListResponse<GraphEdge> | GraphEdge[]>(`/graph-edges?${qs.toString()}`)
        const rows = Array.isArray(res) ? res : res.data
        const totalCount = Array.isArray(res) ? rows.length : res.total
        setEdges(rows || [])
        setTotal(typeof totalCount === 'number' ? totalCount : 0)

        const missing = new Map<string, { type: NodeType; id: string }>()
        ;(rows || []).forEach((edge) => {
          const a = labelKey(edge.fromNodeType, edge.fromNodeId)
          if (!nodeLabels[a]) missing.set(a, { type: edge.fromNodeType, id: edge.fromNodeId })
          const b = labelKey(edge.toNodeType, edge.toNodeId)
          if (!nodeLabels[b]) missing.set(b, { type: edge.toNodeType, id: edge.toNodeId })
        })

        if (missing.size) {
          const entries = Array.from(missing.values())
          const resolved = await Promise.all(entries.map((entry) => fetchNodeLabel(entry.type, entry.id)))
          const updates: Record<string, string> = {}
          entries.forEach((entry, idx) => {
            updates[labelKey(entry.type, entry.id)] = resolved[idx] || entry.id
          })
          setNodeLabels((prev) => ({ ...prev, ...updates }))
        }
      } catch (err: any) {
        setError(err instanceof ApiError ? err.message : 'Unable to load edges.')
      } finally {
        setLoading(false)
      }
    }

    void loadEdges()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage, edgeTypeKey, fromNodeType, toNodeType, includeArchived, filterFromNodeId, filterToNodeId, page, reloadAt])

  useEffect(() => {
    if (!canManage) return
    if (viewMode !== 'graph') return

    const loadGraph = async () => {
      setGraphLoading(true)
      setError(null)
      try {
        const qs = new URLSearchParams()
        qs.set('edgeTypeKey', edgeTypeKey)
        qs.set('fromNodeType', fromNodeType)
        qs.set('toNodeType', toNodeType)
        qs.set('page', '1')
        qs.set('limit', String(graphLimit))
        if (includeArchived) qs.set('includeArchived', '1')
        if (filterFromNodeId.trim()) qs.set('fromNodeId', filterFromNodeId.trim())
        if (filterToNodeId.trim()) qs.set('toNodeId', filterToNodeId.trim())

        const res = await apiFetch<ListResponse<GraphEdge>>(`/graph-edges?${qs.toString()}`)
        const rows = Array.isArray(res?.data) ? res.data : []
        setGraphEdges(rows)
        setGraphTotal(typeof res?.total === 'number' ? res.total : rows.length)

        const missing = new Map<string, { type: NodeType; id: string }>()
        rows.forEach((edge) => {
          const a = labelKey(edge.fromNodeType, edge.fromNodeId)
          if (!nodeLabels[a]) missing.set(a, { type: edge.fromNodeType, id: edge.fromNodeId })
          const b = labelKey(edge.toNodeType, edge.toNodeId)
          if (!nodeLabels[b]) missing.set(b, { type: edge.toNodeType, id: edge.toNodeId })
        })

        if (missing.size) {
          const entries = Array.from(missing.values())
          const resolved = await Promise.all(entries.map((entry) => fetchNodeLabel(entry.type, entry.id)))
          const updates: Record<string, string> = {}
          entries.forEach((entry, idx) => {
            updates[labelKey(entry.type, entry.id)] = resolved[idx] || entry.id
          })
          setNodeLabels((prev) => ({ ...prev, ...updates }))
        }
      } catch (err: any) {
        setError(err instanceof ApiError ? err.message : 'Unable to load graph view.')
      } finally {
        setGraphLoading(false)
      }
    }

    void loadGraph()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage, viewMode, edgeTypeKey, fromNodeType, toNodeType, includeArchived, filterFromNodeId, filterToNodeId, reloadAt])

  const onSearchFrom = async () => {
    setActionMessage(null)
    setError(null)
    try {
      const options = await fetchNodeOptions(fromNodeType, fromSearch)
      setFromOptions(options)
      if (options.length === 1) setFromNodeId(options[0].id)
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Unable to search from nodes.')
    }
  }

  const onSearchTo = async () => {
    setActionMessage(null)
    setError(null)
    try {
      const options = await fetchNodeOptions(toNodeType, toSearch)
      setToOptions(options)
      if (options.length === 1) setToNodeId(options[0].id)
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Unable to search to nodes.')
    }
  }

  const onCreate = async (event: FormEvent) => {
    event.preventDefault()
    if (!canManage) return
    const fromId = fromNodeId.trim()
    const toId = toNodeId.trim()
    if (!fromId || !toId) return

    const parsed = safeJsonParse(metadataText)
    if (!parsed.ok) {
      setError(parsed.error)
      return
    }

    setCreating(true)
    setError(null)
    setActionMessage(null)
    try {
      await apiFetch('/graph-edges', {
        method: 'POST',
        body: JSON.stringify({
          edgeTypeKey,
          fromNodeType,
          fromNodeId: fromId,
          toNodeType,
          toNodeId: toId,
          metadata: parsed.value ?? undefined,
        }),
      })
      setActionMessage('Edge created.')
      setMetadataText('')
      refresh()
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Unable to create edge.')
    } finally {
      setCreating(false)
    }
  }

  const onArchiveToggle = async (edge: GraphEdge) => {
    const edgeId = edge.id || edge._id
    if (!edgeId || !canManage) return
    setError(null)
    setActionMessage(null)
    try {
      const endpoint = edge.archivedAt ? 'unarchive' : 'archive'
      await apiFetch(`/graph-edges/${edgeId}/${endpoint}`, { method: 'POST' })
      setActionMessage(edge.archivedAt ? 'Edge restored.' : 'Edge archived.')
      refresh()
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Unable to update edge.')
    }
  }

  const applySelectedToFilters = () => {
    setFilterFromNodeId(fromNodeId.trim())
    setFilterToNodeId(toNodeId.trim())
    setPage(1)
  }

  const clearFilters = () => {
    setFilterFromNodeId('')
    setFilterToNodeId('')
    setPage(1)
  }

  return (
    <section className="space-y-6">
      <div className="glass-card space-y-3">
        <div className="badge">Org Settings</div>
        <h1>Graph edges</h1>
        <p className="subtitle">
          Create and manage CRM relationships across People, Companies, Company Locations, and Org Locations.
        </p>

        {loading && <div className="feedback subtle">Loading.</div>}
        {actionMessage && <div className="feedback success">{actionMessage}</div>}
        {error && <div className={cn('feedback error')}>{error}</div>}
      </div>

      {canManage && (
        <form onSubmit={onCreate} className="glass-card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2>Create edge</h2>
            <div className="muted">Uses `OrgTaxonomy(edge_type)` + server-side rules to enforce valid pairs.</div>
          </div>

          <div className="form-grid md:grid-cols-2">
            <label>
              Edge type
              <select
                value={edgeTypeKey}
                onChange={(e) => {
                  setEdgeTypeKey(e.target.value)
                  setPage(1)
                }}
              >
                {Object.entries(EDGE_RULES).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              To node type
              <select
                value={toNodeType}
                onChange={(e) => {
                  setToNodeTypeChoice(e.target.value as NodeType)
                  setPage(1)
                }}
                disabled={!Array.isArray(rule.to)}
              >
                {(Array.isArray(rule.to) ? rule.to : [rule.to]).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>

            <div className="space-y-2">
              <div className="muted">From ({fromNodeType})</div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={fromSearch}
                  onChange={(e) => setFromSearch(e.target.value)}
                  placeholder="Search by name/email"
                  className="min-w-[220px]"
                />
                <button type="button" className="btn secondary" onClick={() => void onSearchFrom()}>
                  Search
                </button>
              </div>
              <select value={fromNodeId} onChange={(e) => setFromNodeId(e.target.value)}>
                <option value="">Select a from node</option>
                {fromOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="muted text-xs">Selected: {fromNodeId || '—'}</div>
            </div>

            <div className="space-y-2">
              <div className="muted">To ({toNodeType})</div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={toSearch}
                  onChange={(e) => setToSearch(e.target.value)}
                  placeholder="Search by name"
                  className="min-w-[220px]"
                />
                <button type="button" className="btn secondary" onClick={() => void onSearchTo()}>
                  Search
                </button>
              </div>
              <select value={toNodeId} onChange={(e) => setToNodeId(e.target.value)}>
                <option value="">Select a to node</option>
                {toOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="muted text-xs">Selected: {toNodeId || '—'}</div>
            </div>

            <label className="md:col-span-2">
              Metadata (JSON object)
              <textarea
                value={metadataText}
                onChange={(e) => setMetadataText(e.target.value)}
                rows={4}
                placeholder='Optional. Example: { "priority": 1 }'
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" className="btn primary" disabled={creating || !fromNodeId.trim() || !toNodeId.trim()}>
              {creating ? 'Creating.' : 'Create edge'}
            </button>
            <button type="button" className="btn secondary" onClick={applySelectedToFilters} disabled={!fromNodeId && !toNodeId}>
              Filter list to selected
            </button>
            <button type="button" className="btn secondary" onClick={clearFilters} disabled={!filterFromNodeId && !filterToNodeId}>
              Clear filters
            </button>
          </div>
        </form>
      )}

      {canManage && (
        <div className="glass-card space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-1">
              <h2>Edges</h2>
              <div className="muted">
                {viewMode === 'table' ? (
                  <>
                    Page {page} of {totalPages} · {total} edges
                  </>
                ) : (
                  <>
                    Showing {graphEdges.length} of {graphTotal} edges{graphTotal > graphLimit ? ` (first ${graphLimit})` : ''}
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={cn('btn', viewMode === 'table' ? 'primary' : 'secondary')}
                onClick={() => setViewMode('table')}
              >
                Table
              </button>
              <button
                type="button"
                className={cn('btn', viewMode === 'graph' ? 'primary' : 'secondary')}
                onClick={() => setViewMode('graph')}
              >
                Graph
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(e) => {
                  setIncludeArchived(e.target.checked)
                  setPage(1)
                }}
              />
              Include archived
            </label>

            <label className="flex items-center gap-2 text-sm">
              From node id
              <input
                value={filterFromNodeId}
                onChange={(e) => {
                  setFilterFromNodeId(e.target.value)
                  setPage(1)
                }}
                placeholder="optional"
                className="min-w-[220px]"
              />
            </label>

            <label className="flex items-center gap-2 text-sm">
              To node id
              <input
                value={filterToNodeId}
                onChange={(e) => {
                  setFilterToNodeId(e.target.value)
                  setPage(1)
                }}
                placeholder="optional"
                className="min-w-[220px]"
              />
            </label>

            {viewMode === 'table' ? (
              <div className="ml-auto flex items-center gap-2">
                <button type="button" className="btn secondary" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                  Prev
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Next
                </button>
              </div>
            ) : (
              <div className="ml-auto muted text-sm">
                {graphTotal > graphLimit ? `Use filters to narrow; table view paginates beyond ${graphLimit}.` : null}
              </div>
            )}
          </div>

          {viewMode === 'table' ? (
            edges.length === 0 ? (
              <div className="muted">No edges found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table w-full">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>From</th>
                      <th>To</th>
                      <th>Status</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {edges.map((edge) => {
                      const id = edge.id || edge._id || `${edge.fromNodeId}:${edge.toNodeId}`
                      const fromLabel = nodeLabels[labelKey(edge.fromNodeType, edge.fromNodeId)] || edge.fromNodeId
                      const toLabel = nodeLabels[labelKey(edge.toNodeType, edge.toNodeId)] || edge.toNodeId
                      const archived = !!edge.archivedAt
                      return (
                        <tr key={id} className={cn(archived && 'opacity-70')}>
                          <td className="muted">{edge.edgeTypeKey}</td>
                          <td>
                            <div className="space-y-1">
                              <div className="font-semibold text-[color:var(--text)]">{fromLabel}</div>
                              <div className="muted text-xs">{edge.fromNodeType}</div>
                            </div>
                          </td>
                          <td>
                            <div className="space-y-1">
                              <div className="font-semibold text-[color:var(--text)]">{toLabel}</div>
                              <div className="muted text-xs">{edge.toNodeType}</div>
                            </div>
                          </td>
                          <td>{archived ? 'Archived' : 'Active'}</td>
                          <td className="text-right">
                            <button type="button" className="btn secondary" onClick={() => void onArchiveToggle(edge)}>
                              {archived ? 'Restore' : 'Archive'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : graphLoading ? (
            <div className="feedback subtle">Loading graph.</div>
          ) : graphEdges.length === 0 ? (
            <div className="muted">No edges found.</div>
          ) : (
            <div className="space-y-3">
              <div className="muted text-sm">
                Left = from ({fromNodeType}) · right = to ({toNodeType}). Click a node to filter; click an edge to manage status.
              </div>

              <div className="overflow-auto rounded-2xl border border-border/60 bg-white/5 p-4">
                <svg
                  width={graphLayout.width}
                  height={graphLayout.height}
                  viewBox={`0 0 ${graphLayout.width} ${graphLayout.height}`}
                  className="text-[color:var(--text)]"
                >
                  <defs>
                    <marker id="arrow-active" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="#38bdf8" />
                    </marker>
                    <marker id="arrow-archived" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
                    </marker>
                    <marker id="arrow-selected" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b" />
                    </marker>
                  </defs>

                  <text x={graphLayout.xFrom} y={16} fontSize={12} fill="currentColor" opacity={0.7}>
                    From ({fromNodeType})
                  </text>
                  <text x={graphLayout.xTo} y={16} fontSize={12} fill="currentColor" opacity={0.7}>
                    To ({toNodeType})
                  </text>

                  {graphEdges.map((edge) => {
                    const edgeId = (edge.id || edge._id || '').trim() || `${edge.fromNodeId}:${edge.toNodeId}`
                    const from = graphLayout.fromPos[edge.fromNodeId]
                    const to = graphLayout.toPos[edge.toNodeId]
                    if (!from || !to) return null

                    const archived = !!edge.archivedAt
                    const selected = selectedGraphEdgeId === (edge.id || edge._id)
                    const stroke = selected ? '#f59e0b' : archived ? '#94a3b8' : '#38bdf8'
                    const marker = selected ? 'url(#arrow-selected)' : archived ? 'url(#arrow-archived)' : 'url(#arrow-active)'

                    const x1 = from.x + graphLayout.NODE_W
                    const y1 = from.y + graphLayout.NODE_H / 2
                    const x2 = to.x
                    const y2 = to.y + graphLayout.NODE_H / 2

                    return (
                      <line
                        key={`edge:${edgeId}`}
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke={stroke}
                        strokeWidth={selected ? 3 : 2}
                        markerEnd={marker}
                        opacity={archived ? 0.5 : 0.85}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setSelectedGraphEdgeId(edge.id || edge._id || null)}
                      />
                    )
                  })}

                  {graphLayout.fromNodes.map((node) => {
                    const pos = graphLayout.fromPos[node.id]
                    const selected = filterFromNodeId.trim() === node.id
                    const fill = selected ? 'rgba(56,189,248,0.18)' : 'rgba(255,255,255,0.06)'
                    const stroke = selected ? '#38bdf8' : 'rgba(148,163,184,0.5)'
                    return (
                      <g
                        key={`from:${node.id}`}
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                          setFilterFromNodeId(node.id)
                          setPage(1)
                        }}
                      >
                        <rect x={pos.x} y={pos.y} width={graphLayout.NODE_W} height={graphLayout.NODE_H} rx={12} ry={12} fill={fill} stroke={stroke} />
                        <text x={pos.x + 12} y={pos.y + 28} fontSize={14} fill="currentColor">
                          {truncateLabel(node.label)}
                        </text>
                      </g>
                    )
                  })}

                  {graphLayout.toNodes.map((node) => {
                    const pos = graphLayout.toPos[node.id]
                    const selected = filterToNodeId.trim() === node.id
                    const fill = selected ? 'rgba(56,189,248,0.18)' : 'rgba(255,255,255,0.06)'
                    const stroke = selected ? '#38bdf8' : 'rgba(148,163,184,0.5)'
                    return (
                      <g
                        key={`to:${node.id}`}
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                          setFilterToNodeId(node.id)
                          setPage(1)
                        }}
                      >
                        <rect x={pos.x} y={pos.y} width={graphLayout.NODE_W} height={graphLayout.NODE_H} rx={12} ry={12} fill={fill} stroke={stroke} />
                        <text x={pos.x + 12} y={pos.y + 28} fontSize={14} fill="currentColor">
                          {truncateLabel(node.label)}
                        </text>
                      </g>
                    )
                  })}
                </svg>
              </div>

              {selectedGraphEdge && (
                <div className="rounded-2xl border border-border/60 bg-white/5 p-4 flex flex-wrap items-center justify-between gap-2">
                  <div className="space-y-1">
                    <div className="font-semibold text-[color:var(--text)]">
                      {nodeLabels[labelKey(selectedGraphEdge.fromNodeType, selectedGraphEdge.fromNodeId)] || selectedGraphEdge.fromNodeId} {'→'}{' '}
                      {nodeLabels[labelKey(selectedGraphEdge.toNodeType, selectedGraphEdge.toNodeId)] || selectedGraphEdge.toNodeId}
                    </div>
                    <div className="muted text-xs">
                      {selectedGraphEdge.edgeTypeKey} · {selectedGraphEdge.archivedAt ? 'Archived' : 'Active'}
                    </div>
                  </div>
                  <button type="button" className="btn secondary" onClick={() => void onArchiveToggle(selectedGraphEdge)}>
                    {selectedGraphEdge.archivedAt ? 'Restore' : 'Archive'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
