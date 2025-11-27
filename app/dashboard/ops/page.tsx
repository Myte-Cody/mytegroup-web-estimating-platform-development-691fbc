'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '../../lib/api'

type HealthResponse = {
  status: string
  redis: string
  queues?: { waitlistMail?: Record<string, any> }
  dlq?: Array<{ id?: string; failedReason?: string; finishedOn?: number; timestamp?: number }>
  flags?: Record<string, boolean>
}

export default function OpsDashboard() {
  const [data, setData] = useState<HealthResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiFetch<HealthResponse>('/health/full')
        setData(res)
        setError(null)
      } catch (err: any) {
        setError(err?.message || 'Failed to load health')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const flagList = Object.entries(data?.flags || {}).filter(([, v]) => v)
  const queue = data?.queues?.waitlistMail || {}

  return (
    <div className="max-w-4xl mx-auto py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Ops / Health</h1>
        <p className="text-sm text-muted-foreground">Redis, waitlist-mail queue, DLQ snapshots.</p>
      </div>

      {loading && <div className="text-sm">Loading…</div>}
      {error && <div className="text-sm text-red-500">Error: {error}</div>}

      {data && (
        <div className="space-y-4">
          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Overall</div>
                <div className="text-lg font-semibold">{data.status}</div>
              </div>
              <div className="text-sm">
                Redis: <span className={data.redis === 'ok' ? 'text-green-600' : 'text-red-500'}>{data.redis}</span>
              </div>
            </div>
            {flagList.length > 0 && (
              <div className="mt-3 text-sm text-amber-600">
                Flags: {flagList.map(([k]) => k).join(', ')}
              </div>
            )}
          </div>

          <div className="p-4 rounded-lg border bg-card space-y-2">
            <div className="font-semibold">waitlist-mail queue</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>waiting: {queue.waiting ?? 0}</div>
              <div>active: {queue.active ?? 0}</div>
              <div>failed: {queue.failed ?? 0}</div>
              <div>delayed: {queue.delayed ?? 0}</div>
            </div>
          </div>

          <div className="p-4 rounded-lg border bg-card space-y-2">
            <div className="font-semibold">DLQ (recent failures)</div>
            {(data.dlq && data.dlq.length > 0) ? (
              <ul className="space-y-1 text-sm">
                {data.dlq.map((item, idx) => (
                  <li key={item.id || idx} className="p-2 rounded bg-muted">
                    <div className="font-mono text-xs text-muted-foreground">#{item.id || 'n/a'}</div>
                    <div>{item.failedReason || 'No reason'}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-muted-foreground">No recent DLQ items.</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
