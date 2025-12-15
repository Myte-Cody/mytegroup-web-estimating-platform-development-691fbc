'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { FormEvent, useEffect, useMemo, useState } from 'react'

import { ApiError, apiFetch } from '../../../../../../lib/api'
import { hasAnyRole } from '../../../../../../lib/rbac'
import { cn } from '../../../../../../lib/utils'
import { joinList, normalizeOptionalString, splitList, toDateInputValue } from '../contact-utils'

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

type ContactCertification = {
  name: string
  issuedAt?: string | null
  expiresAt?: string | null
  documentUrl?: string | null
  notes?: string | null
}

type Contact = {
  _id?: string
  id?: string
  orgId?: string
  name: string
  personType?: 'staff' | 'ironworker' | 'external'
  contactKind?: 'individual' | 'business'
  firstName?: string | null
  lastName?: string | null
  displayName?: string | null
  dateOfBirth?: string | null
  ironworkerNumber?: string | null
  unionLocal?: string | null
  promotedToForeman?: boolean
  foremanUserId?: string | null
  officeId?: string | null
  reportsToContactId?: string | null
  skills?: string[]
  certifications?: ContactCertification[]
  rating?: number | null
  email?: string | null
  phone?: string | null
  company?: string | null
  tags?: string[]
  notes?: string | null
  invitedUserId?: string | null
  invitedAt?: string | null
  inviteStatus?: 'pending' | 'accepted' | null
  archivedAt?: string | null
  piiStripped?: boolean
  legalHold?: boolean
  createdAt?: string
  updatedAt?: string
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

const INVITE_ROLE_OPTIONS = [
  { value: 'org_owner', label: 'Org Owner (full suite)' },
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

const formatDateTime = (value?: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

export default function ContactDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const contactId = String((params as any)?.contactId || '')

  const [user, setUser] = useState<SessionUser | null>(null)
  const [contact, setContact] = useState<Contact | null>(null)
  const [offices, setOffices] = useState<Office[]>([])

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const canManage = useMemo(() => hasAnyRole(user, ['admin']), [user])

  const [personType, setPersonType] = useState<'staff' | 'ironworker' | 'external'>('external')
  const [contactKind, setContactKind] = useState<'individual' | 'business'>('individual')
  const [name, setName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [company, setCompany] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [ironworkerNumber, setIronworkerNumber] = useState('')
  const [unionLocal, setUnionLocal] = useState('')
  const [skillsText, setSkillsText] = useState('')
  const [tagsText, setTagsText] = useState('')
  const [ratingText, setRatingText] = useState('')
  const [notes, setNotes] = useState('')
  const [officeId, setOfficeId] = useState('')
  const [reportsToContactId, setReportsToContactId] = useState('')
  const [promotedToForeman, setPromotedToForeman] = useState(false)
  const [foremanUserId, setForemanUserId] = useState('')
  const [certifications, setCertifications] = useState<CertificationFormRow[]>([{ ...DEFAULT_CERT_ROW }])

  const [inviteRole, setInviteRole] = useState('viewer')
  const [inviteExpiresInHours, setInviteExpiresInHours] = useState(72)
  const [inviting, setInviting] = useState(false)

  const refresh = async () => {
    if (!contactId) return
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const me = await apiFetch<{ user?: SessionUser }>('/auth/me')
      const currentUser = me?.user || null
      setUser(currentUser)
      if (!currentUser?.id) {
        setError('You need to sign in to view contacts.')
        return
      }
      if (!hasAnyRole(currentUser, ['admin'])) {
        setError('Org admin access required to manage contacts.')
        return
      }

      const results = await Promise.allSettled([
        apiFetch<Contact>(`/contacts/${contactId}?includeArchived=1`),
        apiFetch<Office[]>('/offices?includeArchived=1'),
      ])

      const contactRes = results[0]
      const officesRes = results[1]

      if (officesRes.status === 'fulfilled') {
        setOffices(Array.isArray(officesRes.value) ? officesRes.value : [])
      }

      if (contactRes.status === 'fulfilled') {
        const c = contactRes.value
        setContact(c)

        setPersonType((c.personType as any) || 'external')
        setContactKind((c.contactKind as any) || 'individual')
        setName(c.name || '')
        setFirstName(c.firstName || '')
        setLastName(c.lastName || '')
        setDisplayName(c.displayName || '')
        setEmail(c.email || '')
        setPhone(c.phone || '')
        setCompany(c.company || '')
        setDateOfBirth(toDateInputValue(c.dateOfBirth))
        setIronworkerNumber(c.ironworkerNumber || '')
        setUnionLocal(c.unionLocal || '')
        setSkillsText(joinList(c.skills))
        setTagsText(joinList(c.tags))
        setRatingText(typeof c.rating === 'number' ? String(c.rating) : '')
        setNotes(c.notes || '')
        setOfficeId(c.officeId || '')
        setReportsToContactId(c.reportsToContactId || '')
        setPromotedToForeman(!!c.promotedToForeman)
        setForemanUserId(c.foremanUserId || '')

        const certRows = (c.certifications || []).map((cert) => ({
          name: cert.name || '',
          issuedAt: toDateInputValue(cert.issuedAt || null),
          expiresAt: toDateInputValue(cert.expiresAt || null),
          documentUrl: cert.documentUrl || '',
          notes: cert.notes || '',
        }))
        setCertifications(certRows.length ? certRows : [{ ...DEFAULT_CERT_ROW }])
      } else {
        const err = contactRes.reason
        setError(err instanceof ApiError ? err.message : 'Unable to load contact.')
      }
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Unable to load contact.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId])

  const sortedOffices = useMemo(() => {
    return [...offices].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  }, [offices])

  const officeName = useMemo(() => {
    if (!contact?.officeId) return 'Unassigned'
    const match = offices.find((o) => (o.id || o._id) === contact.officeId)
    return match?.name || contact.officeId
  }, [contact?.officeId, offices])

  const isArchived = !!contact?.archivedAt
  const isLegalHold = !!contact?.legalHold

  const canSave = useMemo(() => {
    if (!canManage) return false
    if (saving) return false
    if (!contact) return false
    if (isArchived) return false
    if (isLegalHold) return false
    return name.trim() !== ''
  }, [canManage, saving, contact, isArchived, isLegalHold, name])

  const buildPayload = () => {
    const normalizedRating = ratingText.trim() === '' ? null : Number(ratingText)
    const certs = certifications.map((row) => ({
      name: row.name.trim(),
      issuedAt: row.issuedAt.trim() ? row.issuedAt.trim() : null,
      expiresAt: row.expiresAt.trim() ? row.expiresAt.trim() : null,
      documentUrl: normalizeOptionalString(row.documentUrl),
      notes: normalizeOptionalString(row.notes),
    }))

    return {
      personType,
      contactKind,
      name: name.trim(),
      firstName: normalizeOptionalString(firstName),
      lastName: normalizeOptionalString(lastName),
      displayName: normalizeOptionalString(displayName),
      email: normalizeOptionalString(email)?.toLowerCase() || null,
      phone: normalizeOptionalString(phone),
      company: normalizeOptionalString(company),
      dateOfBirth: dateOfBirth.trim() ? dateOfBirth.trim() : null,
      ironworkerNumber: normalizeOptionalString(ironworkerNumber),
      unionLocal: normalizeOptionalString(unionLocal),
      officeId: normalizeOptionalString(officeId),
      reportsToContactId: normalizeOptionalString(reportsToContactId),
      skills: splitList(skillsText),
      tags: splitList(tagsText),
      rating: Number.isFinite(normalizedRating as any) ? normalizedRating : null,
      notes: normalizeOptionalString(notes),
      certifications: certs.filter((row) => row.name),
      ...(personType === 'ironworker'
        ? { promotedToForeman, foremanUserId: normalizeOptionalString(foremanUserId) }
        : {}),
    }
  }

  const onSave = async (event: FormEvent) => {
    event.preventDefault()
    if (!canSave) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const payload = buildPayload()
      await apiFetch(`/contacts/${contactId}`, { method: 'PATCH', body: JSON.stringify(payload) })
      setSuccess('Contact updated.')
      await refresh()
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Failed to save contact.')
    } finally {
      setSaving(false)
    }
  }

  const onArchiveToggle = async () => {
    if (!contact) return
    setError(null)
    setSuccess(null)
    try {
      const endpoint = isArchived ? 'unarchive' : 'archive'
      await apiFetch(`/contacts/${contactId}/${endpoint}`, { method: 'POST' })
      setSuccess(isArchived ? 'Contact restored.' : 'Contact archived.')
      await refresh()
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Failed to update archive status.')
    }
  }

  const canInvite = useMemo(() => {
    if (!canManage) return false
    if (!contact) return false
    if (!contact.email) return false
    if (isArchived) return false
    if (isLegalHold) return false
    if (contact.inviteStatus === 'pending') return false
    if (contact.invitedUserId) return false
    return !inviting
  }, [canManage, contact, isArchived, isLegalHold, inviting])

  const onInvite = async () => {
    if (!contact?.email) return
    if (!canInvite) return
    setInviting(true)
    setError(null)
    setSuccess(null)
    try {
      await apiFetch('/invites', {
        method: 'POST',
        body: JSON.stringify({
          email: contact.email,
          role: inviteRole,
          expiresInHours: Number(inviteExpiresInHours) || undefined,
          contactId,
        }),
      })
      setSuccess(`Invite sent to ${contact.email}.`)
      await refresh()
    } catch (err: any) {
      setError(err?.message || 'Failed to send invite.')
    } finally {
      setInviting(false)
    }
  }

  return (
    <section className="space-y-6">
      <div className="glass-card space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="badge">Org Settings</div>
            <h1>Contact</h1>
            <p className="subtitle">
              {contact ? (
                <>
                  {contact.name} {'·'} {contact.personType || 'external'} {'·'} Office: {officeName}
                </>
              ) : (
                'Loading contact details.'
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link href="/dashboard/settings/people" className="btn secondary">
              Back to People
            </Link>
            {contact && (
              <button
                type="button"
                className="btn secondary"
                onClick={() => void refresh()}
                disabled={loading || saving || inviting}
              >
                Refresh
              </button>
            )}
            {contact && (
              <button
                type="button"
                className="btn secondary"
                onClick={onArchiveToggle}
                disabled={!canManage || loading || saving || inviting || isLegalHold}
              >
                {isArchived ? 'Restore' : 'Archive'}
              </button>
            )}
          </div>
        </div>

        {loading && <div className="feedback subtle">Loading.</div>}
        {error && <div className={cn('feedback error')}>{error}</div>}
        {success && <div className={cn('feedback success')}>{success}</div>}

        {contact && (
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
              <div className="muted">Invite</div>
              <div className="stat-value">{contact.inviteStatus || '—'}</div>
            </div>
            <div className="info-block">
              <div className="muted">Invited at</div>
              <div className="stat-value">{formatDateTime(contact.invitedAt)}</div>
            </div>
          </div>
        )}

        {contact?.piiStripped && (
          <div className="feedback subtle">This contact has PII stripped. Some fields may be redacted downstream.</div>
        )}
        {isLegalHold && <div className="feedback subtle">This contact is under legal hold. Edits are blocked.</div>}
        {isArchived && <div className="feedback subtle">Restore this contact to make edits.</div>}
      </div>

      {canManage && (
        <form onSubmit={onSave} className="glass-card space-y-5">
          <div className="form-grid md:grid-cols-2">
            <label>
              Person type
              <select value={personType} onChange={(e) => setPersonType(e.target.value as any)} disabled={!canSave}>
                <option value="staff">Staff (directory/contact)</option>
                <option value="ironworker">Ironworker</option>
                <option value="external">External (supplier/subcontractor/client)</option>
              </select>
            </label>

            <label>
              Contact kind
              <select value={contactKind} onChange={(e) => setContactKind(e.target.value as any)} disabled={!canSave}>
                <option value="individual">Individual</option>
                <option value="business">Business</option>
              </select>
            </label>

            <label className="md:col-span-2">
              Name <span className="muted">(required)</span>
              <input value={name} onChange={(e) => setName(e.target.value)} disabled={!canSave} />
            </label>

            <label>
              First name
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={!canSave} />
            </label>

            <label>
              Last name
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={!canSave} />
            </label>

            <label className="md:col-span-2">
              Display name
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} disabled={!canSave} />
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
              Company
              <input value={company} onChange={(e) => setCompany(e.target.value)} disabled={!canSave} />
            </label>

            <label>
              Office (internal)
              <select value={officeId} onChange={(e) => setOfficeId(e.target.value)} disabled={!canSave}>
                <option value="">Unassigned</option>
                {sortedOffices.map((office) => {
                  const id = office.id || office._id
                  if (!id) return null
                  return (
                    <option key={id} value={id} disabled={!!office.archivedAt}>
                      {office.name}
                      {office.archivedAt ? ' (archived)' : ''}
                    </option>
                  )
                })}
              </select>
            </label>

            <label>
              Reports to (contact id)
              <input value={reportsToContactId} onChange={(e) => setReportsToContactId(e.target.value)} disabled={!canSave} />
            </label>

            <label>
              Date of birth
              <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} disabled={!canSave} />
            </label>

            <label>
              Rating
              <input type="number" value={ratingText} onChange={(e) => setRatingText(e.target.value)} disabled={!canSave} />
            </label>

            <label className="md:col-span-2">
              Skills <span className="muted">(comma/semicolon separated)</span>
              <input value={skillsText} onChange={(e) => setSkillsText(e.target.value)} disabled={!canSave} />
            </label>

            <label className="md:col-span-2">
              Tags <span className="muted">(comma/semicolon separated)</span>
              <input value={tagsText} onChange={(e) => setTagsText(e.target.value)} disabled={!canSave} />
            </label>

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

                <label className="md:col-span-2">
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={promotedToForeman}
                      onChange={(e) => setPromotedToForeman(e.target.checked)}
                      disabled={!canSave}
                    />
                    Promoted to Foreman <span className="muted">(advanced)</span>
                  </span>
                </label>

                <label className="md:col-span-2">
                  Foreman user id <span className="muted">(advanced)</span>
                  <input value={foremanUserId} onChange={(e) => setForemanUserId(e.target.value)} disabled={!canSave} />
                </label>
              </>
            )}

            <label className="md:col-span-2">
              Notes
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} disabled={!canSave} />
            </label>
          </div>

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

      {canManage && contact && (
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

          {!contact.email ? (
            <div className="feedback subtle">Add an email to enable invites.</div>
          ) : contact.invitedUserId ? (
            <div className="feedback subtle">
              Linked user: <span className="font-semibold">{contact.invitedUserId}</span>
            </div>
          ) : contact.inviteStatus === 'pending' ? (
            <div className="feedback subtle">Invite pending (use the Invites page to resend).</div>
          ) : (
            <div className="form-grid md:grid-cols-3">
              <label className="md:col-span-2">
                Email
                <input value={contact.email} disabled />
              </label>

              <label>
                Role
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} disabled={!canInvite}>
                  {INVITE_ROLE_OPTIONS.map((opt) => (
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
