'use client'

import { useEffect, useMemo, useState } from 'react'

import { ApiError, apiFetch } from '../../../lib/api'
import { cn } from '../../../lib/utils'

type Notification = {
  _id?: string
  id?: string
  type?: string
  payload?: Record<string, any>
  read?: boolean
  readAt?: string | null
  createdAt?: string
}

type ListResponse<T> = {
  data: T[]
  total: number
  page: number
  limit: number
}

const formatDateTime = (value?: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

const buildMessage = (notification: Notification) => {
  const type = notification.type || 'notification'
  const payload = notification.payload || {}
  if (type === 'invite.created') {
    return `Invite sent to ${payload.email || 'unknown email'}`
  }
  if (type === 'invite.accepted') {
    return `Invite accepted by ${payload.email || 'new user'}`
  }
  return type.replace(/_/g, ' ')
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [total, setTotal] = useState(0)
  const [includeRead, setIncludeRead] = useState(true)
  const [page, setPage] = useState(1)
  const limit = 25
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadAt, setReloadAt] = useState(0)

  const refresh = () => setReloadAt(Date.now())

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const qs = new URLSearchParams()
        if (!includeRead) qs.set('read', 'false')
        qs.set('page', String(page))
        qs.set('limit', String(limit))
        const res = await apiFetch<ListResponse<Notification>>(`/notifications?${qs.toString()}`)
        setNotifications(Array.isArray(res?.data) ? res.data : [])
        setTotal(typeof res?.total === 'number' ? res.total : Array.isArray(res?.data) ? res.data.length : 0)
      } catch (err: any) {
        setError(err instanceof ApiError ? err.message : 'Unable to load notifications.')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [includeRead, page, limit, reloadAt])

  useEffect(() => {
    setPage(1)
  }, [includeRead])

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(total / limit))
  }, [total, limit])

  const handleMarkRead = async (id?: string) => {
    if (!id) return
    setError(null)
    try {
      await apiFetch(`/notifications/${id}/read`, { method: 'PATCH' })
      refresh()
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Unable to mark notification as read.')
    }
  }

  return (
    <section className="space-y-6">
      <div className="glass-card space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="badge">Inbox</div>
            <h1>Notifications</h1>
            <p className="subtitle">Invite updates, role changes, and system activity for your account.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn secondary" type="button" onClick={refresh} disabled={loading}>
              {loading ? 'Loading.' : 'Refresh'}
            </button>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={includeRead} onChange={(e) => setIncludeRead(e.target.checked)} />
          Include read
        </label>

        {error && <div className={cn('feedback error')}>{error}</div>}
      </div>

      <div className="glass-card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2>Latest</h2>
          <div className="muted">
            Page {page} of {totalPages}
          </div>
        </div>

        {notifications.length === 0 ? (
          <div className="muted">No notifications yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr>
                  <th>Message</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {notifications.map((notif) => {
                  const id = notif.id || notif._id || ''
                  const read = !!notif.read
                  return (
                    <tr key={id} className={cn(read && 'opacity-70')}>
                      <td>
                        <div className="space-y-1">
                          <div className="font-semibold">{buildMessage(notif)}</div>
                          {notif.payload?.details ? <div className="muted text-xs">{notif.payload.details}</div> : null}
                        </div>
                      </td>
                      <td>{read ? 'Read' : 'Unread'}</td>
                      <td>{formatDateTime(notif.createdAt)}</td>
                      <td className="text-right">
                        <button className="btn secondary" type="button" disabled={read || !id} onClick={() => handleMarkRead(id)}>
                          Mark read
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
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
            onClick={() => setPage((p) => p + 1)}
            disabled={loading || page >= totalPages}
          >
            Next
          </button>
        </div>
      </div>
    </section>
  )
}
