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

type TaxonomyValue = {
  key: string
  label: string
  sortOrder?: number | null
  color?: string | null
  metadata?: Record<string, any> | null
  archivedAt?: string | null
}

type TaxonomyDoc = {
  orgId?: string
  namespace: string
  values: TaxonomyValue[]
}

type NamespaceDef = {
  namespace: string
  title: string
  description: string
  reservedKeys?: string[]
}

const RESERVED_EDGE_TYPE_KEYS = ['depends_on', 'supports', 'works_with', 'primary_for', 'assigned_to', 'reports_to', 'belongs_to']

const NAMESPACES: NamespaceDef[] = [
  { namespace: 'company_type', title: 'Company types', description: 'Supplier, subcontractor, mill, etc.' },
  { namespace: 'company_tag', title: 'Company tags', description: 'Org-wide tags for companies (optional).' },
  { namespace: 'company_location_tag', title: 'Company location tags', description: 'Org-wide tags for company locations (optional).' },
  { namespace: 'person_skill', title: 'Person skills', description: 'Org-wide skills used to find people quickly.' },
  { namespace: 'person_tag', title: 'Person tags', description: 'Org-wide tags for people (optional).' },
  { namespace: 'department', title: 'Departments', description: 'Internal departments for staff (optional).' },
  { namespace: 'org_location_type', title: 'Org location types', description: 'Types for internal org locations (office, shop, yard, etc.).' },
  { namespace: 'org_location_tag', title: 'Org location tags', description: 'Org-wide tags for org locations (optional).' },
  { namespace: 'edge_type', title: 'Edge types', description: 'Allowed relationship types for graph edges.', reservedKeys: RESERVED_EDGE_TYPE_KEYS },
]

const normalizeKey = (value: string) => {
  return (value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
}

const defaultLabelFromKey = (key: string) => {
  return String(key || '')
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

const activeOnly = (values: TaxonomyValue[]) => values.filter((v) => !v.archivedAt)

export default function TaxonomySettingsPage() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [docs, setDocs] = useState<Record<string, TaxonomyDoc | null>>({})
  const [draft, setDraft] = useState<Record<string, TaxonomyValue[]>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [savedMessage, setSavedMessage] = useState<Record<string, string | null>>({})
  const [reloadAt, setReloadAt] = useState(0)

  const canManage = useMemo(() => hasAnyRole(user, ['admin']), [user])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const me = await apiFetch<{ user?: SessionUser }>('/auth/me')
        const currentUser = me?.user || null
        setUser(currentUser)
        if (!currentUser?.id) {
          setError('You need to sign in to manage taxonomy.')
          return
        }
        if (!hasAnyRole(currentUser, ['admin'])) {
          setError('Org admin access required to manage taxonomy.')
          return
        }

        const results = await Promise.allSettled(
          NAMESPACES.map(async (def) => {
            const doc = await apiFetch<TaxonomyDoc>(`/org-taxonomy/${def.namespace}`)
            return { namespace: def.namespace, doc }
          })
        )

        const nextDocs: Record<string, TaxonomyDoc | null> = {}
        const nextDraft: Record<string, TaxonomyValue[]> = {}
        results.forEach((res, idx) => {
          const namespace = NAMESPACES[idx].namespace
          if (res.status === 'fulfilled') {
            nextDocs[namespace] = res.value.doc
            nextDraft[namespace] = activeOnly(res.value.doc.values || []).map((v) => ({
              key: v.key,
              label: v.label || defaultLabelFromKey(v.key),
              sortOrder: typeof v.sortOrder === 'number' ? v.sortOrder : null,
              color: v.color || null,
              metadata: v.metadata || {},
              archivedAt: null,
            }))
          } else {
            nextDocs[namespace] = null
            nextDraft[namespace] = []
          }
        })

        setDocs(nextDocs)
        setDraft(nextDraft)
      } catch (err: any) {
        setError(err instanceof ApiError ? err.message : 'Unable to load taxonomy.')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [reloadAt])

  const refresh = () => setReloadAt(Date.now())

  const onAdd = (namespace: string, label: string) => {
    const key = normalizeKey(label)
    if (!key) return
    setDraft((prev) => {
      const existing = prev[namespace] || []
      if (existing.some((v) => v.key === key)) return prev
      return {
        ...prev,
        [namespace]: [...existing, { key, label: label.trim() || defaultLabelFromKey(key), sortOrder: null, color: null, metadata: {}, archivedAt: null }],
      }
    })
  }

  const onArchive = (namespace: string, key: string) => {
    setDraft((prev) => ({ ...prev, [namespace]: (prev[namespace] || []).filter((v) => v.key !== key) }))
  }

  const onRestore = (namespace: string, value: TaxonomyValue) => {
    setDraft((prev) => {
      const existing = prev[namespace] || []
      if (existing.some((v) => v.key === value.key)) return prev
      return {
        ...prev,
        [namespace]: [
          ...existing,
          { key: value.key, label: value.label || defaultLabelFromKey(value.key), sortOrder: value.sortOrder ?? null, color: value.color ?? null, metadata: value.metadata || {}, archivedAt: null },
        ],
      }
    })
  }

  const onSave = async (namespace: string) => {
    if (!canManage) return
    setSaving((prev) => ({ ...prev, [namespace]: true }))
    setSavedMessage((prev) => ({ ...prev, [namespace]: null }))
    setError(null)
    try {
      const values = (draft[namespace] || [])
        .map((v) => ({
          key: v.key,
          label: (v.label || '').trim() || defaultLabelFromKey(v.key),
          sortOrder: typeof v.sortOrder === 'number' ? v.sortOrder : undefined,
          color: (v.color || '').trim() || undefined,
          metadata: v.metadata || {},
        }))
        .filter((v) => !!v.key)

      await apiFetch(`/org-taxonomy/${namespace}`, { method: 'PUT', body: JSON.stringify({ values }) })
      setSavedMessage((prev) => ({ ...prev, [namespace]: 'Saved.' }))
      refresh()
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Failed to save taxonomy.')
    } finally {
      setSaving((prev) => ({ ...prev, [namespace]: false }))
    }
  }

  if (!canManage) {
    return (
      <section className="space-y-6">
        <div className="glass-card space-y-2">
          <div className="badge">Org Settings</div>
          <h1>Taxonomy</h1>
          <p className="subtitle">Centralized lists for types, tags, skills, and edge types.</p>
          {loading && <div className="feedback subtle">Loading.</div>}
          {error && <div className={cn('feedback error')}>{error}</div>}
          {user?.id && <div className={cn('feedback error')}>Org admin access required.</div>}
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-6">
      <div className="glass-card space-y-2">
        <div className="badge">Org Settings</div>
        <h1>Taxonomy</h1>
        <p className="subtitle">Centralized lists for types, tags, skills, and graph edge types.</p>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn secondary" onClick={refresh} disabled={loading}>
            {loading ? 'Loading.' : 'Refresh'}
          </button>
        </div>
        {error && <div className={cn('feedback error')}>{error}</div>}
      </div>

      {NAMESPACES.map((def) => {
        const namespace = def.namespace
        const doc = docs[namespace]
        const activeValues = draft[namespace] || []
        const archivedValues = (doc?.values || []).filter((v) => !!v.archivedAt && !activeValues.some((a) => a.key === v.key))
        const reserved = new Set(def.reservedKeys || [])
        const isSaving = !!saving[namespace]

        return (
          <div key={namespace} className="glass-card space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <h2>{def.title}</h2>
                <p className="subtitle">{def.description}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {savedMessage[namespace] && <div className="feedback success">{savedMessage[namespace]}</div>}
                <button type="button" className="btn primary" onClick={() => void onSave(namespace)} disabled={isSaving}>
                  {isSaving ? 'Saving.' : 'Save'}
                </button>
              </div>
            </div>

            {!doc ? (
              <div className="muted">Unable to load this taxonomy namespace.</div>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="muted text-sm">{activeValues.length} active</div>
                  {activeValues.length === 0 ? (
                    <div className="muted">No values yet. Add your first value below.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="table w-full">
                        <thead>
                          <tr>
                            <th>Key</th>
                            <th>Label</th>
                            <th>Sort</th>
                            <th className="text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeValues.map((v) => (
                            <tr key={v.key}>
                              <td className="font-mono text-xs">{v.key}</td>
                              <td>
                                <input
                                  value={v.label}
                                  onChange={(e) => {
                                    const value = e.target.value
                                    setDraft((prev) => ({
                                      ...prev,
                                      [namespace]: (prev[namespace] || []).map((item) => (item.key === v.key ? { ...item, label: value } : item)),
                                    }))
                                  }}
                                  disabled={isSaving}
                                />
                              </td>
                              <td className="w-32">
                                <input
                                  type="number"
                                  value={typeof v.sortOrder === 'number' ? v.sortOrder : ''}
                                  onChange={(e) => {
                                    const raw = e.target.value
                                    const next = raw.trim() === '' ? null : Number(raw)
                                    setDraft((prev) => ({
                                      ...prev,
                                      [namespace]: (prev[namespace] || []).map((item) => (item.key === v.key ? { ...item, sortOrder: Number.isFinite(next as any) ? next : null } : item)),
                                    }))
                                  }}
                                  disabled={isSaving}
                                />
                              </td>
                              <td className="text-right">
                                <button type="button" className="btn secondary" disabled={isSaving || reserved.has(v.key)} onClick={() => onArchive(namespace, v.key)}>
                                  {reserved.has(v.key) ? 'Locked' : 'Archive'}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <AddRow namespace={namespace} disabled={isSaving} onAdd={onAdd} />

                {archivedValues.length > 0 && (
                  <div className="space-y-2">
                    <div className="muted text-sm">{archivedValues.length} archived</div>
                    <div className="overflow-x-auto">
                      <table className="table w-full">
                        <thead>
                          <tr>
                            <th>Key</th>
                            <th>Label</th>
                            <th className="text-right">Restore</th>
                          </tr>
                        </thead>
                        <tbody>
                          {archivedValues.map((v) => (
                            <tr key={v.key} className="opacity-70">
                              <td className="font-mono text-xs">{v.key}</td>
                              <td>{v.label || defaultLabelFromKey(v.key)}</td>
                              <td className="text-right">
                                <button type="button" className="btn secondary" onClick={() => onRestore(namespace, v)} disabled={isSaving}>
                                  Restore
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )
      })}
    </section>
  )
}

function AddRow({
  namespace,
  disabled,
  onAdd,
}: {
  namespace: string
  disabled: boolean
  onAdd: (namespace: string, label: string) => void
}) {
  const [label, setLabel] = useState('')

  const canAdd = useMemo(() => {
    return !disabled && label.trim().length >= 2
  }, [disabled, label])

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!canAdd) return
    onAdd(namespace, label)
    setLabel('')
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-border/60 bg-white/5 p-4 space-y-3">
      <div className="muted">Add a new value</div>
      <div className="form-grid md:grid-cols-3">
        <label className="md:col-span-2">
          Label
          <input value={label} onChange={(e) => setLabel(e.target.value)} disabled={disabled} placeholder="e.g. Supplier" />
        </label>
        <div className="flex items-end">
          <button type="submit" className="btn primary w-full" disabled={!canAdd}>
            Add
          </button>
        </div>
      </div>
      <div className="muted text-xs">Key will be normalized to lowercase snake_case on save.</div>
    </form>
  )
}

