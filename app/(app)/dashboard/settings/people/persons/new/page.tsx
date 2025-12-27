'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useEffect, useMemo, useState } from 'react'

import { ApiError, apiFetch } from '../../../../../../lib/api'
import { hasAnyRole } from '../../../../../../lib/rbac'
import { cn } from '../../../../../../lib/utils'
import { joinList, normalizeOptionalString, splitList } from '../person-utils'

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

const EXTERNAL_TYPE_OPTIONS = [
  { value: 'supplier', label: 'Supplier' },
  { value: 'subcontractor', label: 'Subcontractor' },
  { value: 'client', label: 'Client' },
  { value: 'partner', label: 'Partner' },
  { value: 'misc', label: 'Misc' },
]

const EXTERNAL_TYPE_VALUES = EXTERNAL_TYPE_OPTIONS.map((opt) => opt.value)

type UiPersonType = 'staff' | 'ironworker' | 'external'

const toBackendPersonType = (value: UiPersonType) => {
  if (value === 'staff') return 'internal_staff'
  if (value === 'ironworker') return 'internal_union'
  return 'external_person'
}

export default function NewPersonPage() {
  const router = useRouter()

  const [user, setUser] = useState<SessionUser | null>(null)
  const [orgLocations, setOrgLocations] = useState<Office[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [companyLocations, setCompanyLocations] = useState<CompanyLocation[]>([])
  const [staffPeople, setStaffPeople] = useState<PersonSummary[]>([])

  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
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

  const [tagsText, setTagsText] = useState('')
  const [skillsText, setSkillsText] = useState('')
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

  useEffect(() => {
    const qs = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search)
    const initialType = (qs?.get('personType') || '').trim().toLowerCase()
    if (initialType === 'staff' || initialType === 'ironworker' || initialType === 'external') {
      setPersonType(initialType)
    }

    const initialCompanyId = (qs?.get('companyId') || '').trim()
    if (initialCompanyId) setCompanyId(initialCompanyId)

    const initialCompanyLocationId = (qs?.get('companyLocationId') || '').trim()
    if (initialCompanyLocationId) setCompanyLocationId(initialCompanyLocationId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const emails = useMemo(() => splitList(emailsText).map((e) => e.toLowerCase()), [emailsText])
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
    const load = async () => {
      setLoading(true)
      setError(null)
      setSuccess(null)
      try {
        const me = await apiFetch<{ user?: SessionUser }>('/auth/me')
        const currentUser = me?.user || null
        setUser(currentUser)
        if (!currentUser?.id) {
          setError('You need to sign in to create people records.')
          return
        }
        if (!hasAnyRole(currentUser, ['admin'])) {
          setError('Org admin access required to create people records.')
          return
        }

        const results = await Promise.allSettled([
          apiFetch<Office[]>('/org-locations'),
          apiFetch<Company[]>('/companies'),
          apiFetch<PersonSummary[]>('/persons?personType=internal_staff'),
        ])

        const officesRes = results[0]
        const companiesRes = results[1]
        const staffRes = results[2]

        if (officesRes.status === 'fulfilled') {
          setOrgLocations(Array.isArray(officesRes.value) ? officesRes.value : [])
        }
        if (companiesRes.status === 'fulfilled') {
          setCompanies(Array.isArray(companiesRes.value) ? companiesRes.value : [])
        }
        if (staffRes.status === 'fulfilled') {
          setStaffPeople(Array.isArray(staffRes.value) ? staffRes.value : [])
        }
      } catch (err: any) {
        setError(err instanceof ApiError ? err.message : 'Unable to load workspace context.')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

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

  const sortedOrgLocations = useMemo(() => {
    return [...orgLocations].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  }, [orgLocations])

  const sortedCompanies = useMemo(() => {
    return [...companies].filter((c) => !c.archivedAt).sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  }, [companies])

  const sortedCompanyLocations = useMemo(() => {
    return [...companyLocations].filter((l) => !l.archivedAt).sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  }, [companyLocations])

  const sortedStaffPeople = useMemo(() => {
    return [...staffPeople].filter((p) => !p.archivedAt).sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''))
  }, [staffPeople])

  const canSubmit = useMemo(() => {
    if (!canManage) return false
    if (submitting) return false
    return displayName.trim() !== ''
  }, [canManage, displayName, submitting])

  const buildPayload = () => {
    const normalizedRating = ratingText.trim() === '' ? undefined : Number(ratingText)
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
      tagKeys: splitList(tagsText),
      skillKeys: splitList(skillsText),
      rating: Number.isFinite(normalizedRating as any) ? normalizedRating : undefined,
      notes: normalizeOptionalString(notes) || undefined,
      orgLocationId: normalizeOptionalString(orgLocationId) || undefined,
      reportsToPersonId: normalizeOptionalString(reportsToPersonId) || undefined,
      companyId: normalizeOptionalString(companyId) || undefined,
      companyLocationId: normalizeOptionalString(companyLocationId) || undefined,
      ironworkerNumber: normalizeOptionalString(ironworkerNumber) || undefined,
      unionLocal: normalizeOptionalString(unionLocal) || undefined,
    }

    if (certs.length) payload.certifications = certs
    return payload
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      const payload = buildPayload()
      const created = await apiFetch<any>('/persons', { method: 'POST', body: JSON.stringify(payload) })
      const personId = created?.id || created?._id
      setSuccess('Person created.')
      if (personId) {
        router.push(`/dashboard/settings/people/persons/${personId}`)
      }
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Failed to create person.')
    } finally {
      setSubmitting(false)
    }
  }

  const personTypeLabel =
    personType === 'staff' ? 'Staff' : personType === 'ironworker' ? 'Ironworker' : 'External'

  return (
    <section className="space-y-6">
      <div className="glass-card space-y-3">
        <div className="badge">Org Settings</div>
        <div className="space-y-1">
          <h1>New person</h1>
          <p className="subtitle">Create a People record for {personTypeLabel.toLowerCase()} (used for invites, workflows, and reporting).</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/dashboard/settings/people" className="btn secondary">
            Back to People
          </Link>
        </div>

        {loading && <div className="feedback subtle">Loading.</div>}
        {error && <div className={cn('feedback error')}>{error}</div>}
        {success && <div className={cn('feedback success')}>{success}</div>}
      </div>

      {canManage && (
        <form onSubmit={onSubmit} className="glass-card space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="muted">Essentials first. Advanced fields are optional.</div>
            <button
              type="button"
              className="btn secondary"
              onClick={() => setShowAdvanced((prev) => !prev)}
            >
              {showAdvanced ? 'Hide advanced' : 'Show advanced'}
            </button>
          </div>

          <div className="form-grid md:grid-cols-2">
            <label>
              Person type
              <select value={personType} onChange={(e) => setPersonType(e.target.value as UiPersonType)}>
                <option value="staff">Staff (internal)</option>
                <option value="ironworker">Ironworker (internal union)</option>
                <option value="external">External (supplier/subcontractor/client)</option>
              </select>
            </label>

            <label>
              Display name <span className="text-red-400">*</span>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
            </label>

            {showAdvanced && (
              <>
                <label>
                  First name
                  <input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </label>

                <label>
                  Last name
                  <input value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </label>
              </>
            )}

            {(personType === 'staff' || personType === 'ironworker') && showAdvanced && (
              <>
                <label>
                  Title
                  <input value={title} onChange={(e) => setTitle(e.target.value)} />
                </label>

                <label>
                  Department
                  <input value={departmentKey} onChange={(e) => setDepartmentKey(e.target.value)} placeholder="e.g. fabrication" />
                </label>
              </>
            )}

            {personType === 'ironworker' && (
              <>
                {showAdvanced && (
                  <label>
                    Date of birth
                    <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
                  </label>
                )}

                <label>
                  Ironworker #
                  <input value={ironworkerNumber} onChange={(e) => setIronworkerNumber(e.target.value)} />
                </label>

                <label>
                  Union local
                  <input value={unionLocal} onChange={(e) => setUnionLocal(e.target.value)} />
                </label>
              </>
            )}

            <label className="md:col-span-2">
              Emails (comma / newline separated)
              <textarea value={emailsText} onChange={(e) => setEmailsText(e.target.value)} rows={2} />
            </label>

            <label>
              Primary email
              <select
                value={primaryEmail}
                onChange={(e) => setPrimaryEmail(e.target.value)}
                disabled={!emails.length}
              >
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
              <textarea value={phonesText} onChange={(e) => setPhonesText(e.target.value)} rows={2} />
              <div className="muted">Use E.164 (+15551234567) or 10-digit numbers.</div>
            </label>

            <label>
              Primary phone
              <select
                value={primaryPhone}
                onChange={(e) => setPrimaryPhone(e.target.value)}
                disabled={!phones.length}
              >
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
                <select value={orgLocationId} onChange={(e) => setOrgLocationId(e.target.value)}>
                  <option value="">Unassigned</option>
                  {sortedOrgLocations.map((office) => {
                    const id = office.id || office._id
                    if (!id) return null
                    return (
                      <option key={id} value={id}>
                        {office.name}
                      </option>
                    )
                  })}
                </select>
              </label>
            )}

            {personType === 'staff' && (
              <label>
                Reports to
                <select value={reportsToPersonId} onChange={(e) => setReportsToPersonId(e.target.value)}>
                  <option value="">(none)</option>
                  {sortedStaffPeople.map((person) => {
                    const id = person.id || person._id
                    if (!id) return null
                    return (
                      <option key={id} value={id}>
                        {person.displayName}
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
                  >
                    <option value="">(none)</option>
                    {sortedCompanies.map((company) => {
                      const id = company.id || company._id
                      if (!id) return null
                      return (
                        <option key={id} value={id}>
                          {company.name}
                        </option>
                      )
                    })}
                  </select>
                  <div className="muted">
                    Manage companies in <Link href="/dashboard/settings/companies">Settings → Companies</Link>.
                  </div>
                </label>

                <label>
                  Company location
                  <select value={companyLocationId} onChange={(e) => setCompanyLocationId(e.target.value)} disabled={!companyId}>
                    <option value="">(none)</option>
                    {sortedCompanyLocations.map((loc) => {
                      const id = loc.id || loc._id
                      if (!id) return null
                      return (
                        <option key={id} value={id}>
                          {loc.name}
                        </option>
                      )
                    })}
                  </select>
                </label>

                <label>
                  External type
                  <select value={externalType} onChange={(e) => updateExternalType(e.target.value)}>
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

            {showAdvanced && (
              <>
                <label>
                  Skills (comma-separated)
                  <input value={skillsText} onChange={(e) => setSkillsText(e.target.value)} placeholder="e.g. welding, forklift" />
                </label>

                <label>
                  Tags (comma-separated)
                  <input value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="e.g. erector, galvanizing" />
                </label>

                <label>
                  Rating (0-5)
                  <input type="number" min={0} max={5} step={1} value={ratingText} onChange={(e) => setRatingText(e.target.value)} />
                </label>
              </>
            )}

            <label className="md:col-span-2">
              Notes
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
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
                        disabled={certifications.length <= 1}
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
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" className="btn primary" disabled={!canSubmit}>
              {submitting ? 'Creating.' : 'Create person'}
            </button>
            <button type="button" className="btn secondary" onClick={() => router.push('/dashboard/settings/people')} disabled={submitting}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
