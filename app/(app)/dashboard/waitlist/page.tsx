'use client'

import { useEffect, useState } from 'react'
import { ApiError, apiFetch } from '../../../lib/api'
import { cn } from '../../../lib/utils'

type WaitlistEntry = {
  email: string
  phone?: string | null
  name: string
  role: string
  status: string
  verifyStatus: string
  phoneVerifyStatus?: string | null
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

const PLATFORM_ROLES = ['superadmin', 'platform_admin']

export default function WaitlistAdminPage() {
  const maskPhone = (phone?: string | null) => {
    const trimmed = (phone || '').trim()
    if (!trimmed) return '-'
    const digits = trimmed.startsWith('+') ? trimmed.slice(1) : trimmed
    if (digits.length <= 4) return trimmed
    const last4 = digits.slice(-4)
    const maskedPrefix = digits.slice(0, -4).replace(/\d/g, '•')
    return `${trimmed.startsWith('+') ? '+' : ''}${maskedPrefix}${last4}`
  }

  const [entries, setEntries] = useState<WaitlistEntry[]>([])
  const [page, setPage] = useState(1)
  const [limit] = useState(25)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [reloadAt, setReloadAt] = useState<number>(0)
  const [role, setRole] = useState<string | null>(null)

  // Batch invite modal state
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [batchLimit, setBatchLimit] = useState(10)
  const [batchCohortTag, setBatchCohortTag] = useState('')
  const [batchSubmitting, setBatchSubmitting] = useState(false)

  // Single approve modal state
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [approveEmail, setApproveEmail] = useState('')
  const [approveCohortTag, setApproveCohortTag] = useState('')
  const [approveSubmitting, setApproveSubmitting] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const me = await apiFetch<{ user?: { role?: string } }>('/auth/me')
        const currentRole = me?.user?.role || null
        setRole(currentRole)
        if (!currentRole || !PLATFORM_ROLES.includes(currentRole)) {
          setError('Platform admin access required.')
          setEntries([])
          setTotal(0)
          return
        }
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
  }, [page, limit, reloadAt])

  const refresh = () => setReloadAt(Date.now())

  const handleRunBatch = async () => {
    setBatchSubmitting(true)
    setActionMessage(null)
    const load = async () => {
      try {
        await apiFetch('/marketing/waitlist/invite-batch', {
          method: 'POST',
          body: JSON.stringify({
            limit: Number.isFinite(batchLimit) ? batchLimit : 10,
            cohortTag: batchCohortTag.trim() || undefined,
          }),
        })
        setActionMessage('Batch invite triggered.')
        setShowBatchModal(false)
        refresh()
      } catch (err: any) {
        setActionMessage(err?.message || 'Failed to trigger batch invite.')
      } finally {
        setBatchSubmitting(false)
      }
    }
    load()
  }

  const handleApprove = async () => {
    setApproveSubmitting(true)
    setActionMessage(null)
    try {
      await apiFetch('/marketing/waitlist/approve', {
        method: 'POST',
        body: JSON.stringify({
          email: approveEmail,
          cohortTag: approveCohortTag.trim() || undefined,
        }),
      })
      setActionMessage(`Invite sent to ${approveEmail}.`)
      setShowApproveModal(false)
      refresh()
    } catch (err: any) {
      setActionMessage(err?.message || 'Failed to approve/invite entry.')
    } finally {
      setApproveSubmitting(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / limit))
  const canManage = !!role && PLATFORM_ROLES.includes(role)

  return (
    <section className="dashboard-grid">
      <section className="glass-card">
        <div className="badge">Waitlist admin</div>
        <h1>Waitlist cohorts</h1>
        <p className="subtitle">
          Review pending, invited, and activated waitlist entries. Use this view to confirm the lifecycle and cohorts
          before inviting new organizations.
        </p>
        {actionMessage && <div className="feedback">{actionMessage}</div>}
        {error && <div className="feedback error">{error}</div>}
        {loading && !error && <div className="feedback">Loading entries.</div>}

        {canManage && (
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <button
              type="button"
              className="btn-primary px-4 py-2 rounded-full text-sm"
              onClick={() => {
                setBatchLimit(10)
                setBatchCohortTag('')
                setShowBatchModal(true)
              }}
            >
              Run batch invite
            </button>
            <div className="text-xs text-muted-foreground">
              High-impact actions (batch invite/approve) require confirmation.
            </div>
          </div>
        )}

        {!loading && !error && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Page {page} of {totalPages} {'\u00b7'} {total} total entries
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
                    <th className="px-4 py-2">Phone</th>
                    <th className="px-4 py-2">Name</th>
                    <th className="px-4 py-2">Role</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Email verify</th>
                    <th className="px-4 py-2">SMS verify</th>
                    <th className="px-4 py-2">Cohort</th>
                    <th className="px-4 py-2">Created</th>
                    <th className="px-4 py-2">Invited</th>
                    <th className="px-4 py-2">Activated</th>
                    {canManage && <th className="px-4 py-2">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    (() => {
                      const fullyVerified = e.verifyStatus === 'verified' && e.phoneVerifyStatus === 'verified'
                      return (
                    <tr key={e.email} className="border-b border-border/40 last:border-none">
                      <td className="px-4 py-2">{e.email}</td>
                      <td className="px-4 py-2">{maskPhone(e.phone)}</td>
                      <td className="px-4 py-2">{e.name}</td>
                      <td className="px-4 py-2">{e.role}</td>
                      <td className="px-4 py-2">{e.status}</td>
                      <td className="px-4 py-2">{e.verifyStatus}</td>
                      <td className="px-4 py-2">{e.phoneVerifyStatus || '-'}</td>
                      <td className="px-4 py-2">{e.cohortTag || '-'}</td>
                      <td className="px-4 py-2">{new Date(e.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-2">
                        {e.invitedAt ? new Date(e.invitedAt).toLocaleString() : '-'}
                      </td>
                      <td className="px-4 py-2">
                        {e.activatedAt ? new Date(e.activatedAt).toLocaleString() : '-'}
                      </td>
                      {canManage && (
                        <td className="px-4 py-2">
                          {e.status === 'pending-cohort' ? (
                            fullyVerified ? (
                              <button
                                type="button"
                                className="btn-secondary px-3 py-1 rounded-full text-xs"
                                onClick={() => {
                                  setApproveEmail(e.email)
                                  setApproveCohortTag(e.cohortTag || '')
                                  setShowApproveModal(true)
                                }}
                              >
                                Invite now
                              </button>
                            ) : (
                              <span className="text-xs text-muted-foreground">Needs verification</span>
                            )
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </td>
                      )}
                    </tr>
                      )
                    })()
                  ))}
                  {entries.length === 0 && (
                    <tr>
                      <td className="px-4 py-6 text-center text-muted-foreground" colSpan={canManage ? 12 : 11}>
                        No waitlist entries yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {showBatchModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="w-full max-w-md rounded-2xl bg-[color:var(--panel)] border border-border p-6 space-y-4">
            <div>
              <div className="text-lg font-semibold">Confirm batch invite</div>
              <div className="text-sm text-muted-foreground">
                This will send invites to the next set of verified, pending-cohort entries. High-impact action—please
                confirm before proceeding.
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium">Limit</label>
              <input
                type="number"
                min={1}
                max={100}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                value={batchLimit}
                onChange={(e) => setBatchLimit(parseInt(e.target.value || '0', 10))}
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium">Cohort tag (optional)</label>
              <input
                type="text"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                value={batchCohortTag}
                onChange={(e) => setBatchCohortTag(e.target.value)}
                placeholder="e.g., wave-1"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary px-4 py-2 rounded-full text-sm"
                onClick={() => setShowBatchModal(false)}
                disabled={batchSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary px-4 py-2 rounded-full text-sm"
                onClick={handleRunBatch}
                disabled={batchSubmitting}
              >
                {batchSubmitting ? 'Running…' : 'Confirm batch invite'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showApproveModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="w-full max-w-md rounded-2xl bg-[color:var(--panel)] border border-border p-6 space-y-4">
            <div>
              <div className="text-lg font-semibold">Confirm invite</div>
              <div className="text-sm text-muted-foreground">
                Send an invite now for <span className="font-medium">{approveEmail}</span>. This action will move the
                entry to invited status and trigger the email.
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium">Cohort tag (optional)</label>
              <input
                type="text"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                value={approveCohortTag}
                onChange={(e) => setApproveCohortTag(e.target.value)}
                placeholder="e.g., wave-1"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary px-4 py-2 rounded-full text-sm"
                onClick={() => setShowApproveModal(false)}
                disabled={approveSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary px-4 py-2 rounded-full text-sm"
                onClick={handleApprove}
                disabled={approveSubmitting}
              >
                {approveSubmitting ? 'Sending…' : 'Confirm invite'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
