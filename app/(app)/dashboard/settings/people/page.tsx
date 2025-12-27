'use client'

import Link from 'next/link'
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

type UserRecord = {
  _id?: string
  id?: string
  email?: string
  username?: string
  role?: string
  roles?: string[]
  organizationId?: string
  archivedAt?: string | null
  piiStripped?: boolean
  legalHold?: boolean
  createdAt?: string
  updatedAt?: string
}

type Person = {
  _id?: string
  id?: string
  orgId?: string
  personType: 'internal_staff' | 'internal_union' | 'external_person'
  displayName: string
  title?: string | null
  orgLocationId?: string | null
  companyId?: string | null
  companyLocationId?: string | null
  ironworkerNumber?: string | null
  unionLocal?: string | null
  tagKeys?: string[]
  skillKeys?: string[]
  certifications?: Array<{
    name: string
    issuedAt?: string | null
    expiresAt?: string | null
    documentUrl?: string | null
    notes?: string | null
  }>
  rating?: number | null
  userId?: string | null
  emails?: Array<{ value: string; normalized?: string; isPrimary?: boolean }>
  phones?: Array<{ value: string; e164?: string; isPrimary?: boolean }>
  primaryEmail?: string | null
  primaryPhoneE164?: string | null
  archivedAt?: string | null
  piiStripped?: boolean
  legalHold?: boolean
  createdAt?: string
  updatedAt?: string
}

type Invite = {
  _id?: string
  id?: string
  email: string
  role: string
  status: 'pending' | 'accepted' | 'expired' | string
  personId?: string | null
  tokenExpires?: string
  createdAt?: string
  acceptedAt?: string | null
}

type Company = {
  _id?: string
  id?: string
  name: string
  companyTypeKeys?: string[]
  archivedAt?: string | null
}

type CompanyLocation = {
  _id?: string
  id?: string
  companyId: string
  name: string
  archivedAt?: string | null
}

type OrgLocation = {
  _id?: string
  id?: string
  name: string
  archivedAt?: string | null
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

type PeopleTab = 'staff' | 'ironworkers' | 'external'

const TAB_LABELS: Record<PeopleTab, string> = {
  staff: 'Staff (Users + directory)',
  ironworkers: 'Ironworkers',
  external: 'External',
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

export default function PeoplePage() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [tab, setTab] = useState<PeopleTab>('staff')
  const [includeArchived, setIncludeArchived] = useState(false)
  const [search, setSearch] = useState('')
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [tagFilter, setTagFilter] = useState('')
  const [skillFilter, setSkillFilter] = useState('')
  const [companyFilter, setCompanyFilter] = useState('')
  const [companyLocationFilter, setCompanyLocationFilter] = useState('')
  const [orgLocationFilter, setOrgLocationFilter] = useState('')
  const [page, setPage] = useState(1)
  const [staffPeopleTotal, setStaffPeopleTotal] = useState(0)
  const [peopleTotal, setPeopleTotal] = useState(0)
  const limit = 25
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [users, setUsers] = useState<UserRecord[]>([])
  const [staffPeople, setStaffPeople] = useState<Person[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [companyTypeOptions, setCompanyTypeOptions] = useState<TaxonomyValue[]>([])
  const [companyLocations, setCompanyLocations] = useState<CompanyLocation[]>([])
  const [orgLocations, setOrgLocations] = useState<OrgLocation[]>([])

  const [reloadAt, setReloadAt] = useState(0)
  const refresh = () => setReloadAt(Date.now())

  const canView = useMemo(() => hasAnyRole(user, ['admin']), [user])
  const canViewArchived = canView

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const me = await apiFetch<{ user?: SessionUser }>('/auth/me')
        const currentUser = me?.user || null
        setUser(currentUser)
        setUsers([])
        setStaffPeople([])
        setStaffPeopleTotal(0)
        setPeople([])
        setPeopleTotal(0)
        setInvites([])
        setCompanies([])
        setCompanyLocations([])
        setOrgLocations([])

        if (!currentUser?.id) {
          setError('You need to sign in to manage people.')
          return
        }

        if (!hasAnyRole(currentUser, ['admin'])) {
          setError('Org admin access required to view the People directory.')
          return
        }

        const [inviteRes, orgLocationsRes] = await Promise.allSettled([
          apiFetch<Invite[]>('/invites'),
          apiFetch<OrgLocation[]>('/org-locations?includeArchived=1'),
        ])

        if (inviteRes.status === 'fulfilled') {
          setInvites(Array.isArray(inviteRes.value) ? inviteRes.value : [])
        }

        if (orgLocationsRes.status === 'fulfilled') {
          setOrgLocations(Array.isArray(orgLocationsRes.value) ? orgLocationsRes.value : [])
        }

        if (tab === 'staff') {
          const qsUsers = new URLSearchParams()
          if (includeArchived) qsUsers.set('includeArchived', '1')

          const qsPeople = new URLSearchParams()
          if (includeArchived && canViewArchived) qsPeople.set('includeArchived', '1')
          qsPeople.set('personType', 'internal_staff')
          qsPeople.set('page', String(page))
          qsPeople.set('limit', String(limit))
          if (search.trim()) qsPeople.set('search', search.trim())
          if (tagFilter.trim()) qsPeople.set('tag', tagFilter.trim())
          if (skillFilter.trim()) qsPeople.set('skillKey', skillFilter.trim())
          if (orgLocationFilter.trim()) qsPeople.set('orgLocationId', orgLocationFilter.trim())

          const results = await Promise.allSettled([
            apiFetch<UserRecord[]>(`/users?${qsUsers.toString()}`),
            apiFetch<ListResponse<Person> | Person[]>(`/persons?${qsPeople.toString()}`),
          ])

          const usersRes = results[0]
          const peopleRes = results[1]

          if (usersRes.status === 'fulfilled') {
            setUsers(Array.isArray(usersRes.value) ? usersRes.value : [])
          } else {
            throw usersRes.reason
          }

          if (peopleRes.status === 'fulfilled') {
            const rows = Array.isArray(peopleRes.value) ? peopleRes.value : peopleRes.value.data
            const totalCount = Array.isArray(peopleRes.value) ? rows.length : peopleRes.value.total
            setStaffPeople(Array.isArray(rows) ? rows : [])
            setStaffPeopleTotal(typeof totalCount === 'number' ? totalCount : 0)
          } else {
            throw peopleRes.reason
          }
          return
        }

        const qs = new URLSearchParams()
        if (includeArchived && canViewArchived) qs.set('includeArchived', '1')
        const personType = tab === 'ironworkers' ? 'internal_union' : 'external_person'
        qs.set('personType', personType)
        qs.set('page', String(page))
        qs.set('limit', String(limit))
        if (search.trim()) qs.set('search', search.trim())
        if (tagFilter.trim()) qs.set('tag', tagFilter.trim())
        if (skillFilter.trim()) qs.set('skillKey', skillFilter.trim())
        if (tab === 'ironworkers' && orgLocationFilter.trim()) {
          qs.set('orgLocationId', orgLocationFilter.trim())
        }
        if (tab === 'external' && companyFilter.trim()) {
          qs.set('companyId', companyFilter.trim())
        }
        if (tab === 'external' && companyLocationFilter.trim()) {
          qs.set('companyLocationId', companyLocationFilter.trim())
        }

        const fetches: Array<Promise<any>> = [apiFetch<ListResponse<Person> | Person[]>(`/persons?${qs.toString()}`)]
        let companiesIdx: number | null = null
        let locationsIdx: number | null = null
        let taxonomyIdx: number | null = null
        if (tab === 'external') {
          const companiesQs = new URLSearchParams()
          if (includeArchived && canViewArchived) companiesQs.set('includeArchived', '1')
          companiesIdx = fetches.length
          fetches.push(apiFetch<Company[]>(`/companies?${companiesQs.toString()}`))

          if (companyTypeOptions.length === 0) {
            taxonomyIdx = fetches.length
            fetches.push(apiFetch<TaxonomyDoc>('/org-taxonomy/company_type'))
          }

          if (companyFilter.trim()) {
            const locationsQs = new URLSearchParams()
            locationsQs.set('companyId', companyFilter.trim())
            if (includeArchived && canViewArchived) locationsQs.set('includeArchived', '1')
            locationsIdx = fetches.length
            fetches.push(apiFetch<CompanyLocation[]>(`/company-locations?${locationsQs.toString()}`))
          } else {
            setCompanyLocations([])
          }
        } else {
          setCompanyLocations([])
        }

        const results = await Promise.allSettled(fetches)
        const peopleRes = results[0]
        if (peopleRes.status === 'fulfilled') {
          const rows = Array.isArray(peopleRes.value) ? peopleRes.value : peopleRes.value.data
          const totalCount = Array.isArray(peopleRes.value) ? rows.length : peopleRes.value.total
          setPeople(Array.isArray(rows) ? rows : [])
          setPeopleTotal(typeof totalCount === 'number' ? totalCount : 0)
        } else {
          throw peopleRes.reason
        }

        if (tab === 'external') {
          const companiesRes = companiesIdx !== null ? results[companiesIdx] : null
          if (companiesRes && companiesRes.status === 'fulfilled') setCompanies(Array.isArray(companiesRes.value) ? companiesRes.value : [])

          const locationsRes = locationsIdx !== null ? results[locationsIdx] : null
          if (locationsRes && locationsRes.status === 'fulfilled') {
            setCompanyLocations(Array.isArray(locationsRes.value) ? locationsRes.value : [])
          }

          const taxonomyRes = taxonomyIdx !== null ? results[taxonomyIdx] : null
          if (taxonomyRes && taxonomyRes.status === 'fulfilled') {
            const values = Array.isArray(taxonomyRes.value?.values) ? taxonomyRes.value.values : []
            setCompanyTypeOptions(values.filter((v: TaxonomyValue) => !v.archivedAt))
          }
        }
      } catch (err: any) {
        const message =
          err instanceof ApiError
            ? err.status === 401 || err.status === 403
              ? 'You need a valid admin session to view people.'
              : err.message
            : 'Unable to load people.'
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [
    tab,
    includeArchived,
    canViewArchived,
    reloadAt,
    page,
    limit,
    search,
    tagFilter,
    skillFilter,
    companyFilter,
    companyLocationFilter,
    orgLocationFilter,
  ])

  useEffect(() => {
    setPage(1)
    if (tab !== 'external') {
      setCompanyFilter('')
      setCompanyLocationFilter('')
      setCompanyLocations([])
    }
    if (tab === 'external') setOrgLocationFilter('')
  }, [tab])

  useEffect(() => {
    setCompanyLocationFilter('')
  }, [companyFilter])

  useEffect(() => {
    setPage(1)
  }, [includeArchived, search, tagFilter, skillFilter, companyFilter, companyLocationFilter, orgLocationFilter])

  const userRows = useMemo(() => {
    const sorted = [...users]
    sorted.sort((a, b) => (a.email || '').localeCompare(b.email || ''))
    return sorted
  }, [users])

  const peopleRows = useMemo(() => {
    const sorted = [...people]
    sorted.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''))
    return sorted
  }, [people])

  const staffPeopleRows = useMemo(() => {
    const sorted = [...staffPeople]
    sorted.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''))
    return sorted
  }, [staffPeople])

  const createHref = useMemo(() => {
    const base = '/dashboard/settings/people/persons/new'
    if (tab === 'staff') return `${base}?personType=staff`
    if (tab === 'ironworkers') return `${base}?personType=ironworker`
    return `${base}?personType=external`
  }, [tab])

  const createLabel = useMemo(() => {
    if (tab === 'staff') return 'New staff person'
    if (tab === 'ironworkers') return 'New ironworker'
    return 'New external person'
  }, [tab])

  const invitesByPersonId = useMemo(() => {
    const score: Record<string, number> = { expired: 1, accepted: 2, pending: 3 }
    const map = new Map<string, Invite>()
    invites.forEach((invite) => {
      const personId = (invite.personId || '').trim()
      if (!personId) return
      const existing = map.get(personId)
      if (!existing) {
        map.set(personId, invite)
        return
      }
      const existingScore = score[String(existing.status)] || 0
      const nextScore = score[String(invite.status)] || 0
      if (nextScore > existingScore) map.set(personId, invite)
    })
    return map
  }, [invites])

  const companiesById = useMemo(() => {
    const map = new Map<string, Company>()
    companies.forEach((company) => {
      const id = company.id || company._id
      if (id) map.set(id, company)
    })
    return map
  }, [companies])

  const companyTypeLabelsByKey = useMemo(() => {
    const map = new Map<string, string>()
    companyTypeOptions.forEach((value) => {
      if (!value || value.archivedAt) return
      map.set(value.key, value.label)
    })
    return map
  }, [companyTypeOptions])

  const formatCompanyTypes = (keys?: string[]) => {
    const list = Array.isArray(keys) ? keys.filter(Boolean) : []
    if (!list.length) return ''
    return list.map((key) => companyTypeLabelsByKey.get(key) || key.replace(/_/g, ' ')).join(', ')
  }

  const companyOptions = useMemo(() => {
    const sorted = [...companies]
    sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    return sorted
  }, [companies])

  const companyLocationOptions = useMemo(() => {
    const sorted = [...companyLocations]
    sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    return sorted
  }, [companyLocations])

  const orgLocationOptions = useMemo(() => {
    const sorted = [...orgLocations]
    sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    return sorted
  }, [orgLocations])

  const directoryTotal = useMemo(() => {
    return tab === 'staff' ? staffPeopleTotal : peopleTotal
  }, [tab, staffPeopleTotal, peopleTotal])

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(directoryTotal / limit))
  }, [directoryTotal, limit])

  const activeAdvancedFilterCount = useMemo(() => {
    return [tagFilter, skillFilter, companyFilter, companyLocationFilter, orgLocationFilter].filter((value) => value.trim()).length
  }, [tagFilter, skillFilter, companyFilter, companyLocationFilter, orgLocationFilter])

  return (
    <section className="space-y-6">
      <div className="glass-card space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="badge">Directory</div>
            <h1>People</h1>
            <p className="subtitle">Staff users, ironworkers, and external people (suppliers/subcontractors).</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn secondary" onClick={refresh} disabled={loading}>
              {loading ? 'Loading…' : 'Refresh'}
            </button>
            <Link href={createHref} className="btn secondary">
              {createLabel}
            </Link>
            <Link href="/dashboard/settings/people/import" className="btn primary">
              Import
            </Link>
            <Link href="/dashboard/invites" className="btn secondary">
              Invites
            </Link>
          </div>
        </div>

        {error && <div className={cn('feedback error')}>{error}</div>}

        {canView && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {(Object.keys(TAB_LABELS) as PeopleTab[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  className={cn('btn', key === tab ? 'primary' : 'secondary')}
                  onClick={() => setTab(key)}
                >
                  {TAB_LABELS[key]}
                </button>
              ))}
              <label className="ml-auto flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={includeArchived}
                  onChange={(e) => setIncludeArchived(e.target.checked)}
                  disabled={!canViewArchived}
                />
                Include archived
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                Search
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Name, email, phone, ironworker #"
                  className="min-w-[220px]"
                />
              </label>

              <button
                type="button"
                className="btn secondary"
                onClick={() => setShowAdvancedFilters((prev) => !prev)}
                disabled={loading}
              >
                {showAdvancedFilters
                  ? 'Hide filters'
                  : activeAdvancedFilterCount > 0
                    ? `Filters (${activeAdvancedFilterCount})`
                    : 'Filters'}
              </button>

              {showAdvancedFilters && (
                <>
                  <label className="flex items-center gap-2 text-sm">
                    Tag key
                    <input
                      value={tagFilter}
                      onChange={(e) => setTagFilter(e.target.value)}
                      placeholder="person_tag key"
                      className="min-w-[180px]"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    Skill key
                    <input
                      value={skillFilter}
                      onChange={(e) => setSkillFilter(e.target.value)}
                      placeholder="person_skill key"
                      className="min-w-[180px]"
                    />
                  </label>

              {(tab === 'staff' || tab === 'ironworkers') && (
                <label className="flex items-center gap-2 text-sm">
                  Org location
                  <select value={orgLocationFilter} onChange={(e) => setOrgLocationFilter(e.target.value)}>
                    <option value="">All</option>
                    {orgLocationOptions.map((loc) => {
                      const id = loc.id || loc._id
                      if (!id) return null
                      const archived = !!loc.archivedAt
                      return (
                        <option key={id} value={id}>
                          {loc.name}
                          {archived ? ' (archived)' : ''}
                        </option>
                      )
                    })}
                  </select>
                </label>
              )}

              {tab === 'external' && (
                <label className="flex items-center gap-2 text-sm">
                  Company
                  <select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)}>
                    <option value="">All</option>
                    {companyOptions.map((company) => {
                      const id = company.id || company._id
                      if (!id) return null
                      const archived = !!company.archivedAt
                      return (
                        <option key={id} value={id}>
                          {company.name}
                          {archived ? ' (archived)' : ''}
                        </option>
                      )
                    })}
                  </select>
                </label>
              )}

              {tab === 'external' && companyFilter.trim() && (
                <label className="flex items-center gap-2 text-sm">
                  Company location
                  <select value={companyLocationFilter} onChange={(e) => setCompanyLocationFilter(e.target.value)}>
                    <option value="">All</option>
                    {companyLocationOptions.map((location) => {
                      const id = location.id || location._id
                      if (!id) return null
                      const archived = !!location.archivedAt
                      return (
                        <option key={id} value={id}>
                          {location.name}
                          {archived ? ' (archived)' : ''}
                        </option>
                      )
                    })}
                  </select>
                </label>
              )}

                </>
              )}

              <div className="ml-auto flex items-center gap-2 text-sm">
                <div className="muted">
                  Page {page} of {totalPages} · {directoryTotal} people
                </div>
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
          </>
        )}
      </div>

      {canView && tab === 'staff' && (
        <div className="space-y-6">
          <div className="glass-card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2>Staff users</h2>
              <div className="muted">{userRows.length} users</div>
            </div>

            {userRows.length === 0 ? (
              <div className="muted">No users found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table w-full">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userRows.map((row) => {
                      const id = row.id || row._id || row.email || Math.random().toString(16)
                      const archived = !!row.archivedAt
                      return (
                        <tr key={id} className={cn(archived && 'opacity-70')}>
                          <td>{row.email || '-'}</td>
                          <td>{row.role || 'user'}</td>
                          <td>{archived ? `Archived (${formatDateTime(row.archivedAt)})` : 'Active'}</td>
                          <td>{formatDateTime(row.createdAt)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="glass-card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2>Staff directory (People)</h2>
              <div className="muted">
                Page {page} of {totalPages} · {staffPeopleTotal} people
              </div>
            </div>

            {staffPeopleRows.length === 0 ? (
              <div className="muted">No staff people yet. Use "{createLabel}" to add a directory record.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table w-full">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Primary Email</th>
                      <th>Primary Phone</th>
                      <th>Invite</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffPeopleRows.map((row) => {
                      const rowId = row.id || row._id
                      const id = rowId || getPrimaryEmail(row) || row.displayName
                      const href = rowId ? `/dashboard/settings/people/persons/${rowId}` : null
                      const archived = !!row.archivedAt
                      const invite = rowId ? invitesByPersonId.get(rowId) : null
                      return (
                        <tr key={id} className={cn(archived && 'opacity-70')}>
                          <td>
                            {href ? (
                              <Link href={href} className="font-semibold text-[color:var(--text)]">
                                {row.displayName}
                              </Link>
                            ) : (
                              row.displayName
                            )}
                          </td>
                          <td>{getPrimaryEmail(row) || '-'}</td>
                          <td>{getPrimaryPhone(row) || '-'}</td>
                          <td>{invite ? invite.status : '-'}</td>
                          <td>{archived ? `Archived (${formatDateTime(row.archivedAt)})` : 'Active'}</td>
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

      {canView && tab !== 'staff' && (
        <div className="glass-card space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2>{TAB_LABELS[tab]}</h2>
            <div className="muted">
              Page {page} of {totalPages} · {peopleTotal} people
            </div>
          </div>

          {peopleRows.length === 0 ? (
            <div className="muted">No people found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Primary Email</th>
                    <th>Primary Phone</th>
                    {tab === 'external' && <th>Company</th>}
                    {tab === 'ironworkers' && <th>Ironworker #</th>}
                    <th>Rating</th>
                    <th>Invite</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {peopleRows.map((row) => {
                    const rowId = row.id || row._id
                    const id = rowId || getPrimaryEmail(row) || row.displayName
                    const href = rowId ? `/dashboard/settings/people/persons/${rowId}` : null
                    const archived = !!row.archivedAt
                    const invite = rowId ? invitesByPersonId.get(rowId) : null
                    const company = tab === 'external' && row.companyId ? companiesById.get(row.companyId) : null
                    return (
                      <tr key={id} className={cn(archived && 'opacity-70')}>
                        <td>
                          {href ? (
                            <Link href={href} className="font-semibold text-[color:var(--text)]">
                              {row.displayName}
                            </Link>
                          ) : (
                            row.displayName
                          )}
                        </td>
                        <td>{getPrimaryEmail(row) || '-'}</td>
                        <td>{getPrimaryPhone(row) || '-'}</td>
                        {tab === 'external' && (
                          <td>
                            {company ? (
                              <div className="space-y-0.5">
                                <Link href={`/dashboard/settings/companies/${company.id || company._id}`} className="font-semibold">
                                  {company.name}
                                </Link>
                                {company.companyTypeKeys?.length ? (
                                  <div className="muted text-xs">{formatCompanyTypes(company.companyTypeKeys)}</div>
                                ) : null}
                              </div>
                            ) : (
                              '-'
                            )}
                          </td>
                        )}
                        {tab === 'ironworkers' && <td>{row.ironworkerNumber || '-'}</td>}
                        <td>{typeof row.rating === 'number' ? row.rating : '-'}</td>
                        <td>{invite ? invite.status : '-'}</td>
                        <td>{archived ? `Archived (${formatDateTime(row.archivedAt)})` : 'Active'}</td>
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
