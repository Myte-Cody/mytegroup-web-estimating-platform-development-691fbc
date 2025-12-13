'use client'

import { useEffect, useMemo, useState } from 'react'

import { ApiError, apiFetch } from '../../../lib/api'
import { cn } from '../../../lib/utils'
import { buttonVariants } from '../../../components/ui/button'

type Organization = {
  id?: string
  name: string
  primaryDomain?: string | null
  archivedAt?: string | null
  legalHold: boolean
  piiStripped: boolean
  datastoreType: 'shared' | 'dedicated'
  dataResidency: 'shared' | 'dedicated'
  useDedicatedDb: boolean
  databaseName?: string | null
}

type ListResponse = {
  data: Organization[]
  total: number
  page: number
  limit: number
}

type TriState = 'all' | 'true' | 'false'
type DatastoreFilter = 'all' | 'shared' | 'dedicated'

const toBooleanParam = (value: TriState) => {
  if (value === 'all') return null
  return value === 'true' ? '1' : '0'
}

export default function PlatformOrganizationsPage() {
  const [entries, setEntries] = useState<Organization[]>([])
  const [search, setSearch] = useState('')
  const [includeArchived, setIncludeArchived] = useState(false)
  const [datastoreType, setDatastoreType] = useState<DatastoreFilter>('all')
  const [legalHold, setLegalHold] = useState<TriState>('all')
  const [piiStripped, setPiiStripped] = useState<TriState>('all')
  const [page, setPage] = useState(1)
  const [limit] = useState(25)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const qs = new URLSearchParams({
          page: String(page),
          limit: String(limit),
        })
        const trimmed = search.trim()
        if (trimmed) qs.set('search', trimmed)
        if (includeArchived) qs.set('includeArchived', '1')
        if (datastoreType !== 'all') qs.set('datastoreType', datastoreType)
        const legalHoldParam = toBooleanParam(legalHold)
        if (legalHoldParam !== null) qs.set('legalHold', legalHoldParam)
        const piiParam = toBooleanParam(piiStripped)
        if (piiParam !== null) qs.set('piiStripped', piiParam)

        const res = await apiFetch<ListResponse>(`/organizations?${qs.toString()}`)
        setEntries(res.data || [])
        setTotal(res.total || 0)
      } catch (err: any) {
        const message =
          err instanceof ApiError
            ? err.status === 401 || err.status === 403
              ? 'You need a Platform Admin session to view organizations.'
              : err.message
            : 'Unable to load organizations.'
        setError(message)
        setEntries([])
        setTotal(0)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [search, includeArchived, datastoreType, legalHold, piiStripped, page, limit])

  const resetToFirstPage = () => setPage(1)

  return (
    <section className="dashboard-grid">
      <section className="glass-card">
        <div className="badge">Platform admin</div>
        <h1>Organizations</h1>
        <p className="subtitle">
          Platform-level view of tenant organizations. Connection URIs are intentionally redacted.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Search</div>
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                resetToFirstPage()
              }}
              placeholder="Name or domain..."
              className="w-full rounded-2xl border border-border/60 bg-[color:var(--panel-strong)] px-4 py-2 text-sm text-[color:var(--text)] outline-none"
            />
          </label>

          <label className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Datastore</div>
            <select
              value={datastoreType}
              onChange={(e) => {
                setDatastoreType(e.target.value as DatastoreFilter)
                resetToFirstPage()
              }}
              className="w-full rounded-2xl border border-border/60 bg-[color:var(--panel-strong)] px-4 py-2 text-sm text-[color:var(--text)] outline-none"
            >
              <option value="all">All</option>
              <option value="shared">Shared</option>
              <option value="dedicated">Dedicated</option>
            </select>
          </label>

          <label className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Legal hold</div>
            <select
              value={legalHold}
              onChange={(e) => {
                setLegalHold(e.target.value as TriState)
                resetToFirstPage()
              }}
              className="w-full rounded-2xl border border-border/60 bg-[color:var(--panel-strong)] px-4 py-2 text-sm text-[color:var(--text)] outline-none"
            >
              <option value="all">All</option>
              <option value="true">On</option>
              <option value="false">Off</option>
            </select>
          </label>

          <label className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">PII stripped</div>
            <select
              value={piiStripped}
              onChange={(e) => {
                setPiiStripped(e.target.value as TriState)
                resetToFirstPage()
              }}
              className="w-full rounded-2xl border border-border/60 bg-[color:var(--panel-strong)] px-4 py-2 text-sm text-[color:var(--text)] outline-none"
            >
              <option value="all">All</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </label>

          <label className="flex items-center gap-3 rounded-2xl border border-border/60 bg-[color:var(--panel-strong)] px-4 py-3 text-sm text-[color:var(--text)]">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[color:var(--accent)]"
              checked={includeArchived}
              onChange={(e) => {
                setIncludeArchived(e.target.checked)
                resetToFirstPage()
              }}
            />
            Include archived
          </label>
        </div>

        {error && <div className="feedback error mt-4">{error}</div>}
        {loading && !error && <div className="feedback mt-4">Loading organizations…</div>}

        {!loading && !error && (
          <div className="mt-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>
                Page {page} of {totalPages} {'\u00b7'} {total} orgs
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), page <= 1 && 'opacity-50')}
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className={cn(
                    buttonVariants({ variant: 'secondary', size: 'sm' }),
                    page >= totalPages && 'opacity-50'
                  )}
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-border/60 bg-[color:var(--panel)]">
              <table className="min-w-full text-left text-xs sm:text-sm">
                <thead className="border-b border-border/60 bg-[color:var(--panel-strong)] text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2">Name</th>
                    <th className="px-4 py-2">Domain</th>
                    <th className="px-4 py-2">Datastore</th>
                    <th className="px-4 py-2">DB name</th>
                    <th className="px-4 py-2">Legal hold</th>
                    <th className="px-4 py-2">PII stripped</th>
                    <th className="px-4 py-2">Archived</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((org) => (
                    <tr key={org.id || org.name} className="border-b border-border/40 last:border-none">
                      <td className="px-4 py-2 font-semibold text-[color:var(--text)]">{org.name}</td>
                      <td className="px-4 py-2 text-muted-foreground">{org.primaryDomain || '-'}</td>
                      <td className="px-4 py-2">
                        <span className="inline-flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-[color:var(--accent)] opacity-80" />
                          {org.datastoreType}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{org.databaseName || '-'}</td>
                      <td className="px-4 py-2">{org.legalHold ? 'On' : 'Off'}</td>
                      <td className="px-4 py-2">{org.piiStripped ? 'Yes' : 'No'}</td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {org.archivedAt ? new Date(org.archivedAt).toLocaleDateString() : '-'}
                      </td>
                    </tr>
                  ))}
                  {entries.length === 0 && (
                    <tr>
                      <td className="px-4 py-6 text-center text-muted-foreground" colSpan={7}>
                        No organizations found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </section>
  )
}

