'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useEffect, useMemo, useState } from 'react'

import { ApiError, apiFetch } from '../../../../../../lib/api'
import { hasAnyRole } from '../../../../../../lib/rbac'
import { cn } from '../../../../../../lib/utils'
import { joinList, normalizeOptionalString, splitList } from '../contact-utils'

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

export default function NewContactPage() {
  const router = useRouter()

  const [user, setUser] = useState<SessionUser | null>(null)
  const [offices, setOffices] = useState<Office[]>([])

  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
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

  useEffect(() => {
    const qs = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search)
    const initialType = (qs?.get('personType') || '').trim().toLowerCase()
    if (initialType === 'staff' || initialType === 'ironworker' || initialType === 'external') {
      setPersonType(initialType)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
          setError('You need to sign in to create contacts.')
          return
        }
        if (!hasAnyRole(currentUser, ['admin'])) {
          setError('Org admin access required to create contacts.')
          return
        }
        const officeRes = await apiFetch<Office[]>('/offices')
        setOffices(Array.isArray(officeRes) ? officeRes : [])
      } catch (err: any) {
        setError(err instanceof ApiError ? err.message : 'Unable to load workspace context.')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  const sortedOffices = useMemo(() => {
    return [...offices].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  }, [offices])

  const buildPayload = () => {
    const normalizedEmail = normalizeOptionalString(email)?.toLowerCase() || null
    const normalizedPhone = normalizeOptionalString(phone)
    const normalizedCompany = normalizeOptionalString(company)
    const normalizedRating = ratingText.trim() === '' ? null : Number(ratingText)

    const payload: Record<string, any> = {
      personType,
      contactKind,
      name: name.trim(),
      firstName: normalizeOptionalString(firstName),
      lastName: normalizeOptionalString(lastName),
      displayName: normalizeOptionalString(displayName),
      email: normalizedEmail,
      phone: normalizedPhone,
      company: normalizedCompany,
      dateOfBirth: dateOfBirth.trim() ? dateOfBirth.trim() : null,
      ironworkerNumber: normalizeOptionalString(ironworkerNumber),
      unionLocal: normalizeOptionalString(unionLocal),
      skills: splitList(skillsText),
      tags: splitList(tagsText),
      rating: Number.isFinite(normalizedRating as any) ? normalizedRating : null,
      notes: normalizeOptionalString(notes),
      officeId: normalizeOptionalString(officeId),
      reportsToContactId: normalizeOptionalString(reportsToContactId),
    }

    if (personType === 'ironworker') {
      payload.promotedToForeman = promotedToForeman
      payload.foremanUserId = normalizeOptionalString(foremanUserId)
    }

    const certs = certifications
      .map((row) => ({
        name: row.name.trim(),
        issuedAt: row.issuedAt.trim() ? row.issuedAt.trim() : undefined,
        expiresAt: row.expiresAt.trim() ? row.expiresAt.trim() : undefined,
        documentUrl: normalizeOptionalString(row.documentUrl) || undefined,
        notes: normalizeOptionalString(row.notes) || undefined,
      }))
      .filter((row) => row.name)

    if (certs.length) payload.certifications = certs

    return payload
  }

  const canSubmit = useMemo(() => {
    return canManage && name.trim() !== '' && !submitting
  }, [canManage, name, submitting])

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      const payload = buildPayload()
      const created = await apiFetch<any>('/contacts', { method: 'POST', body: JSON.stringify(payload) })
      const contactId = created?.id || created?._id
      const details = [
        personType,
        normalizeOptionalString(email) ? `email=${email.trim().toLowerCase()}` : null,
        normalizeOptionalString(ironworkerNumber) ? `ironworker#=${ironworkerNumber.trim()}` : null,
      ].filter(Boolean)
      setSuccess(`Contact created (${details.join(', ')}).`)
      if (contactId) {
        router.push(`/dashboard/settings/people/contacts/${contactId}`)
      }
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Failed to create contact.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="space-y-6">
      <div className="glass-card space-y-3">
        <div className="badge">Org Settings</div>
        <div className="space-y-1">
          <h1>New contact</h1>
          <p className="subtitle">Add a person to your org People directory (staff, ironworker, or external).</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/dashboard/settings/people" className="btn secondary">
            Back to People
          </Link>
          {personType !== 'staff' && (
            <div className="muted">
              Skills: {joinList(splitList(skillsText)) ? joinList(splitList(skillsText)) : '—'} {'·'} Tags:{' '}
              {joinList(splitList(tagsText)) ? joinList(splitList(tagsText)) : '—'}
            </div>
          )}
        </div>

        {loading && <div className="feedback subtle">Loading.</div>}
        {error && <div className={cn('feedback error')}>{error}</div>}
        {success && <div className={cn('feedback success')}>{success}</div>}
      </div>

      {canManage && (
        <form onSubmit={onSubmit} className="glass-card space-y-5">
          <div className="form-grid md:grid-cols-2">
            <label>
              Person type
              <select value={personType} onChange={(e) => setPersonType(e.target.value as any)}>
                <option value="staff">Staff (directory/contact)</option>
                <option value="ironworker">Ironworker</option>
                <option value="external">External (supplier/subcontractor/client)</option>
              </select>
            </label>

            <label>
              Contact kind
              <select value={contactKind} onChange={(e) => setContactKind(e.target.value as any)}>
                <option value="individual">Individual</option>
                <option value="business">Business</option>
              </select>
            </label>

            <label className="md:col-span-2">
              Name <span className="muted">(required)</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe / ACME Steel" />
            </label>

            <label>
              First name
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </label>

            <label>
              Last name
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </label>

            <label className="md:col-span-2">
              Display name
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Optional label" />
            </label>

            <label>
              Email
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />
            </label>

            <label>
              Phone
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 555 5555" />
            </label>

            <label className="md:col-span-2">
              Company
              <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Vendor / subcontractor" />
            </label>

            <label>
              Office (internal)
              <select value={officeId} onChange={(e) => setOfficeId(e.target.value)}>
                <option value="">Unassigned</option>
                {sortedOffices
                  .filter((office) => !office.archivedAt)
                  .map((office) => {
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

            <label>
              Reports to (contact id)
              <input
                value={reportsToContactId}
                onChange={(e) => setReportsToContactId(e.target.value)}
                placeholder="Optional"
              />
            </label>

            <label>
              Date of birth
              <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
            </label>

            <label>
              Rating
              <input
                type="number"
                value={ratingText}
                onChange={(e) => setRatingText(e.target.value)}
                placeholder="Optional (e.g. 1-5)"
              />
            </label>

            <label className="md:col-span-2">
              Skills <span className="muted">(comma/semicolon separated)</span>
              <input value={skillsText} onChange={(e) => setSkillsText(e.target.value)} placeholder="Welding, Rigging" />
            </label>

            <label className="md:col-span-2">
              Tags <span className="muted">(comma/semicolon separated)</span>
              <input value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="supplier, ppe, bolts" />
            </label>

            {personType === 'ironworker' && (
              <>
                <label>
                  Ironworker #
                  <input value={ironworkerNumber} onChange={(e) => setIronworkerNumber(e.target.value)} />
                </label>

                <label>
                  Union local
                  <input value={unionLocal} onChange={(e) => setUnionLocal(e.target.value)} />
                </label>

                <label className="md:col-span-2">
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={promotedToForeman}
                      onChange={(e) => setPromotedToForeman(e.target.checked)}
                    />
                    Promoted to Foreman <span className="muted">(advanced)</span>
                  </span>
                </label>

                <label className="md:col-span-2">
                  Foreman user id <span className="muted">(advanced)</span>
                  <input value={foremanUserId} onChange={(e) => setForemanUserId(e.target.value)} placeholder="Optional" />
                </label>
              </>
            )}

            <label className="md:col-span-2">
              Notes
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Optional notes" />
            </label>
          </div>

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
                        placeholder="e.g. OSHA 10, AWS D1.1"
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
                        placeholder="Optional link"
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
                        placeholder="Optional notes"
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" className="btn primary" disabled={!canSubmit}>
              {submitting ? 'Creating.' : 'Create contact'}
            </button>
            <Link href="/dashboard/settings/people" className="btn secondary">
              Cancel
            </Link>
          </div>
        </form>
      )}
    </section>
  )
}
