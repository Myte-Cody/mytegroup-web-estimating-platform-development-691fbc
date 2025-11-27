'use client'

import { useEffect, useState } from 'react'
import { ApiError, apiFetch } from '../../lib/api'
import { cn } from '../../lib/utils'

type WaitlistEntry = {
  email: string
  name: string
  role: string
  status: string
  verifyStatus: string
  cohortTag?: string | null
  createdAt: string
  invitedAt?: string | null
  activatedAt?: string | null
}

type ListResponse = {
  data: WaitlistEntry[]
  total: number
  page: number
  limit: number
}

export default function WaitlistAdminPage() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([])
  const [page, setPage] = useState(1)
  const [limit] = useState(25)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await apiFetch<ListResponse>(`/marketing/waitlist?page=${page}&limit=${limit}`)
        setEntries(res.data)
        setTotal(res.total)
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.status === 401 || err.status === 403
              ? 'You need an admin session to view the waitlist.'
              : err.message
            : 'Unable to load waitlist entries.'
        setError(message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [page, limit])

  const totalPages = Math.max(1, Math.ceil(total / limit))

  return (
    <main className="dashboard-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="dashboard-grid">
        <section className="glass-card">
          <div className="badge">Waitlist admin</div>
          <h1>Waitlist cohorts</h1>
          <p className="subtitle">
            Review pending, invited, and activated waitlist entries. Use this view to confirm the lifecycle and cohorts
            before inviting new organizations.
          </p>
          {error && <div className="feedback error">{error}</div>}
          {loading && !error && <div className="feedback">Loading entries…</div>}

          {!loading && !error && (
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Page {page} of {totalPages} · {total} total entries
                </span>
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

              <div className="overflow-x-auto rounded-2xl border border-border/60 bg-[color:var(--panel)]">
                <table className="min-w-full text-left text-xs sm:text-sm">
                  <thead className="border-b border-border/60 bg-[color:var(--panel-strong)] text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2">Email</th>
                      <th className="px-4 py-2">Name</th>
                      <th className="px-4 py-2">Role</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">Verify</th>
                      <th className="px-4 py-2">Cohort</th>
                      <th className="px-4 py-2">Created</th>
                      <th className="px-4 py-2">Invited</th>
                      <th className="px-4 py-2">Activated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e) => (
                      <tr key={e.email} className="border-t border-border/40">
                        <td className="px-4 py-2 font-mono text-xs">{e.email}</td>
                        <td className="px-4 py-2">{e.name}</td>
                        <td className="px-4 py-2">{e.role}</td>
                        <td className="px-4 py-2 capitalize">{e.status}</td>
                        <td className="px-4 py-2 capitalize">{e.verifyStatus}</td>
                        <td className="px-4 py-2">{e.cohortTag || '—'}</td>
                        <td className="px-4 py-2 text-xs text-muted-foreground">
                          {new Date(e.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-xs text-muted-foreground">
                          {e.invitedAt ? new Date(e.invitedAt).toLocaleString() : '—'}
                        </td>
                        <td className="px-4 py-2 text-xs text-muted-foreground">
                          {e.activatedAt ? new Date(e.activatedAt).toLocaleString() : '—'}
                        </td>
                      </tr>
                    ))}
                    {!entries.length && (
                      <tr>
                        <td className="px-4 py-6 text-center text-muted-foreground" colSpan={9}>
                          No waitlist entries found for this page.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

