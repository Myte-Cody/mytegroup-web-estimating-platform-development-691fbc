'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { FormEvent, useEffect, useMemo, useState } from 'react'

import { ApiError, apiFetch } from '../../../../../../lib/api'
import { hasAnyRole } from '../../../../../../lib/rbac'
import { cn } from '../../../../../../lib/utils'

type SessionUser = {
  id?: string
  role?: string
  roles?: string[]
  orgId?: string
}

type CompanyLocation = {
  _id?: string
  id?: string
  companyId: string
  name: string
  city?: string | null
  region?: string | null
  country?: string | null
  email?: string | null
  phone?: string | null
  tagKeys?: string[]
  notes?: string | null
  archivedAt?: string | null
  piiStripped?: boolean
  legalHold?: boolean
  createdAt?: string
  updatedAt?: string
}

const splitList = (value: string) => {
  return (value || '')
    .split(/[,;\n]/g)
    .map((item) => item.trim())
    .filter(Boolean)
}

const joinList = (items?: Array<string | null | undefined>) => {
  return (items || [])
    .map((item) => (item || '').trim())
    .filter(Boolean)
    .join(', ')
}

export default function CompanyLocationDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const id = String((params as any)?.id || '')

  const [user, setUser] = useState<SessionUser | null>(null)
  const [location, setLocation] = useState<CompanyLocation | null>(null)

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const canManage = useMemo(() => hasAnyRole(user, ['admin']), [user])

  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [region, setRegion] = useState('')
  const [country, setCountry] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [tagsText, setTagsText] = useState('')
  const [notes, setNotes] = useState('')

  const refresh = async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const me = await apiFetch<{ user?: SessionUser }>('/auth/me')
      const currentUser = me?.user || null
      setUser(currentUser)
      if (!currentUser?.id) {
        setError('You need to sign in to manage company locations.')
        return
      }
      if (!hasAnyRole(currentUser, ['admin'])) {
        setError('Org admin access required to manage company locations.')
        return
      }

      const loc = await apiFetch<CompanyLocation>(`/company-locations/${id}?includeArchived=1`)
      setLocation(loc)
      setName(loc.name || '')
      setCity(loc.city || '')
      setRegion(loc.region || '')
      setCountry(loc.country || '')
      setEmail(loc.email || '')
      setPhone(loc.phone || '')
      setTagsText(joinList(loc.tagKeys))
      setNotes(loc.notes || '')
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Unable to load location.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const isArchived = !!location?.archivedAt
  const isLegalHold = !!location?.legalHold

  const canSave = useMemo(() => {
    if (!canManage) return false
    if (saving) return false
    if (!location) return false
    if (isArchived) return false
    if (isLegalHold) return false
    return name.trim() !== ''
  }, [canManage, saving, location, isArchived, isLegalHold, name])

  const onSave = async (event: FormEvent) => {
    event.preventDefault()
    if (!canSave) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      await apiFetch(`/company-locations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: name.trim(),
          city: city.trim() || undefined,
          region: region.trim() || undefined,
          country: country.trim() || undefined,
          email: email.trim() ? email.trim().toLowerCase() : undefined,
          phone: phone.trim() || undefined,
          tagKeys: splitList(tagsText),
          notes: notes.trim() || undefined,
        }),
      })
      setSuccess('Location updated.')
      await refresh()
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Failed to save location.')
    } finally {
      setSaving(false)
    }
  }

  const onArchiveToggle = async () => {
    if (!location) return
    setError(null)
    setSuccess(null)
    try {
      const endpoint = isArchived ? 'unarchive' : 'archive'
      await apiFetch(`/company-locations/${id}/${endpoint}`, { method: 'POST' })
      setSuccess(isArchived ? 'Location restored.' : 'Location archived.')
      await refresh()
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Failed to update location status.')
    }
  }

  const backHref = location?.companyId ? `/dashboard/settings/companies/${location.companyId}` : '/dashboard/settings/companies'

  return (
    <section className="space-y-6">
      <div className="glass-card space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="badge">Org Settings</div>
            <h1>Company location</h1>
            <p className="subtitle">{location ? `${location.name} · ${isArchived ? 'Archived' : 'Active'}` : 'Loading location.'}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link href={backHref} className="btn secondary">
              Back
            </Link>
            <button type="button" className="btn secondary" onClick={() => void refresh()} disabled={loading || saving}>
              Refresh
            </button>
            {location && (
              <button type="button" className="btn secondary" onClick={onArchiveToggle} disabled={!canManage || loading || saving || isLegalHold}>
                {isArchived ? 'Restore' : 'Archive'}
              </button>
            )}
          </div>
        </div>

        {loading && <div className="feedback subtle">Loading.</div>}
        {error && <div className={cn('feedback error')}>{error}</div>}
        {success && <div className={cn('feedback success')}>{success}</div>}
        {isLegalHold && <div className="feedback subtle">This location is under legal hold. Edits are blocked.</div>}
        {isArchived && <div className="feedback subtle">Restore this location to make edits.</div>}
      </div>

      {canManage && (
        <form onSubmit={onSave} className="glass-card space-y-5">
          <div className="form-grid md:grid-cols-2">
            <label className="md:col-span-2">
              Name <span className="text-red-400">*</span>
              <input value={name} onChange={(e) => setName(e.target.value)} disabled={!canSave} />
            </label>

            <label>
              City
              <input value={city} onChange={(e) => setCity(e.target.value)} disabled={!canSave} />
            </label>

            <label>
              Region
              <input value={region} onChange={(e) => setRegion(e.target.value)} disabled={!canSave} />
            </label>

            <label>
              Country
              <input value={country} onChange={(e) => setCountry(e.target.value)} disabled={!canSave} />
            </label>

            <label>
              Email
              <input value={email} onChange={(e) => setEmail(e.target.value)} disabled={!canSave} />
            </label>

            <label>
              Phone
              <input value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!canSave} />
            </label>

            <label className="md:col-span-2">
              Tags <span className="muted">(comma-separated)</span>
              <input value={tagsText} onChange={(e) => setTagsText(e.target.value)} disabled={!canSave} />
            </label>

            <label className="md:col-span-2">
              Notes
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} disabled={!canSave} />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" className="btn primary" disabled={!canSave}>
              {saving ? 'Saving.' : 'Save changes'}
            </button>
            <button type="button" className="btn secondary" onClick={() => router.push(backHref)} disabled={saving}>
              Done
            </button>
          </div>
        </form>
      )}
    </section>
  )
}

