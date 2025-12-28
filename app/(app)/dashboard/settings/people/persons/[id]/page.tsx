'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { FormEvent, useEffect, useMemo, useState } from 'react'

import { ApiError, apiFetch } from '../../../../../../lib/api'
import { hasAnyRole } from '../../../../../../lib/rbac'
import { cn } from '../../../../../../lib/utils'
import { joinList, normalizeOptionalString, splitList, toDateInputValue } from '../person-utils'

type SessionUser = {
  id?: string
  role?: string
  roles?: string[]
  orgId?: string
}

type Office = {
  _id?: string
  id?: string
  name: string
  archivedAt?: string | null
}

type Organization = {
  _id?: string
  id?: string
  name?: string
  archivedAt?: string | null
  piiStripped?: boolean
  legalHold?: boolean
}

type PersonCertification = {
  name: string
  issuedAt?: string | null
  expiresAt?: string | null
  documentUrl?: string | null
  notes?: string | null
}

type Person = {
  _id?: string
  id?: string
  orgId?: string
  personType: 'internal_staff' | 'internal_union' | 'external_person'
  displayName: string
  firstName?: string | null
  lastName?: string | null
  title?: string | null
  departmentKey?: string | null
  dateOfBirth?: string | null
  emails?: Array<{ value: string; normalized?: string; isPrimary?: boolean }>
  phones?: Array<{ value: string; e164?: string; isPrimary?: boolean }>
  primaryEmail?: string | null
  primaryPhoneE164?: string | null
  tagKeys?: string[]
  skillKeys?: string[]
  orgLocationId?: string | null
  reportsToPersonId?: string | null
  companyId?: string | null
  companyLocationId?: string | null
  ironworkerNumber?: string | null
  unionLocal?: string | null
  certifications?: PersonCertification[]
  rating?: number | null
  notes?: string | null
  userId?: string | null
  archivedAt?: string | null
  piiStripped?: boolean
  legalHold?: boolean
  createdAt?: string
  updatedAt?: string
}

type Company = {
  _id?: string
  id?: string
  name: string
  archivedAt?: string | null
}

type CompanyLocation = {
  _id?: string
  id?: string
  companyId: string
  name: string
  archivedAt?: string | null
}

type PersonSummary = {
  _id?: string
  id?: string
  displayName: string
  archivedAt?: string | null
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

type GraphEdge = {
  _id?: string
  id?: string
  fromNodeType: 'person'
  fromNodeId: string
  toNodeType: 'person'
  toNodeId: string
  edgeTypeKey: string
  archivedAt?: string | null
  createdAt?: string
}

type CertificationFormRow = {
  name: string
  issuedAt: string
  expiresAt: string
  documentUrl: string
  notes: string
}

const DEFAULT_CERT_ROW: CertificationFormRow = {
  name: '',
  issuedAt: '',
  expiresAt: '',
  documentUrl: '',
  notes: '',
}

type UiPersonType = 'staff' | 'ironworker' | 'external'

const toUiPersonType = (value: Person['personType'] | string | undefined | null): UiPersonType => {
  if (value === 'internal_staff') return 'staff'
  if (value === 'internal_union') return 'ironworker'
  return 'external'
}

const toBackendPersonType = (value: UiPersonType) => {
  if (value === 'staff') return 'internal_staff'
  if (value === 'ironworker') return 'internal_union'
  return 'external_person'
}

const getPrimaryEmailValue = (p: Person | null) => {
  if (!p) return ''
  const email = p.emails?.find((e) => e?.isPrimary)?.value || p.emails?.[0]?.value
  return email || p.primaryEmail || ''
}

const getPrimaryPhoneValue = (p: Person | null) => {
  if (!p) return ''
  const phone = p.phones?.find((ph) => ph?.isPrimary)?.value || p.phones?.[0]?.value
  return phone || p.primaryPhoneE164 || ''
}

const INVITE_ROLE_OPTIONS = [
  { value: 'org_owner', label: 'Org Admin (Owner)' },
  { value: 'org_admin', label: 'Org Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'pm', label: 'PM' },
  { value: 'estimator', label: 'Estimator' },
  { value: 'engineer', label: 'Engineer' },
  { value: 'detailer', label: 'Detailer' },
  { value: 'foreman', label: 'Foreman' },
  { value: 'superintendent', label: 'Superintendent' },
  { value: 'qaqc', label: 'QAQC' },
  { value: 'hs', label: 'H&S' },
  { value: 'purchasing', label: 'Purchasing' },
  { value: 'finance', label: 'Finance' },
  { value: 'viewer', label: 'Viewer (read-only)' },
  { value: 'user', label: 'User (basic)' },
]

const EXTERNAL_TYPE_OPTIONS = [
  { value: 'supplier', label: 'Supplier' },
  { value: 'subcontractor', label: 'Subcontractor' },
  { value: 'client', label: 'Client' },
  { value: 'partner', label: 'Partner' },
  { value: 'misc', label: 'Misc' },
]

const EXTERNAL_TYPE_VALUES = EXTERNAL_TYPE_OPTIONS.map((opt) => opt.value)

const formatDateTime = (value?: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

export default function PersonDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const id = String((params as any)?.id || '')

  const [user, setUser] = useState<SessionUser | null>(null)
  const [org, setOrg] = useState<Organization | null>(null)
  const [person, setPerson] = useState<Person | null>(null)
  const [orgLocations, setOrgLocations] = useState<Office[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [companyLocations, setCompanyLocations] = useState<CompanyLocation[]>([])
  const [staffPeople, setStaffPeople] = useState<PersonSummary[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [includeArchivedReports, setIncludeArchivedReports] = useState(false)
  const [reportsToEdges, setReportsToEdges] = useState<GraphEdge[]>([])
  const [reportsFromEdges, setReportsFromEdges] = useState<GraphEdge[]>([])
  const [reportsLoading, setReportsLoading] = useState(false)
  const [reportsError, setReportsError] = useState<string | null>(null)
  const [reportsMessage, setReportsMessage] = useState<string | null>(null)
  const [reportsReloadAt, setReportsReloadAt] = useState(0)
  const [relatedPersonLabels, setRelatedPersonLabels] = useState<Record<string, string>>({})
  const [reportsToAddManagerId, setReportsToAddManagerId] = useState('')

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const canManage = useMemo(() => hasAnyRole(user, ['admin']), [user])

  const [personType, setPersonType] = useState<UiPersonType>('external')
  const [displayName, setDisplayName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [title, setTitle] = useState('')
  const [departmentKey, setDepartmentKey] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')

  const [emailsText, setEmailsText] = useState('')
  const [primaryEmail, setPrimaryEmail] = useState('')
  const [phonesText, setPhonesText] = useState('')
  const [primaryPhone, setPrimaryPhone] = useState('')

  const [skillsText, setSkillsText] = useState('')
  const [tagsText, setTagsText] = useState('')
  const [ratingText, setRatingText] = useState('')
  const [notes, setNotes] = useState('')

  const [orgLocationId, setOrgLocationId] = useState('')
  const [reportsToPersonId, setReportsToPersonId] = useState('')

  const [companyId, setCompanyId] = useState('')
  const [companyLocationId, setCompanyLocationId] = useState('')

  const [ironworkerNumber, setIronworkerNumber] = useState('')
  const [unionLocal, setUnionLocal] = useState('')
  const [certifications, setCertifications] = useState<CertificationFormRow[]>([{ ...DEFAULT_CERT_ROW }])
  const [showAdvanced, setShowAdvanced] = useState(false)

  const [inviteRole, setInviteRole] = useState('viewer')
  const [inviteExpiresInHours, setInviteExpiresInHours] = useState(72)
  const [inviting, setInviting] = useState(false)

  const emails = useMemo(() => splitList(emailsText).map((email) => email.toLowerCase()), [emailsText])
  const phones = useMemo(() => splitList(phonesText), [phonesText])
  const externalType = useMemo(() => {
    const tags = splitList(tagsText)
    return EXTERNAL_TYPE_VALUES.find((value) => tags.some((tag) => tag.toLowerCase() === value)) || ''
  }, [tagsText])

  const updateExternalType = (next: string) => {
    const tags = splitList(tagsText).filter((tag) => !EXTERNAL_TYPE_VALUES.includes(tag.toLowerCase()))
    if (next) tags.unshift(next)
    setTagsText(joinList(tags))
  }

  useEffect(() => {
    if (!emails.length) {
      setPrimaryEmail('')
      return
    }
    if (!primaryEmail || !emails.includes(primaryEmail.toLowerCase())) {
      setPrimaryEmail(emails[0])
    }
  }, [emails, primaryEmail])

  useEffect(() => {
    if (!phones.length) {
      setPrimaryPhone('')
      return
    }
    if (!primaryPhone || !phones.includes(primaryPhone)) {
      setPrimaryPhone(phones[0])
    }
  }, [phones, primaryPhone])

  useEffect(() => {
    const loadLocations = async () => {
      if (!companyId) {
        setCompanyLocations([])
        setCompanyLocationId('')
        return
      }
      try {
        const qs = new URLSearchParams()
        qs.set('companyId', companyId)
        const res = await apiFetch<CompanyLocation[]>(`/company-locations?${qs.toString()}`)
        setCompanyLocations(Array.isArray(res) ? res : [])
      } catch {
        setCompanyLocations([])
      }
    }
    void loadLocations()
  }, [companyId])

  const refresh = async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const me = await apiFetch<{ user?: SessionUser }>('/auth/me')
      const currentUser = me?.user || null
      setUser(currentUser)
      setOrg(null)
      if (!currentUser?.id) {
        setError('You need to sign in to view people.')
        return
      }
      if (!currentUser?.orgId) {
        setError('Your session is missing an organization scope. Ask Platform Ops to assign you to an org.')
        return
      }
      if (!hasAnyRole(currentUser, ['admin'])) {
        setError('Org admin access required to manage people.')
        return
      }

      const results = await Promise.allSettled([
        apiFetch<Person>(`/persons/${id}?includeArchived=1`),
        apiFetch<Office[]>('/org-locations?includeArchived=1'),
        apiFetch<Company[]>('/companies?includeArchived=1'),
        apiFetch<PersonSummary[]>('/persons?personType=internal_staff&includeArchived=1'),
        apiFetch<Invite[]>('/invites'),
        apiFetch<Organization>(`/organizations/${currentUser.orgId}`),
      ])

      const personRes = results[0]
      const orgLocationsRes = results[1]
      const companiesRes = results[2]
      const staffRes = results[3]
      const invitesRes = results[4]
      const orgRes = results[5]

      if (orgLocationsRes.status === 'fulfilled') {
        setOrgLocations(Array.isArray(orgLocationsRes.value) ? orgLocationsRes.value : [])
      }

      if (companiesRes.status === 'fulfilled') {
        setCompanies(Array.isArray(companiesRes.value) ? companiesRes.value : [])
      }

      if (staffRes.status === 'fulfilled') {
        setStaffPeople(Array.isArray(staffRes.value) ? staffRes.value : [])
      }

      if (invitesRes.status === 'fulfilled') {
        setInvites(Array.isArray(invitesRes.value) ? invitesRes.value : [])
      }

      if (orgRes.status === 'fulfilled') {
        setOrg(orgRes.value)
      } else {
        const err = orgRes.reason
        setError((prev) => prev || (err instanceof ApiError ? err.message : 'Unable to load organization.'))
      }

      if (personRes.status === 'fulfilled') {
        const p = personRes.value
        setPerson(p)

        setPersonType(toUiPersonType(p.personType))
        setDisplayName(p.displayName || '')
        setFirstName(p.firstName || '')
        setLastName(p.lastName || '')
        setTitle(p.title || '')
        setDepartmentKey(p.departmentKey || '')
        setDateOfBirth(toDateInputValue(p.dateOfBirth || null))

        const emailValues = (p.emails || []).map((e) => e.value).filter(Boolean)
        setEmailsText(emailValues.join(', '))
        setPrimaryEmail(getPrimaryEmailValue(p))

        const phoneValues = (p.phones || []).map((ph) => ph.value).filter(Boolean)
        setPhonesText(phoneValues.join(', '))
        setPrimaryPhone(getPrimaryPhoneValue(p))

        setSkillsText(joinList(p.skillKeys))
        setTagsText(joinList(p.tagKeys))
        setRatingText(typeof p.rating === 'number' ? String(p.rating) : '')
        setNotes(p.notes || '')
        setOrgLocationId(p.orgLocationId || '')
        setReportsToPersonId(p.reportsToPersonId || '')
        setCompanyId(p.companyId || '')
        setCompanyLocationId(p.companyLocationId || '')
        setIronworkerNumber(p.ironworkerNumber || '')
        setUnionLocal(p.unionLocal || '')

        const certRows = (p.certifications || []).map((cert) => ({
          name: cert.name || '',
          issuedAt: toDateInputValue(cert.issuedAt || null),
          expiresAt: toDateInputValue(cert.expiresAt || null),
          documentUrl: cert.documentUrl || '',
          notes: cert.notes || '',
        }))
        setCertifications(certRows.length ? certRows : [{ ...DEFAULT_CERT_ROW }])
      } else {
        const err = personRes.reason
        setError(err instanceof ApiError ? err.message : 'Unable to load person.')
      }
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Unable to load person.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    if (!canManage) return
    if (!id) return

    const load = async () => {
      setReportsLoading(true)
      setReportsError(null)
      try {
        const outgoingQs = new URLSearchParams()
        outgoingQs.set('edgeTypeKey', 'reports_to')
        outgoingQs.set('fromNodeType', 'person')
        outgoingQs.set('fromNodeId', id)
        outgoingQs.set('toNodeType', 'person')
        if (includeArchivedReports) outgoingQs.set('includeArchived', '1')

        const incomingQs = new URLSearchParams()
        incomingQs.set('edgeTypeKey', 'reports_to')
        incomingQs.set('fromNodeType', 'person')
        incomingQs.set('toNodeType', 'person')
        incomingQs.set('toNodeId', id)
        if (includeArchivedReports) incomingQs.set('includeArchived', '1')

        const results = await Promise.allSettled([
          apiFetch<GraphEdge[]>(`/graph-edges?${outgoingQs.toString()}`),
          apiFetch<GraphEdge[]>(`/graph-edges?${incomingQs.toString()}`),
        ])

        const outgoingRes = results[0]
        const incomingRes = results[1]

        if (outgoingRes.status === 'fulfilled') {
          setReportsToEdges(Array.isArray(outgoingRes.value) ? outgoingRes.value : [])
        } else {
          throw outgoingRes.reason
        }

        if (incomingRes.status === 'fulfilled') {
          setReportsFromEdges(Array.isArray(incomingRes.value) ? incomingRes.value : [])
        } else {
          throw incomingRes.reason
        }
      } catch (err: any) {
        const message = err instanceof ApiError ? err.message : 'Unable to load reports_to edges.'
        setReportsError(message)
      } finally {
        setReportsLoading(false)
      }
    }

    void load()
  }, [canManage, id, includeArchivedReports, reportsReloadAt])

  const sortedOrgLocations = useMemo(() => {
    return [...orgLocations].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  }, [orgLocations])

  const sortedCompanies = useMemo(() => {
    return [...companies].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  }, [companies])

  const sortedCompanyLocations = useMemo(() => {
    return [...companyLocations].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  }, [companyLocations])

  const sortedStaffPeople = useMemo(() => {
    return [...staffPeople]
      .filter((p) => !p.archivedAt)
      .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''))
  }, [staffPeople])

  const staffLabelById = useMemo(() => {
    const out: Record<string, string> = {}
    staffPeople.forEach((p) => {
      const pid = (p.id || p._id || '').trim()
      if (!pid) return
      out[pid] = p.displayName || pid
    })
    return out
  }, [staffPeople])

  const resolvePersonLabel = (personId: string) => {
    const pid = (personId || '').trim()
    if (!pid) return '-'
    if (pid === id) return person?.displayName || pid
    return staffLabelById[pid] || relatedPersonLabels[pid] || pid
  }

  useEffect(() => {
    if (!canManage) return

    const ids = new Set<string>()
    reportsToEdges.forEach((edge) => ids.add(String(edge.toNodeId || '').trim()))
    reportsFromEdges.forEach((edge) => ids.add(String(edge.fromNodeId || '').trim()))
    ids.delete(id)

    const missing = Array.from(ids).filter((pid) => pid && !staffLabelById[pid] && !relatedPersonLabels[pid])
    if (!missing.length) return

    const load = async () => {
      const results = await Promise.allSettled(
        missing.map((pid) => apiFetch<Person>(`/persons/${pid}?includeArchived=1`))
      )
      const updates: Record<string, string> = {}
      results.forEach((res, idx) => {
        const pid = missing[idx]
        if (!pid) return
        if (res.status === 'fulfilled') {
          updates[pid] = res.value?.displayName || res.value?.primaryEmail || pid
        } else {
          updates[pid] = pid
        }
      })
      setRelatedPersonLabels((prev) => ({ ...prev, ...updates }))
    }

    void load()
  }, [canManage, id, reportsToEdges, reportsFromEdges, staffLabelById, relatedPersonLabels])

  const orgLocationName = useMemo(() => {
    if (!person?.orgLocationId) return 'Unassigned'
    const match = orgLocations.find((o) => (o.id || o._id) === person.orgLocationId)
    return match?.name || person.orgLocationId
  }, [person?.orgLocationId, orgLocations])

  const orgLegalHold = !!org?.legalHold
  const orgArchived = !!org?.archivedAt
  const orgPiiStripped = !!org?.piiStripped
  const orgBlocked = orgLegalHold || orgArchived

  const isArchived = !!person?.archivedAt
  const isLegalHold = !!person?.legalHold

  const canSave = useMemo(() => {
    if (!canManage) return false
    if (saving) return false
    if (!person) return false
    if (orgBlocked) return false
    if (isArchived) return false
    if (isLegalHold) return false
    return displayName.trim() !== ''
  }, [canManage, saving, person, orgBlocked, isArchived, isLegalHold, displayName])

  const buildPayload = () => {
    const normalizedRating = ratingText.trim() === '' ? undefined : Number(ratingText)
    const emails = splitList(emailsText).map((email) => email.toLowerCase())
    const phones = splitList(phonesText)

    const certs = certifications
      .map((row) => ({
        name: row.name.trim(),
        issuedAt: row.issuedAt.trim() ? row.issuedAt.trim() : undefined,
        expiresAt: row.expiresAt.trim() ? row.expiresAt.trim() : undefined,
        documentUrl: normalizeOptionalString(row.documentUrl) || undefined,
        notes: normalizeOptionalString(row.notes) || undefined,
      }))
      .filter((row) => row.name)

    const payload: Record<string, any> = {
      personType: toBackendPersonType(personType),
      displayName: displayName.trim(),
      firstName: normalizeOptionalString(firstName) || undefined,
      lastName: normalizeOptionalString(lastName) || undefined,
      title: normalizeOptionalString(title) || undefined,
      departmentKey: normalizeOptionalString(departmentKey) || undefined,
      dateOfBirth: dateOfBirth.trim() ? dateOfBirth.trim() : undefined,
      emails: emails.length ? emails : undefined,
      primaryEmail: emails.length ? primaryEmail || emails[0] : undefined,
      phones: phones.length ? phones : undefined,
      primaryPhone: phones.length ? primaryPhone || phones[0] : undefined,
      skillKeys: splitList(skillsText),
      tagKeys: splitList(tagsText),
      rating: Number.isFinite(normalizedRating as any) ? normalizedRating : undefined,
      notes: normalizeOptionalString(notes) || undefined,
      orgLocationId: normalizeOptionalString(orgLocationId) || undefined,
      reportsToPersonId: normalizeOptionalString(reportsToPersonId) || undefined,
      companyId: normalizeOptionalString(companyId) || undefined,
      companyLocationId: normalizeOptionalString(companyLocationId) || undefined,
      ironworkerNumber: normalizeOptionalString(ironworkerNumber) || undefined,
      unionLocal: normalizeOptionalString(unionLocal) || undefined,
    }

    if (!payload.companyId) payload.companyLocationId = undefined
    if (certs.length) payload.certifications = certs
    return payload
  }

  const onSave = async (event: FormEvent) => {
    event.preventDefault()
    if (!canSave) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const payload = buildPayload()
      await apiFetch(`/persons/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
      setSuccess('Person updated.')
      await refresh()
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Failed to save person.')
    } finally {
      setSaving(false)
    }
  }

  const onArchiveToggle = async () => {
    if (!person) return
    setError(null)
    setSuccess(null)
    try {
      const endpoint = isArchived ? 'unarchive' : 'archive'
      await apiFetch(`/persons/${id}/${endpoint}`, { method: 'POST' })
      setSuccess(isArchived ? 'Person restored.' : 'Person archived.')
      await refresh()
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Failed to update archive status.')
    }
  }

  const inviteForPerson = useMemo<Invite | null>(() => {
    const score: Record<string, number> = { expired: 1, accepted: 2, pending: 3 }
    const matches = invites.filter((inv) => (inv.personId || '') === id)
    let best: Invite | null = null
    matches.forEach((inv) => {
      if (!best) {
        best = inv
        return
      }
      const nextScore = score[String(inv.status)] || 0
      const bestScore = score[String(best.status)] || 0
      if (nextScore > bestScore) best = inv
    })
    return best
  }, [invites, id])

  const primaryEmailValue = getPrimaryEmailValue(person)

  const inviteRoleOptions = useMemo(() => {
    if (!person) return []
    if (person.personType === 'internal_union') {
      return INVITE_ROLE_OPTIONS.filter((opt) => opt.value === 'foreman' || opt.value === 'superintendent')
    }
    if (person.personType === 'internal_staff') {
      return INVITE_ROLE_OPTIONS.filter((opt) => opt.value !== 'foreman')
    }
    return []
  }, [person?.personType])

  useEffect(() => {
    if (inviteRoleOptions.length && !inviteRoleOptions.some((opt) => opt.value === inviteRole)) {
      setInviteRole(inviteRoleOptions[0].value)
    }
  }, [inviteRoleOptions, inviteRole])

  const canInvite = useMemo(() => {
    if (!canManage) return false
    if (!person) return false
    if (!primaryEmailValue) return false
    if (orgBlocked) return false
    if (isArchived) return false
    if (isLegalHold) return false
    if (person.userId) return false
    if (inviteForPerson?.status === 'pending') return false
    if (person.personType === 'external_person') return false
    if (person.personType === 'internal_union' && inviteRole === 'foreman' && !person.ironworkerNumber) return false
    return !inviting
  }, [canManage, person, primaryEmailValue, orgBlocked, isArchived, isLegalHold, inviteForPerson?.status, inviteRole, inviting])

  const onInvite = async () => {
    if (!canInvite) return
    setInviting(true)
    setError(null)
    setSuccess(null)
    try {
      await apiFetch('/invites', {
        method: 'POST',
        body: JSON.stringify({
          personId: id,
          role: inviteRole,
          expiresInHours: Number(inviteExpiresInHours) || undefined,
        }),
      })
      setSuccess(`Invite sent to ${primaryEmailValue}.`)
      await refresh()
    } catch (err: any) {
      setError(err?.message || 'Failed to send invite.')
    } finally {
      setInviting(false)
    }
  }

  const canEditReports = useMemo(() => {
    if (!canManage) return false
    if (!person) return false
    if (orgBlocked) return false
    if (isArchived) return false
    if (isLegalHold) return false
    return true
  }, [canManage, person, orgBlocked, isArchived, isLegalHold])

  const refreshReports = () => setReportsReloadAt(Date.now())

  const toggleReportsEdge = async (edge: GraphEdge) => {
    const edgeId = edge.id || edge._id
    if (!edgeId) return
    if (!canEditReports) return
    setReportsError(null)
    setReportsMessage(null)
    try {
      const endpoint = edge.archivedAt ? 'unarchive' : 'archive'
      await apiFetch(`/graph-edges/${edgeId}/${endpoint}`, { method: 'POST' })
      setReportsMessage(edge.archivedAt ? 'Dotted-line report restored.' : 'Dotted-line report archived.')
      refreshReports()
    } catch (err: any) {
      setReportsError(err instanceof ApiError ? err.message : 'Failed to update dotted-line report.')
    }
  }

  const addReportsManager = async () => {
    const managerId = reportsToAddManagerId.trim()
    if (!managerId) return
    if (!canEditReports) return
    if (managerId === id) return

    setReportsError(null)
    setReportsMessage(null)
    try {
      await apiFetch('/graph-edges', {
        method: 'POST',
        body: JSON.stringify({
          edgeTypeKey: 'reports_to',
          fromNodeType: 'person',
          fromNodeId: id,
          toNodeType: 'person',
          toNodeId: managerId,
          metadata: {},
        }),
      })
      setReportsMessage('Dotted-line report added.')
      setReportsToAddManagerId('')
      refreshReports()
    } catch (err: any) {
      setReportsError(err instanceof ApiError ? err.message : 'Failed to add dotted-line report.')
    }
  }

  return (
    <section className="space-y-6">
      <div className="glass-card space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="badge">Org Settings</div>
            <h1>Person</h1>
            <p className="subtitle">
              {person ? (
                <>
                  {person.displayName} {'·'} {person.personType} {'·'} Org location: {orgLocationName}
                </>
              ) : (
                'Loading person details.'
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link href="/dashboard/settings/people" className="btn secondary">
              Back to People
            </Link>
            {person && (
              <button
                type="button"
                className="btn secondary"
                onClick={() => void refresh()}
                disabled={loading || saving || inviting}
              >
                Refresh
              </button>
            )}
            {person && (
              <button
                type="button"
                className="btn secondary"
                onClick={onArchiveToggle}
                disabled={!canManage || loading || saving || inviting || isLegalHold || orgBlocked}
              >
                {isArchived ? 'Restore' : 'Archive'}
              </button>
            )}
          </div>
        </div>

        {loading && <div className="feedback subtle">Loading.</div>}
        {error && <div className={cn('feedback error')}>{error}</div>}
        {success && <div className={cn('feedback success')}>{success}</div>}
        {orgLegalHold && (
          <div className="feedback subtle">
            Legal hold is enabled for this organization. People edits and invites are blocked until the hold is lifted.
          </div>
        )}
        {orgArchived && <div className="feedback subtle">This organization is archived. People edits are blocked.</div>}
        {orgPiiStripped && (
          <div className="feedback subtle">PII stripped is enabled for this organization. Some fields may be redacted.</div>
        )}

        {person && (
          <div className="info-grid">
            <div className="info-block">
              <div className="muted">Status</div>
              <div className="stat-value">{isArchived ? 'Archived' : 'Active'}</div>
            </div>
            <div className="info-block">
              <div className="muted">Legal hold</div>
              <div className="stat-value">{isLegalHold ? 'Yes' : 'No'}</div>
            </div>
            <div className="info-block">
              <div className="muted">PII stripped</div>
              <div className="stat-value">{person.piiStripped ? 'Yes' : 'No'}</div>
            </div>
            <div className="info-block">
              <div className="muted">Invite</div>
              <div className="stat-value">{inviteForPerson?.status || '-'}</div>
            </div>
            <div className="info-block">
              <div className="muted">Linked user</div>
              <div className="stat-value">{person.userId || '-'}</div>
            </div>
          </div>
        )}

        {person?.piiStripped && (
          <div className="feedback subtle">This person has PII stripped. Some fields may be redacted downstream.</div>
        )}
        {isLegalHold && <div className="feedback subtle">This person is under legal hold. Edits are blocked.</div>}
        {isArchived && <div className="feedback subtle">Restore this person to make edits.</div>}
      </div>

      {canManage && (
        <form onSubmit={onSave} className="glass-card space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="muted">Essentials first. Advanced fields are optional.</div>
            <button type="button" className="btn secondary" onClick={() => setShowAdvanced((prev) => !prev)}>
              {showAdvanced ? 'Hide advanced' : 'Show advanced'}
            </button>
          </div>

          <div className="form-grid md:grid-cols-2">
            <label>
              Person type
              <select value={personType} onChange={(e) => setPersonType(e.target.value as any)} disabled={!canSave}>
                <option value="staff">Staff (internal)</option>
                <option value="ironworker">Ironworker (internal union)</option>
                <option value="external">External (supplier/subcontractor/client)</option>
              </select>
            </label>

            <label>
              Display name <span className="muted">(required)</span>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} disabled={!canSave} />
            </label>

            {showAdvanced && (
              <>
                <label>
                  First name
                  <input value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={!canSave} />
                </label>

                <label>
                  Last name
                  <input value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={!canSave} />
                </label>
              </>
            )}

            {(personType === 'staff' || personType === 'ironworker') && showAdvanced && (
              <>
                <label>
                  Title
                  <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canSave} />
                </label>

                <label>
                  Department
                  <input value={departmentKey} onChange={(e) => setDepartmentKey(e.target.value)} disabled={!canSave} />
                </label>
              </>
            )}

            {personType === 'ironworker' && showAdvanced && (
              <label>
                Date of birth
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  disabled={!canSave}
                />
              </label>
            )}

            <label className="md:col-span-2">
              Emails (comma / newline separated)
              <textarea value={emailsText} onChange={(e) => setEmailsText(e.target.value)} rows={2} disabled={!canSave} />
            </label>

            <label>
              Primary email
              <select value={primaryEmail} onChange={(e) => setPrimaryEmail(e.target.value)} disabled={!canSave || !emails.length}>
                {!emails.length ? <option value="">Add emails to select</option> : null}
                {emails.map((email) => (
                  <option key={email} value={email}>
                    {email}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Phones (comma / newline separated)
              <textarea value={phonesText} onChange={(e) => setPhonesText(e.target.value)} rows={2} disabled={!canSave} />
              <div className="muted">Use E.164 (+15551234567) or 10-digit numbers.</div>
            </label>

            <label>
              Primary phone
              <select value={primaryPhone} onChange={(e) => setPrimaryPhone(e.target.value)} disabled={!canSave || !phones.length}>
                {!phones.length ? <option value="">Add phones to select</option> : null}
                {phones.map((phone) => (
                  <option key={phone} value={phone}>
                    {phone}
                  </option>
                ))}
              </select>
            </label>

            {(personType === 'staff' || personType === 'ironworker') && (
              <label>
                Org location (internal)
                <select value={orgLocationId} onChange={(e) => setOrgLocationId(e.target.value)} disabled={!canSave}>
                  <option value="">Unassigned</option>
                  {sortedOrgLocations.map((office) => {
                    const oid = office.id || office._id
                    if (!oid) return null
                    return (
                      <option key={oid} value={oid} disabled={!!office.archivedAt}>
                        {office.name}
                        {office.archivedAt ? ' (archived)' : ''}
                      </option>
                    )
                  })}
                </select>
              </label>
            )}

            {personType === 'staff' && (
              <label>
                Reports to
                <select value={reportsToPersonId} onChange={(e) => setReportsToPersonId(e.target.value)} disabled={!canSave}>
                  <option value="">(none)</option>
                  {sortedStaffPeople.map((p) => {
                    const pid = p.id || p._id
                    if (!pid || pid === id) return null
                    return (
                      <option key={pid} value={pid}>
                        {p.displayName}
                      </option>
                    )
                  })}
                </select>
              </label>
            )}

            {personType === 'external' && (
              <>
                <label>
                  Company
                  <select
                    value={companyId}
                    onChange={(e) => {
                      setCompanyId(e.target.value)
                      setCompanyLocationId('')
                    }}
                    disabled={!canSave}
                  >
                    <option value="">(none)</option>
                    {sortedCompanies.map((company) => {
                      const cid = company.id || company._id
                      if (!cid) return null
                      return (
                        <option key={cid} value={cid}>
                          {company.name}
                        </option>
                      )
                    })}
                  </select>
                </label>

                <label>
                  Company location
                  <select
                    value={companyLocationId}
                    onChange={(e) => setCompanyLocationId(e.target.value)}
                    disabled={!canSave || !companyId}
                  >
                    <option value="">(none)</option>
                    {sortedCompanyLocations.map((loc) => {
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

                <label>
                  External type
                  <select value={externalType} onChange={(e) => updateExternalType(e.target.value)} disabled={!canSave}>
                    <option value="">(none)</option>
                    {EXTERNAL_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <div className="muted">Optional tag for suppliers, subcontractors, clients, and partners.</div>
                </label>
              </>
            )}

            {personType === 'ironworker' && (
              <>
                <label>
                  Ironworker #
                  <input value={ironworkerNumber} onChange={(e) => setIronworkerNumber(e.target.value)} disabled={!canSave} />
                </label>

                <label>
                  Union local
                  <input value={unionLocal} onChange={(e) => setUnionLocal(e.target.value)} disabled={!canSave} />
                </label>
              </>
            )}

            {showAdvanced && (
              <>
                <label>
                  Skills <span className="muted">(comma/semicolon separated)</span>
                  <input value={skillsText} onChange={(e) => setSkillsText(e.target.value)} disabled={!canSave} />
                </label>

                <label>
                  Tags <span className="muted">(comma/semicolon separated)</span>
                  <input value={tagsText} onChange={(e) => setTagsText(e.target.value)} disabled={!canSave} />
                </label>

                <label>
                  Rating
                  <input
                    type="number"
                    value={ratingText}
                    onChange={(e) => setRatingText(e.target.value)}
                    disabled={!canSave}
                  />
                </label>
              </>
            )}

            <label className="md:col-span-2">
              Notes
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} disabled={!canSave} />
            </label>
          </div>

          {personType === 'ironworker' && showAdvanced && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2>Certifications</h2>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setCertifications((prev) => [...prev, { ...DEFAULT_CERT_ROW }])}
                  disabled={!canSave}
                >
                  Add certification
                </button>
              </div>

              <div className="space-y-3">
                {certifications.map((row, idx) => (
                  <div key={idx} className="rounded-2xl border border-border/60 bg-white/5 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="muted">Certification {idx + 1}</div>
                      <button
                        type="button"
                        className="btn secondary"
                        onClick={() => setCertifications((prev) => prev.filter((_, i) => i !== idx))}
                        disabled={!canSave || certifications.length <= 1}
                      >
                        Remove
                      </button>
                    </div>

                    <div className="form-grid md:grid-cols-2">
                      <label className="md:col-span-2">
                        Name
                        <input
                          value={row.name}
                          onChange={(e) => {
                            const value = e.target.value
                            setCertifications((prev) => prev.map((r, i) => (i === idx ? { ...r, name: value } : r)))
                          }}
                          disabled={!canSave}
                        />
                      </label>

                      <label>
                        Issued at
                        <input
                          type="date"
                          value={row.issuedAt}
                          onChange={(e) => {
                            const value = e.target.value
                            setCertifications((prev) => prev.map((r, i) => (i === idx ? { ...r, issuedAt: value } : r)))
                          }}
                          disabled={!canSave}
                        />
                      </label>

                      <label>
                        Expires at
                        <input
                          type="date"
                          value={row.expiresAt}
                          onChange={(e) => {
                            const value = e.target.value
                            setCertifications((prev) => prev.map((r, i) => (i === idx ? { ...r, expiresAt: value } : r)))
                          }}
                          disabled={!canSave}
                        />
                      </label>

                      <label className="md:col-span-2">
                        Document URL
                        <input
                          value={row.documentUrl}
                          onChange={(e) => {
                            const value = e.target.value
                            setCertifications((prev) => prev.map((r, i) => (i === idx ? { ...r, documentUrl: value } : r)))
                          }}
                          disabled={!canSave}
                        />
                      </label>

                      <label className="md:col-span-2">
                        Notes
                        <textarea
                          value={row.notes}
                          onChange={(e) => {
                            const value = e.target.value
                            setCertifications((prev) => prev.map((r, i) => (i === idx ? { ...r, notes: value } : r)))
                          }}
                          rows={3}
                          disabled={!canSave}
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" className="btn primary" disabled={!canSave}>
              {saving ? 'Saving.' : 'Save changes'}
            </button>
            <button
              type="button"
              className="btn secondary"
              onClick={() => router.push('/dashboard/settings/people')}
              disabled={saving}
            >
              Done
            </button>
          </div>
        </form>
      )}

      {canManage && person && (
        <div className="glass-card space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2>Dotted-line reporting</h2>
              <p className="subtitle">Optional `GraphEdge(reports_to)` relationships (in addition to the manager field).</p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeArchivedReports}
                onChange={(e) => setIncludeArchivedReports(e.target.checked)}
                disabled={reportsLoading}
              />
              Include archived
            </label>
          </div>

          {reportsLoading && <div className="feedback subtle">Loading dotted-line edges.</div>}
          {reportsMessage && <div className="feedback success">{reportsMessage}</div>}
          {reportsError && <div className={cn('feedback error')}>{reportsError}</div>}

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-semibold">This person reports to (dotted-line)</div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={reportsToAddManagerId}
                  onChange={(e) => setReportsToAddManagerId(e.target.value)}
                  disabled={!canEditReports}
                >
                  <option value="">Select a staff person</option>
                  {sortedStaffPeople.map((p) => {
                    const pid = p.id || p._id
                    if (!pid || pid === id) return null
                    return (
                      <option key={pid} value={pid}>
                        {p.displayName}
                      </option>
                    )
                  })}
                </select>
                <button type="button" className="btn secondary" onClick={() => void addReportsManager()} disabled={!canEditReports || !reportsToAddManagerId}>
                  Add
                </button>
              </div>
            </div>

            {reportsToEdges.length === 0 ? (
              <div className="muted">No dotted-line managers.</div>
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
                    {reportsToEdges.map((edge) => {
                      const edgeId = edge.id || edge._id || `${edge.fromNodeId}:${edge.toNodeId}`
                      const archived = !!edge.archivedAt
                      const href = `/dashboard/settings/people/persons/${edge.toNodeId}`
                      return (
                        <tr key={edgeId} className={cn(archived && 'opacity-70')}>
                          <td>
                            <Link href={href} className="font-semibold text-[color:var(--text)]">
                              {resolvePersonLabel(edge.toNodeId)}
                            </Link>
                          </td>
                          <td>{archived ? 'Archived' : 'Active'}</td>
                          <td className="text-right">
                            <button type="button" className="btn secondary" onClick={() => void toggleReportsEdge(edge)} disabled={!canEditReports}>
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
            <div className="font-semibold">People reporting to this person (dotted-line)</div>

            {reportsFromEdges.length === 0 ? (
              <div className="muted">No dotted-line reports.</div>
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
                    {reportsFromEdges.map((edge) => {
                      const edgeId = edge.id || edge._id || `${edge.fromNodeId}:${edge.toNodeId}`
                      const archived = !!edge.archivedAt
                      const href = `/dashboard/settings/people/persons/${edge.fromNodeId}`
                      return (
                        <tr key={edgeId} className={cn(archived && 'opacity-70')}>
                          <td>
                            <Link href={href} className="font-semibold text-[color:var(--text)]">
                              {resolvePersonLabel(edge.fromNodeId)}
                            </Link>
                          </td>
                          <td>{archived ? 'Archived' : 'Active'}</td>
                          <td className="text-right">
                            <button type="button" className="btn secondary" onClick={() => void toggleReportsEdge(edge)} disabled={!canEditReports}>
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

      {canManage && person && (
        <div className="glass-card space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2>Invite</h2>
              <p className="subtitle">Send an app invite from this People record (pending invites do not consume seats).</p>
            </div>
            <Link href="/dashboard/invites" className="btn secondary">
              View all invites
            </Link>
          </div>

          {!primaryEmailValue ? (
            <div className="feedback subtle">Add an email (and ensure it is primary) to enable invites.</div>
          ) : person.userId ? (
            <div className="feedback subtle">
              Linked user: <span className="font-semibold">{person.userId}</span>
            </div>
          ) : inviteForPerson?.status === 'pending' ? (
            <div className="feedback subtle">Invite pending (use the Invites page to resend).</div>
          ) : person.personType === 'external_person' ? (
            <div className="feedback subtle">External contacts cannot be invited into the app.</div>
          ) : person.personType === 'internal_union' && inviteRole === 'foreman' && !person.ironworkerNumber ? (
            <div className="feedback subtle">Foreman invites require an ironworker # on this Person.</div>
          ) : (
            <div className="form-grid md:grid-cols-3">
              <label className="md:col-span-2">
                Email
                <input value={primaryEmailValue} disabled />
              </label>

              <label>
                Role
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} disabled={!canInvite}>
                  {inviteRoleOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Expires (hours)
                <input
                  type="number"
                  min={1}
                  max={168}
                  value={inviteExpiresInHours}
                  onChange={(e) => setInviteExpiresInHours(Number(e.target.value))}
                  disabled={!canInvite}
                />
              </label>

              <div className="md:col-span-2 flex items-end gap-2">
                <button type="button" className="btn primary" onClick={onInvite} disabled={!canInvite}>
                  {inviting ? 'Sending.' : 'Send invite'}
                </button>
                {!canInvite && (
                  <div className="muted">
                    {isArchived
                      ? 'Restore to invite.'
                      : isLegalHold
                        ? 'Legal hold blocks invites.'
                        : inviting
                          ? 'Sending invite.'
                          : null}
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
