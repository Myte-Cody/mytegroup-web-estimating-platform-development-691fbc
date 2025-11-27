'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ApiError, apiFetch } from '../../../lib/api'
import { cn } from '../../../lib/utils'

type Inquiry = {
  _id?: string
  id?: string
  name: string
  email: string
  message: string
  status: 'new' | 'in-progress' | 'closed'
  respondedAt?: string | null
  respondedBy?: string | null
  createdAt: string
}

type ListResponse = {
  data: Inquiry[]
  total: number
  page: number
  limit: number
}

type UpdateResponse = {
  status: string
  entry?: Inquiry
}

type SessionUser = {
  id?: string
  role?: string
  email?: string
}

const ALLOWED_ROLES = new Set(['superadmin', 'platform_admin'])

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'in-progress', label: 'In-progress' },
  { value: 'closed', label: 'Closed' },
]

const formatDate = (value?: string | null) => {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString()
}

const truncate = (value: string, length = 120) => {
  if (!value) return ''
  return value.length > length ? `${value.slice(0, length)}…` : value
}

export default function AdminInquiriesPage() {
  const router = useRouter()
  const [entries, setEntries] = useState<Inquiry[]>([])
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [authorized, setAuthorized] = useState(false)
  const [user, setUser] = useState<SessionUser | null>(null)

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit])

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await apiFetch<{ user?: SessionUser }>('/auth/me')
        const currentUser = res?.user || null
        setUser(currentUser)
        const allowed = currentUser?.role && ALLOWED_ROLES.has(currentUser.role)
        setAuthorized(Boolean(allowed))
        if (!allowed) {
          setError('You need a SuperAdmin or PlatformAdmin session to view inquiries.')
        }
      } catch (err: any) {
        if (err instanceof ApiError && err.status === 401) {
          router.replace('/auth/login')
          return
        }
        setError(err instanceof ApiError ? err.message : 'Unable to load your session.')
      }
    }
    checkAuth()
  }, [router])

  useEffect(() => {
    const load = async () => {
      if (!authorized) return
      setLoading(true)
      setError(null)
      setNotice(null)
      try {
        const qs = new URLSearchParams({
          page: String(page),
          limit: String(limit),
        })
        if (statusFilter !== 'all') qs.append('status', statusFilter)
        const res = await apiFetch<ListResponse>(`/marketing/contact-inquiries?${qs.toString()}`)
        setEntries(res.data || [])
        setTotal(res.total || 0)
      } catch (err: any) {
        const message =
          err instanceof ApiError
            ? err.status === 401 || err.status === 403
              ? 'You need a SuperAdmin or PlatformAdmin session to view inquiries.'
              : err.message
            : 'Unable to load inquiries.'
        setError(message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [authorized, page, limit, statusFilter])

  const setEntryStatus = (id: string, status: Inquiry['status'], respondedAt?: string | null, respondedBy?: string | null) => {
    setEntries((prev) =>
      prev.map((entry) => {
        const entryId = entry._id || entry.id
        if (entryId !== id) return entry
        return { ...entry, status, respondedAt: respondedAt ?? entry.respondedAt, respondedBy: respondedBy ?? entry.respondedBy }
      })
    )
  }

  const handleStatusChange = async (id: string, next: Inquiry['status']) => {
    setSavingId(id)
    setNotice(null)
    try {
      const res = await apiFetch<UpdateResponse>(`/marketing/contact-inquiries/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      })
      const respondedAt = res.entry?.respondedAt || null
      const respondedBy = res.entry?.respondedBy || null
      setEntryStatus(id, next, respondedAt as any, respondedBy as any)
      setNotice('Status updated.')
    } catch (err: any) {
      const message =
        err instanceof ApiError
          ? err.status === 401 || err.status === 403
            ? 'You do not have permission to update inquiries.'
            : err.message
          : 'Unable to update status right now.'
      setError(message)
    } finally {
      setSavingId(null)
    }
  }

  return (
    <section className="dashboard-grid">
      <section className="glass-card">
        <div className="badge">Admin console</div>
        <h1>Contact inquiries</h1>
        <p className="subtitle">
          Platform-level view of inbound contact requests. Only SuperAdmin and PlatformAdmin roles can access this page.
        </p>

        {user && !authorized && (
          <div className="info-grid">
            <div className="info-block">
              <div className="muted">Role</div>
              <div className="stat-value">{user.role || 'Unknown'}</div>
            </div>
            <div className="info-block">
              <div className="muted">User</div>
              <div className="stat-value">{user.email || user.id}</div>
            </div>
          </div>
        )}

        {error && <div className="feedback error mt-3">{error}</div>}
        {notice && !error && <div className="feedback success mt-3">{notice}</div>}
        {loading && !error && <div className="feedback mt-3">Loading inquiries.</div>}

        {authorized && !loading && !error && (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Filter by status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setPage(1)
                    setStatusFilter(e.target.value)
                  }}
                  className="rounded-lg border border-border/70 bg-[color:var(--panel-strong)] px-2 py-1 text-sm text-[color:var(--text)] outline-none"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="text-xs text-muted-foreground">
                Page {page} of {totalPages} {'\u00b7'} {total} inquiries
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-border/60 bg-[color:var(--panel)]">
              <table className="min-w-full text-left text-xs sm:text-sm">
                <thead className="border-b border-border/60 bg-[color:var(--panel-strong)] text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2">Created</th>
                    <th className="px-4 py-2">Name</th>
                    <th className="px-4 py-2">Email</th>
                    <th className="px-4 py-2">Message</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Responded</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => {
                    const entryId = entry._id || entry.id || ''
                    return (
                      <tr key={entryId} className="border-b border-border/40 last:border-none">
                        <td className="px-4 py-3 align-top text-muted-foreground">{formatDate(entry.createdAt)}</td>
                        <td className="px-4 py-3 align-top">
                          <div className="font-semibold text-[color:var(--text)]">{entry.name}</div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <a href={`mailto:${entry.email}`} className="text-[color:var(--accent)] hover:underline">
                            {entry.email}
                          </a>
                        </td>
                        <td className="px-4 py-3 align-top text-muted-foreground" title={entry.message}>
                          {truncate(entry.message)}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <select
                            value={entry.status}
                            onChange={(e) => handleStatusChange(entryId, e.target.value as Inquiry['status'])}
                            disabled={savingId === entryId}
                            className={cn(
                              'rounded-lg border px-2 py-1 text-xs sm:text-sm outline-none transition',
                              entry.status === 'closed'
                                ? 'border-emerald-400 bg-emerald-500/10 text-emerald-100'
                                : entry.status === 'in-progress'
                                ? 'border-amber-300 bg-amber-500/10 text-amber-100'
                                : 'border-sky-300 bg-sky-500/10 text-sky-100'
                            )}
                          >
                            {STATUS_OPTIONS.filter((s) => s.value !== 'all').map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3 align-top text-muted-foreground">
                          {entry.respondedBy ? (
                            <div className="space-y-1">
                              <div className="font-semibold text-[color:var(--text)]">
                                {entry.respondedBy}
                              </div>
                              <div className="text-xs text-muted-foreground">{formatDate(entry.respondedAt)}</div>
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {entries.length === 0 && (
                    <tr>
                      <td className="px-4 py-6 text-center text-muted-foreground" colSpan={6}>
                        No inquiries match this filter yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div>
                Page {page} of {totalPages} {'\u00b7'} {total} total
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={cn('btn-secondary', 'px-3 py-1 rounded-full text-xs', page <= 1 && 'opacity-50')}
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className={cn(
                    'btn-secondary',
                    'px-3 py-1 rounded-full text-xs',
                    page >= totalPages && 'opacity-50'
                  )}
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </section>
  )
}

