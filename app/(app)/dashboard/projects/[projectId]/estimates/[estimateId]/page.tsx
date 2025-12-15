'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { FormEvent, useEffect, useMemo, useState } from 'react'

import { ApiError, apiFetch } from '../../../../../../lib/api'
import { hasAnyRole } from '../../../../../../lib/rbac'

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

type EstimateLineItem = {
  code?: string
  description?: string
  quantity?: number
  unit?: string
  unitCost?: number
  total?: number
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
  lineItems?: EstimateLineItem[]
  revision?: number
  archivedAt?: string | null
  piiStripped?: boolean
  legalHold?: boolean
  createdAt?: string
  updatedAt?: string
}

type LineItemDraft = {
  id: string
  code: string
  description: string
  quantity: string
  unit: string
  unitCost: string
}

const makeId = () => {
  const cryptoRef = (globalThis as any).crypto
  if (cryptoRef?.randomUUID) return cryptoRef.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

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

const toDraft = (item: EstimateLineItem): LineItemDraft => {
  return {
    id: makeId(),
    code: item.code || '',
    description: item.description || '',
    quantity: typeof item.quantity === 'number' ? String(item.quantity) : '',
    unit: item.unit || '',
    unitCost: typeof item.unitCost === 'number' ? String(item.unitCost) : '',
  }
}

const toPayloadNumber = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) return undefined
  return parsed
}

const computeLineTotal = (item: LineItemDraft) => {
  const qty = toPayloadNumber(item.quantity)
  const cost = toPayloadNumber(item.unitCost)
  if (qty === undefined || cost === undefined) return 0
  return qty * cost
}

export default function EstimateDetailPage() {
  const params = useParams()
  const projectIdRaw = (params as any)?.projectId
  const estimateIdRaw = (params as any)?.estimateId
  const projectId = Array.isArray(projectIdRaw) ? projectIdRaw[0] : projectIdRaw || ''
  const estimateId = Array.isArray(estimateIdRaw) ? estimateIdRaw[0] : estimateIdRaw || ''

  const [user, setUser] = useState<SessionUser | null>(null)
  const [org, setOrg] = useState<Organization | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [estimate, setEstimate] = useState<Estimate | null>(null)

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [reloadAt, setReloadAt] = useState(0)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<'draft' | 'final'>('draft')
  const [lineItems, setLineItems] = useState<LineItemDraft[]>([])
  const [lineItemsDirty, setLineItemsDirty] = useState(false)

  const canViewEstimate = useMemo(() => hasAnyRole(user, ['estimator', 'pm', 'admin']), [user])
  const canManageEstimate = canViewEstimate
  const canViewArchived = useMemo(() => hasAnyRole(user, ['admin']), [user])
  const canViewOrgDetails = canViewArchived

  const orgBlocked = !!org?.archivedAt || !!org?.legalHold
  const projectBlocked = !!project?.archivedAt || !!project?.legalHold
  const estimateBlocked = !!estimate?.archivedAt || !!estimate?.legalHold
  const editingBlocked = orgBlocked || projectBlocked || estimateBlocked

  const refresh = () => setReloadAt(Date.now())

  useEffect(() => {
    const load = async () => {
      if (!projectId || !estimateId) return
      setLoading(true)
      setError(null)
      setActionMessage(null)

      try {
        const me = await apiFetch<{ user?: SessionUser }>('/auth/me')
        const currentUser = me?.user || null
        setUser(currentUser)
        setOrg(null)
        setProject(null)
        setEstimate(null)

        if (!currentUser?.id) {
          setError('You need to sign in to view this estimate.')
          return
        }
        if (!hasAnyRole(currentUser, ['estimator', 'pm', 'admin'])) {
          setError('You do not have access to project estimates.')
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

        let estimateRes: Estimate | null = null
        try {
          estimateRes = await apiFetch<Estimate>(`/projects/${projectId}/estimates/${estimateId}`)
        } catch (err: any) {
          if (err instanceof ApiError && err.status === 404 && canViewArchived) {
            estimateRes = await apiFetch<Estimate>(`/projects/${projectId}/estimates/${estimateId}?includeArchived=1`)
          } else {
            throw err
          }
        }

        setEstimate(estimateRes)
        setName(estimateRes?.name || '')
        setDescription(estimateRes?.description || '')
        setNotes(estimateRes?.notes || '')
        setStatus(estimateRes?.status === 'final' ? 'final' : 'draft')
        setLineItems((estimateRes?.lineItems || []).map(toDraft))
        setLineItemsDirty(false)
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.status === 401 || err.status === 403
              ? 'You need a valid session to view this estimate.'
              : err.message
            : 'Unable to load estimate.'
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [projectId, estimateId, canViewArchived, reloadAt])

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!projectId || !estimateId) return
    if (!canManageEstimate) return
    if (editingBlocked) return

    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Estimate name is required.')
      return
    }

    setSaving(true)
    setError(null)
    setActionMessage(null)
    try {
      const payload: Record<string, any> = {
        name: trimmedName,
        description,
        notes,
        status,
      }

      if (lineItemsDirty) {
        payload.lineItems = lineItems
          .map((item) => ({
            code: item.code.trim() || undefined,
            description: item.description.trim() || undefined,
            quantity: toPayloadNumber(item.quantity),
            unit: item.unit.trim() || undefined,
            unitCost: toPayloadNumber(item.unitCost),
          }))
          .filter((item) => {
            return (
              item.code ||
              item.description ||
              item.quantity !== undefined ||
              item.unit ||
              item.unitCost !== undefined
            )
          })
      }

      const updated = await apiFetch<Estimate>(`/projects/${projectId}/estimates/${estimateId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })

      setEstimate(updated)
      setName(updated.name || '')
      setDescription(updated.description || '')
      setNotes(updated.notes || '')
      setStatus(updated.status === 'final' ? 'final' : 'draft')
      setLineItems((updated.lineItems || []).map(toDraft))
      setLineItemsDirty(false)
      setActionMessage('Estimate saved.')
    } catch (err: any) {
      setError(err?.message || 'Unable to save estimate.')
    } finally {
      setSaving(false)
    }
  }

  const addLineItem = () => {
    setLineItemsDirty(true)
    setLineItems((prev) => [
      ...prev,
      { id: makeId(), code: '', description: '', quantity: '', unit: '', unitCost: '' },
    ])
  }

  const updateLineItem = (id: string, next: Partial<LineItemDraft>) => {
    setLineItemsDirty(true)
    setLineItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...next } : item)))
  }

  const removeLineItem = (id: string) => {
    setLineItemsDirty(true)
    setLineItems((prev) => prev.filter((item) => item.id !== id))
  }

  const archiveToggle = async () => {
    if (!projectId || !estimateId) return
    if (!canManageEstimate) return
    if (orgBlocked || projectBlocked) return
    if (estimate?.legalHold) return

    setSaving(true)
    setError(null)
    setActionMessage(null)
    try {
      const archived = !!estimate?.archivedAt
      await apiFetch(`/projects/${projectId}/estimates/${estimateId}/${archived ? 'unarchive' : 'archive'}`, { method: 'POST' })
      setActionMessage(archived ? 'Estimate restored.' : 'Estimate archived.')
      refresh()
    } catch (err: any) {
      setError(err?.message || 'Unable to update estimate state.')
    } finally {
      setSaving(false)
    }
  }

  const lineItemsTotal = useMemo(() => {
    return lineItems.reduce((sum, item) => sum + computeLineTotal(item), 0)
  }, [lineItems])

  const title = estimate?.name ? estimate.name : 'Estimate'

  return (
    <section className="dashboard-grid">
      <section className="glass-card space-y-4">
        <div className="badge">Estimate</div>
        <div className="space-y-2">
          <h1>{title}</h1>
          <p className="subtitle">Review and edit estimate details and line items.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link className="btn secondary" href={`/dashboard/projects/${projectId}/estimates`}>
            Back to estimates
          </Link>
          <Link className="btn secondary" href="/dashboard/projects">
            Projects
          </Link>
          <button className="btn secondary" type="button" onClick={refresh} disabled={loading}>
            Refresh
          </button>
        </div>

        {actionMessage && <div className="feedback success">{actionMessage}</div>}
        {error && <div className="feedback error">{error}</div>}

        {estimate?.legalHold && <div className="feedback error">This estimate is on legal hold. Writes are blocked.</div>}
        {estimate?.archivedAt && <div className="feedback subtle">This estimate is archived. Edits are blocked until restored.</div>}

        {project?.legalHold && <div className="feedback error">Project legal hold is active. Writes are blocked.</div>}
        {project?.archivedAt && <div className="feedback subtle">Project is archived. Writes are blocked.</div>}

        {canViewOrgDetails && org?.legalHold && <div className="feedback error">Organization legal hold is active. Writes are blocked.</div>}
        {canViewOrgDetails && org?.archivedAt && <div className="feedback subtle">Organization is archived. Writes are blocked.</div>}

        <div className="info-grid">
          <div className="info-block">
            <div className="muted">Estimate ID</div>
            <div className="stat-value">{estimate?.id || estimate?._id || estimateId}</div>
          </div>
          <div className="info-block">
            <div className="muted">Project</div>
            <div className="stat-value">{project?.name || projectId}</div>
          </div>
          <div className="info-block">
            <div className="muted">Revision</div>
            <div className="stat-value">{estimate?.revision ?? '-'}</div>
          </div>
          <div className="info-block">
            <div className="muted">Updated</div>
            <div className="stat-value">{formatDateTime(estimate?.updatedAt)}</div>
          </div>
          <div className="info-block">
            <div className="muted">Server total</div>
            <div className="stat-value">{formatMoney(estimate?.totalAmount)}</div>
          </div>
          <div className="info-block">
            <div className="muted">Status</div>
            <div className="stat-value">{estimate?.status || '-'}</div>
          </div>
        </div>

        {!canViewEstimate && !loading && !error && <div className="feedback subtle">Checking your role permissions.</div>}

        <form className="rounded-2xl border border-border/60 bg-white/5 p-4 space-y-4" onSubmit={save}>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <div className="text-sm font-semibold text-[color:var(--text)]">Name</div>
              <input
                className="input w-full"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={saving || editingBlocked}
              />
            </label>
            <label className="space-y-1">
              <div className="text-sm font-semibold text-[color:var(--text)]">Status</div>
              <select
                className="input w-full"
                value={status}
                onChange={(e) => setStatus(e.target.value === 'final' ? 'final' : 'draft')}
                disabled={saving || editingBlocked}
              >
                <option value="draft">Draft</option>
                <option value="final">Final</option>
              </select>
            </label>
            <label className="space-y-1 md:col-span-2">
              <div className="text-sm font-semibold text-[color:var(--text)]">Description</div>
              <textarea
                className="input w-full min-h-[84px]"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={saving || editingBlocked}
              />
            </label>
            <label className="space-y-1 md:col-span-2">
              <div className="text-sm font-semibold text-[color:var(--text)]">Notes</div>
              <textarea
                className="input w-full min-h-[84px]"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={saving || editingBlocked}
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-muted-foreground">
              Client total: {formatMoney(lineItemsTotal)} {lineItemsDirty ? '(unsaved changes)' : ''}
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn secondary" type="button" onClick={archiveToggle} disabled={saving || orgBlocked || projectBlocked || !!estimate?.legalHold}>
                {estimate?.archivedAt ? 'Restore' : 'Archive'}
              </button>
              <button className="btn primary" type="submit" disabled={saving || editingBlocked}>
                {saving ? 'Saving.' : 'Save changes'}
              </button>
            </div>
          </div>
        </form>

        <div className="rounded-2xl border border-border/60 bg-white/5 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-[color:var(--text)]">Line items</div>
              <div className="text-sm text-muted-foreground">Add unit costs and quantities; totals are computed on save.</div>
            </div>
            <button className="btn secondary" type="button" onClick={addLineItem} disabled={saving || editingBlocked}>
              Add item
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-border/60">
            <table className="min-w-full text-sm">
              <thead className="bg-white/5 text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Code</th>
                  <th className="px-4 py-2">Description</th>
                  <th className="px-4 py-2">Qty</th>
                  <th className="px-4 py-2">Unit</th>
                  <th className="px-4 py-2">Unit cost</th>
                  <th className="px-4 py-2">Total</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item) => {
                  const total = computeLineTotal(item)
                  return (
                    <tr key={item.id} className="border-t border-border/60">
                      <td className="px-4 py-2">
                        <input
                          className="input w-full"
                          value={item.code}
                          onChange={(e) => updateLineItem(item.id, { code: e.target.value })}
                          disabled={saving || editingBlocked}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          className="input w-full"
                          value={item.description}
                          onChange={(e) => updateLineItem(item.id, { description: e.target.value })}
                          disabled={saving || editingBlocked}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          className="input w-full"
                          value={item.quantity}
                          inputMode="decimal"
                          onChange={(e) => updateLineItem(item.id, { quantity: e.target.value })}
                          disabled={saving || editingBlocked}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          className="input w-full"
                          value={item.unit}
                          onChange={(e) => updateLineItem(item.id, { unit: e.target.value })}
                          disabled={saving || editingBlocked}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          className="input w-full"
                          value={item.unitCost}
                          inputMode="decimal"
                          onChange={(e) => updateLineItem(item.id, { unitCost: e.target.value })}
                          disabled={saving || editingBlocked}
                        />
                      </td>
                      <td className="px-4 py-2 text-[color:var(--text)]">{formatMoney(total)}</td>
                      <td className="px-4 py-2 text-right">
                        <button className="btn secondary" type="button" onClick={() => removeLineItem(item.id)} disabled={saving || editingBlocked}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {lineItems.length === 0 && (
                  <tr>
                    <td className="px-4 py-4 text-muted-foreground" colSpan={7}>
                      No line items yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {!estimate && loading && <div className="feedback subtle">Loading estimate details.</div>}
      </section>
    </section>
  )
}

