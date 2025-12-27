'use client'

import Link from 'next/link'
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

type Company = {
  _id?: string
  id?: string
  orgId?: string
  name: string
  companyTypeKeys?: string[]
  tagKeys?: string[]
  peopleCount?: number
  locationsCount?: number
  rating?: number | null
  archivedAt?: string | null
  piiStripped?: boolean
  legalHold?: boolean
  createdAt?: string
  updatedAt?: string
}

type ListResponse<T> = {
  data: T[]
  total: number
  page: number
  limit: number
}

type TaxonomyValue = {
  key: string
  label: string
  archivedAt?: string | null
}

type TaxonomyDoc = {
  namespace: string
  values: TaxonomyValue[]
}

const splitList = (value: string) => {
  return (value || '')
    .split(/[,;\n]/g)
    .map((item) => item.trim())
    .filter(Boolean)
}

export default function CompaniesPage() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [companies, setCompanies] = useState<Company[]>([])
  const [companyTypeOptions, setCompanyTypeOptions] = useState<TaxonomyValue[]>([])
  const [includeArchived, setIncludeArchived] = useState(false)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [reloadAt, setReloadAt] = useState(0)
  const limit = 25

  const [name, setName] = useState('')
  const [companyTypeKeys, setCompanyTypeKeys] = useState<string[]>([])
  const [tagsText, setTagsText] = useState('')

  const canManage = useMemo(() => hasAnyRole(user, ['admin']), [user])
  const refresh = () => setReloadAt(Date.now())

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      setActionMessage(null)
      setCompanies([])
      setTotal(0)
      try {
        const me = await apiFetch<{ user?: SessionUser }>('/auth/me')
        const currentUser = me?.user || null
        setUser(currentUser)
        if (!currentUser?.id) {
          setError('You need to sign in to manage companies.')
          return
        }
        if (!hasAnyRole(currentUser, ['admin'])) {
          setError('Org admin access required to manage companies.')
          return
        }

        const qs = new URLSearchParams()
        if (includeArchived) qs.set('includeArchived', '1')
        qs.set('includeCounts', '1')
        qs.set('page', String(page))
        qs.set('limit', String(limit))
        if (search.trim()) qs.set('search', search.trim())
        if (typeFilter.trim()) qs.set('type', typeFilter.trim())
        if (tagFilter.trim()) qs.set('tag', tagFilter.trim())

        const fetches: Array<Promise<any>> = [apiFetch<ListResponse<Company> | Company[]>(`/companies?${qs.toString()}`)]
        if (companyTypeOptions.length === 0) {
          fetches.push(apiFetch<TaxonomyDoc>('/org-taxonomy/company_type'))
        }

        const results = await Promise.allSettled(fetches)
        const companiesRes = results[0]
        if (companiesRes.status === 'fulfilled') {
          const res = companiesRes.value
          const rows = Array.isArray(res) ? res : res.data
          const totalCount = Array.isArray(res) ? rows.length : res.total
          setCompanies(Array.isArray(rows) ? rows : [])
          setTotal(typeof totalCount === 'number' ? totalCount : 0)
        } else {
          throw companiesRes.reason
        }

        const taxonomyRes = results[1]
        if (taxonomyRes && taxonomyRes.status === 'fulfilled') {
          const values = Array.isArray(taxonomyRes.value?.values) ? taxonomyRes.value.values : []
          setCompanyTypeOptions(values.filter((v: TaxonomyValue) => !v.archivedAt))
        }
      } catch (err: any) {
        setError(err instanceof ApiError ? err.message : 'Unable to load companies.')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [includeArchived, page, limit, search, typeFilter, tagFilter, reloadAt, companyTypeOptions.length])

  useEffect(() => {
    setPage(1)
  }, [includeArchived, search, typeFilter, tagFilter])

  const rows = useMemo(() => {
    return [...companies].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  }, [companies])

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(total / limit))
  }, [total, limit])

  const canCreate = useMemo(() => {
    return canManage && !submitting && name.trim() !== ''
  }, [canManage, submitting, name])

  const onCreate = async (event: FormEvent) => {
    event.preventDefault()
    if (!canCreate) return
    setSubmitting(true)
    setError(null)
    setActionMessage(null)
    try {
      await apiFetch('/companies', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          companyTypeKeys,
          tagKeys: splitList(tagsText),
        }),
      })
      setName('')
      setCompanyTypeKeys([])
      setTagsText('')
      setActionMessage('Company created.')
      refresh()
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Failed to create company.')
    } finally {
      setSubmitting(false)
    }
  }

  const toggleArchive = async (company: Company) => {
    const companyId = company.id || company._id
    if (!companyId) return
    setError(null)
    setActionMessage(null)
    try {
      const endpoint = company.archivedAt ? 'unarchive' : 'archive'
      await apiFetch(`/companies/${companyId}/${endpoint}`, { method: 'POST' })
      setActionMessage(company.archivedAt ? 'Company restored.' : 'Company archived.')
      refresh()
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Failed to update company status.')
    }
  }

  return (
    <section className="space-y-6">
      <div className="glass-card space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="badge">Org Settings</div>
            <h1>Companies</h1>
            <p className="subtitle">External companies (suppliers, subcontractors, clients) with locations and tags.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn secondary" onClick={refresh} disabled={loading}>
              {loading ? 'Loading.' : 'Refresh'}
            </button>
            <Link href="/dashboard/settings/companies/import" className="btn secondary">
              Import
            </Link>
          </div>
        </div>

        {actionMessage && <div className="feedback success">{actionMessage}</div>}
        {error && <div className={cn('feedback error')}>{error}</div>}
      </div>

      {canManage && (
        <form onSubmit={onCreate} className="glass-card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2>New company</h2>
            <div className="muted">Create and then add locations.</div>
          </div>

          <div className="form-grid md:grid-cols-2">
            <label className="md:col-span-2">
              Name <span className="text-red-400">*</span>
              <input value={name} onChange={(e) => setName(e.target.value)} disabled={!canManage || submitting} />
            </label>

            <label>
              Company types <span className="muted">(select all that apply)</span>
              {companyTypeOptions.length === 0 ? (
                <div className="muted text-sm">
                  No company type taxonomy values yet. Add them in <Link href="/dashboard/settings/taxonomy">Settings → Taxonomy</Link>.
                </div>
              ) : (
                <div className="grid gap-2 rounded-2xl border border-border/60 bg-white/5 p-3 md:grid-cols-2">
                  {companyTypeOptions.map((opt) => (
                    <label key={opt.key} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={companyTypeKeys.includes(opt.key)}
                        onChange={(e) => {
                          const checked = e.target.checked
                          setCompanyTypeKeys((prev) => {
                            if (checked) return Array.from(new Set([...prev, opt.key]))
                            return prev.filter((k) => k !== opt.key)
                          })
                        }}
                        disabled={!canManage || submitting}
                      />
                      <span>{opt.label || opt.key}</span>
                    </label>
                  ))}
                </div>
              )}
            </label>

            <label>
              Tags <span className="muted">(comma-separated)</span>
              <input
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
                disabled={!canManage || submitting}
                placeholder="e.g. galvanizing, transport"
              />
            </label>
          </div>

          <button className="btn primary" type="submit" disabled={!canCreate}>
            {submitting ? 'Creating.' : 'Create company'}
          </button>
        </form>
      )}

      {canManage && (
        <div className="glass-card space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2>Directory</h2>
            <div className="muted">
              Page {page} of {totalPages} · {total} companies
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              Search
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name" className="min-w-[220px]" />
            </label>
            <label className="flex items-center gap-2 text-sm">
              Type key
              {companyTypeOptions.length ? (
                <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="min-w-[220px]">
                  <option value="">All</option>
                  {companyTypeOptions.map((opt) => (
                    <option key={opt.key} value={opt.key}>
                      {opt.label || opt.key}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  placeholder="company_type key"
                  className="min-w-[220px]"
                />
              )}
            </label>
            <label className="flex items-center gap-2 text-sm">
              Tag key
              <input value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} placeholder="company_tag key" className="min-w-[220px]" />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} />
              Include archived
            </label>

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                className="btn secondary"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={loading || page <= 1}
              >
                Prev
              </button>
              <button
                type="button"
                className="btn secondary"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={loading || page >= totalPages}
              >
                Next
              </button>
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="muted">No companies yet. Create one above or import people with company names.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Types</th>
                    <th>Tags</th>
                    <th className="text-right">People</th>
                    <th className="text-right">Locations</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((company) => {
                    const companyId = company.id || company._id || company.name
                    const archived = !!company.archivedAt
                    const href = company.id || company._id ? `/dashboard/settings/companies/${company.id || company._id}` : null
                    return (
                      <tr key={companyId} className={cn(archived && 'opacity-70')}>
                        <td>
                          {href ? (
                            <Link href={href} className="font-semibold text-[color:var(--text)]">
                              {company.name}
                            </Link>
                          ) : (
                            company.name
                          )}
                        </td>
                        <td className="muted">{(company.companyTypeKeys || []).join(', ') || '-'}</td>
                        <td className="muted">{(company.tagKeys || []).join(', ') || '-'}</td>
                        <td className="text-right">{typeof company.peopleCount === 'number' ? company.peopleCount : '-'}</td>
                        <td className="text-right">{typeof company.locationsCount === 'number' ? company.locationsCount : '-'}</td>
                        <td>{archived ? 'Archived' : 'Active'}</td>
                        <td className="text-right">
                          <button
                            type="button"
                            className="btn secondary"
                            onClick={() => void toggleArchive(company)}
                            disabled={!!company.legalHold}
                          >
                            {archived ? 'Restore' : 'Archive'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
