'use client'

import { useEffect, useMemo, useState } from 'react'

import { ApiError, apiFetch } from '../../../../lib/api'
import { hasAnyRole } from '../../../../lib/rbac'
import { cn } from '../../../../lib/utils'

type SessionUser = {
  id?: string
  role?: string
  roles?: string[]
  orgId?: string
}

type Contact = {
  _id?: string
  id?: string
  name: string
  personType?: string
  company?: string | null
  archivedAt?: string | null
}

export default function CompaniesPage() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadAt, setReloadAt] = useState(0)

  const canView = useMemo(() => hasAnyRole(user, ['admin']), [user])
  const refresh = () => setReloadAt(Date.now())

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      setContacts([])
      try {
        const me = await apiFetch<{ user?: SessionUser }>('/auth/me')
        const currentUser = me?.user || null
        setUser(currentUser)
        if (!currentUser?.id) {
          setError('You need to sign in to view companies.')
          return
        }
        if (!hasAnyRole(currentUser, ['admin'])) {
          setError('Org admin access required to view companies.')
          return
        }
        const qs = new URLSearchParams()
        qs.set('personType', 'external')
        const res = await apiFetch<Contact[]>(`/contacts?${qs.toString()}`)
        setContacts(Array.isArray(res) ? res : [])
      } catch (err: any) {
        setError(err instanceof ApiError ? err.message : 'Unable to load companies.')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [reloadAt])

  const companies = useMemo(() => {
    const map = new Map<string, { name: string; contactCount: number }>()
    contacts.forEach((contact) => {
      if (contact.archivedAt) return
      const company = (contact.company || '').trim()
      if (!company) return
      const key = company.toLowerCase()
      const existing = map.get(key)
      if (existing) {
        existing.contactCount += 1
        return
      }
      map.set(key, { name: company, contactCount: 1 })
    })
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [contacts])

  return (
    <section className="space-y-6">
      <div className="glass-card space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="badge">Org Settings</div>
            <h1>Companies</h1>
            <p className="subtitle">
              v1 view derived from external contacts. v2 will introduce a dedicated Company entity (types, locations,
              ratings, RFQ workflows).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn secondary" onClick={refresh} disabled={loading}>
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>
        </div>

        {error && <div className={cn('feedback error')}>{error}</div>}
      </div>

      {canView && (
        <div className="glass-card space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2>External companies</h2>
            <div className="muted">{companies.length} companies</div>
          </div>

          {companies.length === 0 ? (
            <div className="muted">No companies found yet. Add external contacts in People or import a list.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Contacts</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((company) => (
                    <tr key={company.name}>
                      <td>{company.name}</td>
                      <td className="muted">{company.contactCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

