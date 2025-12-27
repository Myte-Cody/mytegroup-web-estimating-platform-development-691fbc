'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { FormEvent, useEffect, useMemo, useState } from 'react'

import { ApiError, apiFetch } from '../../../../../lib/api'
import { hasAnyRole } from '../../../../../lib/rbac'
import { cn } from '../../../../../lib/utils'

type SessionUser = {
  id?: string
  role?: string
  roles?: string[]
  orgId?: string
}

type Company = {
  _id?: string
  id?: string
  name: string
  externalId?: string | null
  website?: string | null
  mainEmail?: string | null
  mainPhone?: string | null
  companyTypeKeys?: string[]
  tagKeys?: string[]
  rating?: number | null
  notes?: string | null
  peopleCount?: number
  locationsCount?: number
  archivedAt?: string | null
  piiStripped?: boolean
  legalHold?: boolean
  createdAt?: string
  updatedAt?: string
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

type Person = {
  _id?: string
  id?: string
  personType: 'internal_staff' | 'internal_union' | 'external_person'
  displayName: string
  title?: string | null
  companyLocationId?: string | null
  primaryEmail?: string | null
  primaryPhoneE164?: string | null
  emails?: Array<{ value: string; isPrimary?: boolean }>
  phones?: Array<{ value: string; isPrimary?: boolean }>
  archivedAt?: string | null
  legalHold?: boolean
}

type GraphEdge = {
  _id?: string
  id?: string
  edgeTypeKey: string
  fromNodeType: 'person' | 'org_location' | 'company' | 'company_location'
  fromNodeId: string
  toNodeType: 'person' | 'org_location' | 'company' | 'company_location'
  toNodeId: string
  archivedAt?: string | null
  createdAt?: string
}

type ListResponse<T> = {
  data: T[]
  total: number
  page: number
  limit: number
}

type TabKey = 'overview' | 'locations' | 'people'

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

const formatDateTime = (value?: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

const getPrimaryEmail = (person: Person) => {
  const primary = person.emails?.find((e) => e?.isPrimary)?.value || person.emails?.[0]?.value
  return primary || person.primaryEmail || ''
}

const getPrimaryPhone = (person: Person) => {
  const primary = person.phones?.find((p) => p?.isPrimary)?.value || person.phones?.[0]?.value
  return primary || person.primaryPhoneE164 || ''
}

export default function CompanyDetailsPage() {
  const params = useParams()
  const id = String((params as any)?.id || '')

  const [user, setUser] = useState<SessionUser | null>(null)
  const canManage = useMemo(() => hasAnyRole(user, ['admin']), [user])

  const [tab, setTab] = useState<TabKey>('overview')
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [reloadAt, setReloadAt] = useState(0)
  const refresh = () => setReloadAt(Date.now())

  const isArchived = !!company?.archivedAt
  const isLegalHold = !!company?.legalHold
  const canEditCompany = canManage && !isArchived && !isLegalHold

  const [name, setName] = useState('')
  const [website, setWebsite] = useState('')
  const [mainEmail, setMainEmail] = useState('')
  const [mainPhone, setMainPhone] = useState('')
  const [companyTypesText, setCompanyTypesText] = useState('')
  const [tagsText, setTagsText] = useState('')
  const [ratingText, setRatingText] = useState('')
  const [notes, setNotes] = useState('')

  const [locations, setLocations] = useState<CompanyLocation[]>([])
  const [locationsTotal, setLocationsTotal] = useState(0)
  const [locationsPage, setLocationsPage] = useState(1)
  const [locationsSearch, setLocationsSearch] = useState('')
  const [locationsTagFilter, setLocationsTagFilter] = useState('')
  const [includeArchivedLocations, setIncludeArchivedLocations] = useState(false)
  const locationsLimit = 20

  const [newLocationName, setNewLocationName] = useState('')
  const [newLocationCity, setNewLocationCity] = useState('')
  const [newLocationRegion, setNewLocationRegion] = useState('')
  const [newLocationCountry, setNewLocationCountry] = useState('')
  const [newLocationEmail, setNewLocationEmail] = useState('')
  const [newLocationPhone, setNewLocationPhone] = useState('')
  const [newLocationTagsText, setNewLocationTagsText] = useState('')
  const [creatingLocation, setCreatingLocation] = useState(false)

  const [people, setPeople] = useState<Person[]>([])
  const [peopleTotal, setPeopleTotal] = useState(0)
  const [peoplePage, setPeoplePage] = useState(1)
  const [peopleSearch, setPeopleSearch] = useState('')
  const [peopleTypeFilter, setPeopleTypeFilter] = useState('')
  const [peopleLocationFilter, setPeopleLocationFilter] = useState('')
  const [includeArchivedPeople, setIncludeArchivedPeople] = useState(false)
  const peopleLimit = 20

  const [companyLocationsAll, setCompanyLocationsAll] = useState<CompanyLocation[]>([])
  const [primaryEdges, setPrimaryEdges] = useState<GraphEdge[]>([])
  const [includeArchivedPrimaryContacts, setIncludeArchivedPrimaryContacts] = useState(false)
  const [personLabels, setPersonLabels] = useState<Record<string, string>>({})

  const locationsTotalPages = useMemo(
    () => Math.max(1, Math.ceil(locationsTotal / locationsLimit)),
    [locationsTotal, locationsLimit]
  )
  const peopleTotalPages = useMemo(() => Math.max(1, Math.ceil(peopleTotal / peopleLimit)), [peopleTotal, peopleLimit])

  const locationNameById = useMemo(() => {
    const map = new Map<string, string>()
    companyLocationsAll.forEach((location) => {
      const locId = location.id || location._id
      if (locId) map.set(locId, location.name)
    })
    return map
  }, [companyLocationsAll])

  const activePrimaryEdgesByPersonId = useMemo(() => {
    const map = new Map<string, GraphEdge>()
    primaryEdges
      .filter(
        (edge) => edge.edgeTypeKey === 'primary_for' && edge.toNodeType === 'company' && edge.toNodeId === id && !edge.archivedAt
      )
      .forEach((edge) => {
        map.set(edge.fromNodeId, edge)
      })
    return map
  }, [primaryEdges, id])

  const sortedLocationOptions = useMemo(() => {
    return [...companyLocationsAll].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  }, [companyLocationsAll])

  useEffect(() => {
    const load = async () => {
      if (!id) return
      setLoading(true)
      setError(null)
      setSuccess(null)
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
        const res = await apiFetch<Company>(`/companies/${id}?includeArchived=1&includeCounts=1`)
        setCompany(res)
        setName(res?.name || '')
        setWebsite(res?.website || '')
        setMainEmail(res?.mainEmail || '')
        setMainPhone(res?.mainPhone || '')
        setCompanyTypesText(joinList(res?.companyTypeKeys))
        setTagsText(joinList(res?.tagKeys))
        setRatingText(typeof res?.rating === 'number' ? String(res.rating) : '')
        setNotes(res?.notes || '')
      } catch (err: any) {
        setError(err instanceof ApiError ? err.message : 'Unable to load company.')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [id, reloadAt])

  useEffect(() => {
    setLocationsPage(1)
  }, [locationsSearch, locationsTagFilter, includeArchivedLocations])

  useEffect(() => {
    setPeoplePage(1)
  }, [peopleSearch, peopleTypeFilter, peopleLocationFilter, includeArchivedPeople])

  const loadPersonLabel = async (personId: string) => {
    const key = (personId || '').trim()
    if (!key) return ''
    if (personLabels[key]) return personLabels[key]
    try {
      const person = await apiFetch<any>(`/persons/${key}?includeArchived=1`)
      const label = person?.displayName || person?.primaryEmail || key
      setPersonLabels((prev) => ({ ...prev, [key]: label }))
      return label
    } catch {
      setPersonLabels((prev) => ({ ...prev, [key]: key }))
      return key
    }
  }

  useEffect(() => {
    if (!id) return
    if (!canManage) return
    if (tab !== 'locations') return

    const loadLocations = async () => {
      setLoading(true)
      setError(null)
      try {
        const qs = new URLSearchParams()
        qs.set('companyId', id)
        qs.set('page', String(locationsPage))
        qs.set('limit', String(locationsLimit))
        if (includeArchivedLocations) qs.set('includeArchived', '1')
        if (locationsSearch.trim()) qs.set('search', locationsSearch.trim())
        if (locationsTagFilter.trim()) qs.set('tag', locationsTagFilter.trim())

        const res = await apiFetch<ListResponse<CompanyLocation> | CompanyLocation[]>(`/company-locations?${qs.toString()}`)
        const rows = Array.isArray(res) ? res : res.data
        const totalCount = Array.isArray(res) ? rows.length : res.total
        setLocations(Array.isArray(rows) ? rows : [])
        setLocationsTotal(typeof totalCount === 'number' ? totalCount : 0)
      } catch (err: any) {
        setError(err instanceof ApiError ? err.message : 'Unable to load locations.')
      } finally {
        setLoading(false)
      }
    }

    void loadLocations()
  }, [
    id,
    canManage,
    tab,
    locationsPage,
    locationsLimit,
    includeArchivedLocations,
    locationsSearch,
    locationsTagFilter,
    reloadAt,
  ])

  useEffect(() => {
    if (!id) return
    if (!canManage) return
    if (tab !== 'people') return

    const loadCompanyLocations = async () => {
      try {
        const qs = new URLSearchParams()
        qs.set('companyId', id)
        qs.set('includeArchived', '1')
        const res = await apiFetch<ListResponse<CompanyLocation> | CompanyLocation[]>(`/company-locations?${qs.toString()}`)
        const rows = Array.isArray(res) ? res : res.data
        setCompanyLocationsAll(Array.isArray(rows) ? rows : [])
      } catch {
        setCompanyLocationsAll([])
      }
    }

    void loadCompanyLocations()
  }, [id, canManage, tab, reloadAt])

  useEffect(() => {
    if (!id) return
    if (!canManage) return
    if (tab !== 'people') return

    const loadPeople = async () => {
      setLoading(true)
      setError(null)
      try {
        const qs = new URLSearchParams()
        qs.set('companyId', id)
        qs.set('page', String(peoplePage))
        qs.set('limit', String(peopleLimit))
        if (includeArchivedPeople) qs.set('includeArchived', '1')
        if (peopleSearch.trim()) qs.set('search', peopleSearch.trim())
        if (peopleTypeFilter.trim()) qs.set('personType', peopleTypeFilter.trim())
        if (peopleLocationFilter.trim()) qs.set('companyLocationId', peopleLocationFilter.trim())

        const res = await apiFetch<ListResponse<Person> | Person[]>(`/persons?${qs.toString()}`)
        const rows = Array.isArray(res) ? res : res.data
        const totalCount = Array.isArray(res) ? rows.length : res.total
        setPeople(Array.isArray(rows) ? rows : [])
        setPeopleTotal(typeof totalCount === 'number' ? totalCount : 0)

        const updates: Record<string, string> = {}
        ;(rows || []).forEach((person) => {
          const pid = (person.id || person._id || '').trim()
          if (!pid) return
          updates[pid] = person.displayName || getPrimaryEmail(person) || pid
        })
        if (Object.keys(updates).length) {
          setPersonLabels((prev) => ({ ...prev, ...updates }))
        }
      } catch (err: any) {
        setError(err instanceof ApiError ? err.message : 'Unable to load people.')
      } finally {
        setLoading(false)
      }
    }

    void loadPeople()
  }, [
    id,
    canManage,
    tab,
    peoplePage,
    peopleLimit,
    includeArchivedPeople,
    peopleSearch,
    peopleTypeFilter,
    peopleLocationFilter,
    reloadAt,
  ])

  useEffect(() => {
    if (!id) return
    if (!canManage) return
    if (tab !== 'people') return

    const loadPrimaryContacts = async () => {
      setError(null)
      try {
        const qs = new URLSearchParams()
        qs.set('edgeTypeKey', 'primary_for')
        qs.set('fromNodeType', 'person')
        qs.set('toNodeType', 'company')
        qs.set('toNodeId', id)
        if (includeArchivedPrimaryContacts) qs.set('includeArchived', '1')
        const res = await apiFetch<GraphEdge[] | ListResponse<GraphEdge>>(`/graph-edges?${qs.toString()}`)
        const rows = Array.isArray(res) ? res : res.data
        setPrimaryEdges(Array.isArray(rows) ? rows : [])

        const missing = Array.from(new Set((rows || []).map((edge) => edge.fromNodeId).filter(Boolean))).filter(
          (pid) => !personLabels[pid]
        )
        if (missing.length) {
          await Promise.all(missing.map((pid) => loadPersonLabel(pid)))
        }
      } catch (err: any) {
        setError(err instanceof ApiError ? err.message : 'Unable to load primary contacts.')
        setPrimaryEdges([])
      }
    }

    void loadPrimaryContacts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, canManage, tab, includeArchivedPrimaryContacts, reloadAt])

  const onSaveCompany = async (event: FormEvent) => {
    event.preventDefault()
    if (!company) return
    if (!canEditCompany) return

    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const normalizedRating = ratingText.trim() === '' ? null : Number(ratingText)
      await apiFetch(`/companies/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: name.trim(),
          website: website.trim() || null,
          mainEmail: mainEmail.trim() ? mainEmail.trim().toLowerCase() : null,
          mainPhone: mainPhone.trim() || null,
          companyTypeKeys: splitList(companyTypesText),
          tagKeys: splitList(tagsText),
          rating: Number.isFinite(normalizedRating as any) ? normalizedRating : null,
          notes: notes.trim() || null,
        }),
      })
      setSuccess('Company updated.')
      refresh()
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Failed to save company.')
    } finally {
      setSaving(false)
    }
  }

  const onArchiveToggleCompany = async () => {
    if (!company) return
    setError(null)
    setSuccess(null)
    try {
      const endpoint = isArchived ? 'unarchive' : 'archive'
      await apiFetch(`/companies/${id}/${endpoint}`, { method: 'POST' })
      setSuccess(isArchived ? 'Company restored.' : 'Company archived.')
      refresh()
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Failed to update company status.')
    }
  }

  const onCreateLocation = async (event: FormEvent) => {
    event.preventDefault()
    if (!canEditCompany) return
    if (!newLocationName.trim()) return
    setCreatingLocation(true)
    setError(null)
    setSuccess(null)
    try {
      await apiFetch('/company-locations', {
        method: 'POST',
        body: JSON.stringify({
          companyId: id,
          name: newLocationName.trim(),
          city: newLocationCity.trim() || undefined,
          region: newLocationRegion.trim() || undefined,
          country: newLocationCountry.trim() || undefined,
          email: newLocationEmail.trim() ? newLocationEmail.trim().toLowerCase() : undefined,
          phone: newLocationPhone.trim() || undefined,
          tagKeys: splitList(newLocationTagsText),
        }),
      })
      setNewLocationName('')
      setNewLocationCity('')
      setNewLocationRegion('')
      setNewLocationCountry('')
      setNewLocationEmail('')
      setNewLocationPhone('')
      setNewLocationTagsText('')
      setSuccess('Location created.')
      refresh()
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Failed to create location.')
    } finally {
      setCreatingLocation(false)
    }
  }

  const toggleLocationArchive = async (location: CompanyLocation) => {
    const locationId = location.id || location._id
    if (!locationId) return
    if (!canManage) return
    setError(null)
    setSuccess(null)
    try {
      const endpoint = location.archivedAt ? 'unarchive' : 'archive'
      await apiFetch(`/company-locations/${locationId}/${endpoint}`, { method: 'POST' })
      setSuccess(location.archivedAt ? 'Location restored.' : 'Location archived.')
      refresh()
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Failed to update location status.')
    }
  }

  const togglePrimaryForCompany = async (personId: string) => {
    const pid = (personId || '').trim()
    if (!pid) return
    if (!canManage) return
    if (!company) return
    if (company.legalHold) return
    setError(null)
    setSuccess(null)

    const active = activePrimaryEdgesByPersonId.get(pid)
    if (active) {
      const edgeId = active.id || active._id
      if (!edgeId) return
      try {
        await apiFetch(`/graph-edges/${edgeId}/archive`, { method: 'POST' })
        setSuccess('Primary contact removed.')
        refresh()
      } catch (err: any) {
        setError(err instanceof ApiError ? err.message : 'Failed to update primary contact.')
      }
      return
    }

    const archivedCandidate = includeArchivedPrimaryContacts
      ? primaryEdges.find((edge) => edge.fromNodeId === pid && edge.toNodeId === id && edge.archivedAt)
      : null

    try {
      if (archivedCandidate?.id || archivedCandidate?._id) {
        await apiFetch(`/graph-edges/${archivedCandidate.id || archivedCandidate._id}/unarchive`, { method: 'POST' })
      } else {
        await apiFetch('/graph-edges', {
          method: 'POST',
          body: JSON.stringify({
            edgeTypeKey: 'primary_for',
            fromNodeType: 'person',
            fromNodeId: pid,
            toNodeType: 'company',
            toNodeId: id,
          }),
        })
      }
      setSuccess('Primary contact added.')
      refresh()
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Failed to set primary contact.')
    }
  }

  const togglePrimaryEdge = async (edge: GraphEdge) => {
    const edgeId = edge.id || edge._id
    if (!edgeId) return
    if (!canManage) return
    if (!company) return
    if (company.legalHold) return

    setError(null)
    setSuccess(null)
    try {
      const endpoint = edge.archivedAt ? 'unarchive' : 'archive'
      await apiFetch(`/graph-edges/${edgeId}/${endpoint}`, { method: 'POST' })
      setSuccess(edge.archivedAt ? 'Primary contact restored.' : 'Primary contact archived.')
      refresh()
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Failed to update primary contact.')
    }
  }

  const backHref = '/dashboard/settings/companies'
  const peopleCreateHref = `/dashboard/settings/people/persons/new?personType=external&companyId=${encodeURIComponent(id)}`

  return (
    <section className="space-y-6">
      <div className="glass-card space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="badge">Org Settings</div>
            <h1>Company</h1>
            <p className="subtitle">{company ? `${company.name} - ${isArchived ? 'Archived' : 'Active'}` : 'Loading company.'}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link href={backHref} className="btn secondary">
              Back
            </Link>
            <button type="button" className="btn secondary" onClick={refresh} disabled={loading || saving}>
              Refresh
            </button>
            {company && (
              <button
                type="button"
                className="btn secondary"
                onClick={onArchiveToggleCompany}
                disabled={!canManage || loading || saving || isLegalHold}
              >
                {isArchived ? 'Restore' : 'Archive'}
              </button>
            )}
          </div>
        </div>

        {loading && <div className="feedback subtle">Loading.</div>}
        {error && <div className={cn('feedback error')}>{error}</div>}
        {success && <div className={cn('feedback success')}>{success}</div>}
        {isLegalHold && <div className="feedback subtle">This company is under legal hold. Edits are blocked.</div>}

        {company && (
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <div>People: {typeof company.peopleCount === 'number' ? company.peopleCount : '-'}</div>
            <div>Locations: {typeof company.locationsCount === 'number' ? company.locationsCount : '-'}</div>
            <div>Created: {formatDateTime(company.createdAt)}</div>
          </div>
        )}
      </div>

      {company && canManage && (
        <div className="glass-card space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={cn('btn secondary', tab === 'overview' && 'ring-2 ring-sky-500')}
              onClick={() => setTab('overview')}
            >
              Overview
            </button>
            <button
              type="button"
              className={cn('btn secondary', tab === 'locations' && 'ring-2 ring-sky-500')}
              onClick={() => setTab('locations')}
            >
              Locations
            </button>
            <button
              type="button"
              className={cn('btn secondary', tab === 'people' && 'ring-2 ring-sky-500')}
              onClick={() => setTab('people')}
            >
              People
            </button>
            <div className="ml-auto muted text-sm">ID: {id}</div>
          </div>

          {tab === 'overview' && (
            <form onSubmit={onSaveCompany} className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2>Profile</h2>
                <div className="muted">Edit company details and tags.</div>
              </div>

              <div className="form-grid md:grid-cols-2">
                <label className="md:col-span-2">
                  Name <span className="text-red-400">*</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} disabled={!canEditCompany || saving} />
                </label>

                <label>
                  Website
                  <input value={website} onChange={(e) => setWebsite(e.target.value)} disabled={!canEditCompany || saving} />
                </label>

                <label>
                  Main email
                  <input
                    value={mainEmail}
                    onChange={(e) => setMainEmail(e.target.value)}
                    disabled={!canEditCompany || saving}
                    placeholder="dispatch@example.com"
                  />
                </label>

                <label>
                  Main phone
                  <input value={mainPhone} onChange={(e) => setMainPhone(e.target.value)} disabled={!canEditCompany || saving} />
                </label>

                <label>
                  Company types <span className="muted">(comma-separated)</span>
                  <input
                    value={companyTypesText}
                    onChange={(e) => setCompanyTypesText(e.target.value)}
                    disabled={!canEditCompany || saving}
                    placeholder="subcontractor, supplier"
                  />
                </label>

                <label>
                  Tags <span className="muted">(comma-separated)</span>
                  <input value={tagsText} onChange={(e) => setTagsText(e.target.value)} disabled={!canEditCompany || saving} placeholder="preferred, galvanizing" />
                </label>

                <label>
                  Rating
                  <input value={ratingText} onChange={(e) => setRatingText(e.target.value)} disabled={!canEditCompany || saving} placeholder="1-5" />
                </label>

                <label className="md:col-span-2">
                  Notes
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!canEditCompany || saving} rows={5} />
                </label>
              </div>

              <button className="btn primary" type="submit" disabled={!canEditCompany || saving || name.trim() === ''}>
                {saving ? 'Saving.' : 'Save company'}
              </button>
            </form>
          )}
          {tab === 'locations' && (
            <div className="space-y-6">
              <form onSubmit={onCreateLocation} className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2>New location</h2>
                  <div className="muted">Add a branch/site for this company.</div>
                </div>

                <div className="form-grid md:grid-cols-2">
                  <label className="md:col-span-2">
                    Name <span className="text-red-400">*</span>
                    <input
                      value={newLocationName}
                      onChange={(e) => setNewLocationName(e.target.value)}
                      disabled={!canEditCompany || creatingLocation}
                      placeholder="e.g. Calgary Yard"
                    />
                  </label>

                  <label>
                    City
                    <input value={newLocationCity} onChange={(e) => setNewLocationCity(e.target.value)} disabled={!canEditCompany || creatingLocation} />
                  </label>

                  <label>
                    Region
                    <input value={newLocationRegion} onChange={(e) => setNewLocationRegion(e.target.value)} disabled={!canEditCompany || creatingLocation} />
                  </label>

                  <label>
                    Country
                    <input value={newLocationCountry} onChange={(e) => setNewLocationCountry(e.target.value)} disabled={!canEditCompany || creatingLocation} />
                  </label>

                  <label>
                    Email
                    <input
                      value={newLocationEmail}
                      onChange={(e) => setNewLocationEmail(e.target.value)}
                      disabled={!canEditCompany || creatingLocation}
                      placeholder="dispatch@example.com"
                    />
                  </label>

                  <label>
                    Phone
                    <input value={newLocationPhone} onChange={(e) => setNewLocationPhone(e.target.value)} disabled={!canEditCompany || creatingLocation} />
                  </label>

                  <label className="md:col-span-2">
                    Tags <span className="muted">(comma-separated)</span>
                    <input
                      value={newLocationTagsText}
                      onChange={(e) => setNewLocationTagsText(e.target.value)}
                      disabled={!canEditCompany || creatingLocation}
                      placeholder="yard, shop"
                    />
                  </label>
                </div>

                <button className="btn primary" type="submit" disabled={!canEditCompany || creatingLocation || newLocationName.trim() === ''}>
                  {creatingLocation ? 'Creating.' : 'Create location'}
                </button>
              </form>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2>Locations</h2>
                  <div className="muted">
                    Page {locationsPage} of {locationsTotalPages} - {locationsTotal} locations
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    Search
                    <input value={locationsSearch} onChange={(e) => setLocationsSearch(e.target.value)} placeholder="Name" className="min-w-[220px]" />
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    Tag key
                    <input
                      value={locationsTagFilter}
                      onChange={(e) => setLocationsTagFilter(e.target.value)}
                      placeholder="company_location_tag key"
                      className="min-w-[220px]"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={includeArchivedLocations}
                      onChange={(e) => setIncludeArchivedLocations(e.target.checked)}
                    />
                    Include archived
                  </label>

                  <div className="ml-auto flex items-center gap-2">
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={() => setLocationsPage((p) => Math.max(1, p - 1))}
                      disabled={loading || locationsPage <= 1}
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={() => setLocationsPage((p) => Math.min(locationsTotalPages, p + 1))}
                      disabled={loading || locationsPage >= locationsTotalPages}
                    >
                      Next
                    </button>
                  </div>
                </div>

                {locations.length === 0 ? (
                  <div className="muted">No locations found.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="table w-full">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>City</th>
                          <th>Email</th>
                          <th>Phone</th>
                          <th>Status</th>
                          <th className="text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {locations.map((location) => {
                          const locationId = location.id || location._id
                          const archived = !!location.archivedAt
                          const viewHref = locationId ? `/dashboard/settings/companies/locations/${locationId}` : null
                          return (
                            <tr key={locationId || location.name} className={cn(archived && 'opacity-70')}>
                              <td>
                                {viewHref ? (
                                  <Link href={viewHref} className="font-semibold text-[color:var(--text)]">
                                    {location.name}
                                  </Link>
                                ) : (
                                  location.name
                                )}
                              </td>
                              <td className="muted">{location.city || '-'}</td>
                              <td className="muted">{location.email || '-'}</td>
                              <td className="muted">{location.phone || '-'}</td>
                              <td>{archived ? 'Archived' : 'Active'}</td>
                              <td className="text-right">
                                <button
                                  type="button"
                                  className="btn secondary"
                                  onClick={() => void toggleLocationArchive(location)}
                                  disabled={!canManage || !!location.legalHold}
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
            </div>
          )}
          {tab === 'people' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2>People</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={peopleCreateHref} className="btn secondary">
                    New person
                  </Link>
                  <button type="button" className="btn secondary" onClick={refresh} disabled={loading}>
                    Refresh
                  </button>
                </div>
              </div>

              <div className="glass-card space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold">Primary contacts</h3>
                    <div className="muted text-sm">Uses `GraphEdge(primary_for)` person → company.</div>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={includeArchivedPrimaryContacts}
                      onChange={(e) => setIncludeArchivedPrimaryContacts(e.target.checked)}
                    />
                    Include archived edges
                  </label>
                </div>

                {primaryEdges.length === 0 ? (
                  <div className="muted">No primary contacts set.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="table w-full">
                      <thead>
                        <tr>
                          <th>Person</th>
                          <th>Status</th>
                          <th className="text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {primaryEdges.map((edge) => {
                          const edgeId = edge.id || edge._id || `${edge.fromNodeId}:${edge.toNodeId}`
                          const archived = !!edge.archivedAt
                          const personLabel = personLabels[edge.fromNodeId] || edge.fromNodeId
                          return (
                            <tr key={edgeId} className={cn(archived && 'opacity-70')}>
                              <td className="font-semibold text-[color:var(--text)]">{personLabel}</td>
                              <td>{archived ? 'Archived' : 'Active'}</td>
                              <td className="text-right">
                                <button
                                  type="button"
                                  className="btn secondary"
                                  onClick={() => void togglePrimaryEdge(edge)}
                                  disabled={!canManage || !!company.legalHold}
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

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base font-semibold">Directory</h3>
                  <div className="muted">
                    Page {peoplePage} of {peopleTotalPages} - {peopleTotal} people
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    Search
                    <input
                      value={peopleSearch}
                      onChange={(e) => setPeopleSearch(e.target.value)}
                      placeholder="Name/email"
                      className="min-w-[220px]"
                    />
                  </label>

                  <label className="flex items-center gap-2 text-sm">
                    Type
                    <select value={peopleTypeFilter} onChange={(e) => setPeopleTypeFilter(e.target.value)} className="min-w-[220px]">
                      <option value="">All</option>
                      <option value="internal_staff">internal_staff</option>
                      <option value="internal_union">internal_union</option>
                      <option value="external_person">external_person</option>
                    </select>
                  </label>

                  <label className="flex items-center gap-2 text-sm">
                    Location
                    <select value={peopleLocationFilter} onChange={(e) => setPeopleLocationFilter(e.target.value)} className="min-w-[220px]">
                      <option value="">All</option>
                      {sortedLocationOptions.map((loc) => {
                        const locId = loc.id || loc._id
                        if (!locId) return null
                        return (
                          <option key={locId} value={locId}>
                            {loc.name}
                          </option>
                        )
                      })}
                    </select>
                  </label>

                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={includeArchivedPeople} onChange={(e) => setIncludeArchivedPeople(e.target.checked)} />
                    Include archived
                  </label>

                  <div className="ml-auto flex items-center gap-2">
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={() => setPeoplePage((p) => Math.max(1, p - 1))}
                      disabled={loading || peoplePage <= 1}
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={() => setPeoplePage((p) => Math.min(peopleTotalPages, p + 1))}
                      disabled={loading || peoplePage >= peopleTotalPages}
                    >
                      Next
                    </button>
                  </div>
                </div>

                {people.length === 0 ? (
                  <div className="muted">No people found for this company.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="table w-full">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Title</th>
                          <th>Type</th>
                          <th>Location</th>
                          <th>Email</th>
                          <th>Phone</th>
                          <th>Primary</th>
                          <th className="text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {people.map((person) => {
                          const personId = person.id || person._id
                          const archived = !!person.archivedAt
                          const isPrimary = !!(personId && activePrimaryEdgesByPersonId.has(personId))
                          const viewHref = personId ? `/dashboard/settings/people/persons/${personId}` : null
                          const locationName = person.companyLocationId ? locationNameById.get(person.companyLocationId) : ''
                          return (
                            <tr key={personId || person.displayName} className={cn(archived && 'opacity-70')}>
                              <td>
                                {viewHref ? (
                                  <Link href={viewHref} className="font-semibold text-[color:var(--text)]">
                                    {person.displayName}
                                  </Link>
                                ) : (
                                  person.displayName
                                )}
                              </td>
                              <td className="muted">{person.title || '-'}</td>
                              <td className="muted">{person.personType}</td>
                              <td className="muted">{locationName || (person.companyLocationId ? person.companyLocationId : '-')}</td>
                              <td className="muted">{getPrimaryEmail(person) || '-'}</td>
                              <td className="muted">{getPrimaryPhone(person) || '-'}</td>
                              <td>{isPrimary ? 'Yes' : 'No'}</td>
                              <td className="text-right">
                                <button
                                  type="button"
                                  className="btn secondary"
                                  onClick={() => void togglePrimaryForCompany(personId || '')}
                                  disabled={!canManage || !!person.legalHold || !!company.legalHold}
                                >
                                  {isPrimary ? 'Unset' : 'Set'}
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
            </div>
          )}
        </div>
      )}
    </section>
  )
}
