'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import { ApiError, apiFetch } from '../../../../../lib/api'
import { hasAnyRole } from '../../../../../lib/rbac'
import { cn } from '../../../../../lib/utils'

type SessionUser = {
  id?: string
  role?: string
  roles?: string[]
  orgId?: string
}

type ImportStep = 'upload' | 'map' | 'preview' | 'done'

type ImportFieldKey =
  | 'personType'
  | 'name'
  | 'email'
  | 'phone'
  | 'company'
  | 'ironworkerNumber'
  | 'unionLocal'
  | 'dateOfBirth'
  | 'skills'
  | 'notes'
  | 'inviteRole'

type FieldDef = { key: ImportFieldKey; label: string; required?: boolean; hint?: string }

const FIELD_DEFS: FieldDef[] = [
  { key: 'personType', label: 'Person Type', hint: 'staff | ironworker | external' },
  { key: 'name', label: 'Name', required: true },
  { key: 'email', label: 'Email', hint: 'Required for invites' },
  { key: 'phone', label: 'Phone' },
  { key: 'company', label: 'Company' },
  { key: 'ironworkerNumber', label: 'Ironworker #' },
  { key: 'unionLocal', label: 'Union Local' },
  { key: 'dateOfBirth', label: 'Date of Birth', hint: 'YYYY-MM-DD' },
  { key: 'skills', label: 'Skills', hint: 'Comma/semicolon separated' },
  { key: 'notes', label: 'Notes' },
  { key: 'inviteRole', label: 'Invite Role', hint: 'admin | pm | superintendent | foreman | viewer | ...' },
]

type RawRow = Record<string, any>

type ImportRow = {
  row: number
  personType?: 'staff' | 'ironworker' | 'external'
  name: string
  email?: string
  phone?: string
  company?: string
  ironworkerNumber?: string
  unionLocal?: string
  dateOfBirth?: string
  skills?: string[]
  notes?: string
  inviteRole?: string
}

type PreviewRow = {
  row: number
  suggestedAction: 'create' | 'update' | 'error'
  contactId?: string
  matchBy?: 'email' | 'ironworkerNumber'
  errors?: string[]
  warnings?: string[]
}

type PreviewResponse = {
  orgId: string
  summary: { total: number; creates: number; updates: number; errors: number }
  rows: PreviewRow[]
}

type ConfirmRow = ImportRow & {
  action: 'create' | 'update' | 'skip'
  contactId?: string
}

type ConfirmResponse = {
  orgId: string
  processed: number
  created: number
  updated: number
  skipped: number
  invitesCreated: number
  errors: number
  results: Array<{ row: number; status: 'ok' | 'skipped' | 'error'; message?: string }>
}

const normalizeHeaderKey = (value: string) => {
  return (value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

const suggestMapping = (headers: string[]) => {
  const normalized = headers.map((h) => ({ raw: h, key: normalizeHeaderKey(h) }))
  const pick = (candidates: string[]) => {
    const set = new Set(candidates.map(normalizeHeaderKey))
    const exact = normalized.find((h) => set.has(h.key))
    if (exact) return exact.raw
    return normalized.find((h) => candidates.some((c) => h.key.includes(normalizeHeaderKey(c))))?.raw
  }

  const mapping: Partial<Record<ImportFieldKey, string>> = {
    personType: pick(['personType', 'type', 'person_type']),
    name: pick(['name', 'fullName', 'fullname', 'employeeName', 'contactName']),
    email: pick(['email', 'emailAddress', 'email_address']),
    phone: pick(['phone', 'mobile', 'cell', 'phoneNumber', 'phone_number']),
    company: pick(['company', 'companyName', 'company_name', 'vendor', 'supplier']),
    ironworkerNumber: pick(['ironworkerNumber', 'ironworker', 'unionNumber', 'memberNumber', 'localNumber']),
    unionLocal: pick(['unionLocal', 'local', 'union']),
    dateOfBirth: pick(['dateOfBirth', 'dob', 'birthdate', 'birthDate']),
    skills: pick(['skills', 'tags']),
    notes: pick(['notes', 'note']),
    inviteRole: pick(['inviteRole', 'role', 'access', 'accessRole']),
  }

  return mapping
}

const parseCsvText = (content: string) => {
  const rows: string[][] = []
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0)
  for (const line of lines) {
    const values: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"' && line[i + 1] === '"' && inQuotes) {
        current += '"'
        i++
        continue
      }
      if (char === '"') {
        inQuotes = !inQuotes
        continue
      }
      if (char === ',' && !inQuotes) {
        values.push(current)
        current = ''
        continue
      }
      current += char
    }
    values.push(current)
    rows.push(values.map((v) => v.trim()))
  }
  if (!rows.length) return { headers: [], data: [] as RawRow[] }
  const headers = rows[0]
  const data = rows.slice(1).map((cells) => {
    const row: RawRow = {}
    headers.forEach((header, idx) => {
      row[header] = cells[idx] ?? ''
    })
    return row
  })
  return { headers, data }
}

const normalizePersonType = (raw: string) => {
  const value = (raw || '').trim().toLowerCase()
  if (!value) return 'external'
  if (['staff', 'user', 'employee', 'internal'].includes(value)) return 'staff'
  if (['ironworker', 'iron', 'iw', 'union'].includes(value)) return 'ironworker'
  if (['external', 'vendor', 'supplier', 'subcontractor', 'client'].includes(value)) return 'external'
  return value as any
}

const parseSkills = (raw: string) => {
  const value = (raw || '').trim()
  if (!value) return undefined
  return value
    .split(/[;,]/g)
    .map((item) => item.trim())
    .filter(Boolean)
}

const downloadTemplate = () => {
  const headers = FIELD_DEFS.map((f) => f.key).join(',')
  const sample = [
    'ironworker,John Doe,,,MYTE,,63,1988-01-05,\"welding;forklift\",,',
    'staff,Jane PM,jane@example.com,+15555555555,MYTE,,63,,\"pm;lead\",,pm',
  ].join('\n')
  const blob = new Blob([`${headers}\n${sample}\n`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'myte_people_template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export default function PeopleImportPage() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [step, setStep] = useState<ImportStep>('upload')

  const [fileName, setFileName] = useState<string | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<RawRow[]>([])
  const [mapping, setMapping] = useState<Partial<Record<ImportFieldKey, string>>>({})

  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [confirmRows, setConfirmRows] = useState<ConfirmRow[]>([])
  const [confirmResult, setConfirmResult] = useState<ConfirmResponse | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canView = useMemo(() => hasAnyRole(user, ['admin']), [user])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const me = await apiFetch<{ user?: SessionUser }>('/auth/me')
        setUser(me?.user || null)
      } catch (err: any) {
        if (err instanceof ApiError && err.status === 401) {
          setError('You need to sign in to import people.')
          return
        }
        setError(err instanceof ApiError ? err.message : 'Unable to load session.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const buildImportRows = () => {
    const rows: ImportRow[] = []
    rawRows.forEach((rawRow, idx) => {
      const get = (field: ImportFieldKey) => {
        const key = mapping[field]
        if (!key) return ''
        const value = rawRow[key]
        if (value === undefined || value === null) return ''
        return String(value).trim()
      }

      const name = get('name')
      const email = get('email')
      const inviteRole = get('inviteRole')
      rows.push({
        row: idx + 2,
        personType: normalizePersonType(get('personType')),
        name,
        email: email ? email.toLowerCase() : undefined,
        phone: get('phone') || undefined,
        company: get('company') || undefined,
        ironworkerNumber: get('ironworkerNumber') || undefined,
        unionLocal: get('unionLocal') || undefined,
        dateOfBirth: get('dateOfBirth') || undefined,
        skills: parseSkills(get('skills')),
        notes: get('notes') || undefined,
        inviteRole: inviteRole ? inviteRole.trim().toLowerCase() : undefined,
      })
    })
    return rows
  }

  const handleFile = async (file: File) => {
    setError(null)
    setLoading(true)
    setPreview(null)
    setConfirmRows([])
    setConfirmResult(null)
    try {
      const lower = file.name.toLowerCase()
      setFileName(file.name)

      if (lower.endsWith('.csv')) {
        const text = await file.text()
        const parsed = parseCsvText(text)
        if (!parsed.headers.length) throw new Error('No headers found in CSV.')
        setHeaders(parsed.headers)
        setRawRows(parsed.data)
        setMapping(suggestMapping(parsed.headers))
        setStep('map')
        return
      }

      if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
        const XLSX = await import('xlsx')
        const buffer = await file.arrayBuffer()
        const workbook = XLSX.read(buffer, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        if (!sheetName) throw new Error('No sheets found in workbook.')
        const sheet = workbook.Sheets[sheetName]
        const json = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as RawRow[]
        const headerRow = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][]
        const headerCells = Array.isArray(headerRow?.[0]) ? headerRow[0].map((cell) => String(cell).trim()) : []
        const derivedHeaders = headerCells.filter(Boolean)
        const resolvedHeaders = derivedHeaders.length ? derivedHeaders : Object.keys(json?.[0] || {})
        if (!resolvedHeaders.length) throw new Error('No headers found in worksheet.')
        setHeaders(resolvedHeaders)
        setRawRows(Array.isArray(json) ? json : [])
        setMapping(suggestMapping(resolvedHeaders))
        setStep('map')
        return
      }

      throw new Error('Unsupported file type. Upload .csv or .xlsx')
    } catch (err: any) {
      setError(err?.message || 'Unable to read file.')
    } finally {
      setLoading(false)
    }
  }

  const runPreview = async () => {
    setLoading(true)
    setError(null)
    setPreview(null)
    setConfirmRows([])
    setConfirmResult(null)
    try {
      const importRows = buildImportRows()
      if (!importRows.length) throw new Error('No rows found.')
      if (importRows.length > 1000) throw new Error('Row limit exceeded (max 1000).')

      const res = await apiFetch<PreviewResponse>('/people/import/preview', {
        method: 'POST',
        body: JSON.stringify({ rows: importRows }),
      })
      setPreview(res)

      const suggested = new Map<number, PreviewRow>()
      ;(res?.rows || []).forEach((row) => suggested.set(row.row, row))

      const nextConfirmRows: ConfirmRow[] = importRows.map((row) => {
        const p = suggested.get(row.row)
        const defaultAction: ConfirmRow['action'] =
          p?.suggestedAction === 'update' ? 'update' : p?.suggestedAction === 'create' ? 'create' : 'skip'
        return {
          ...row,
          action: defaultAction,
          contactId: p?.contactId,
        }
      })
      setConfirmRows(nextConfirmRows)
      setStep('preview')
    } catch (err: any) {
      setError(err?.message || 'Unable to preview import.')
    } finally {
      setLoading(false)
    }
  }

  const runConfirm = async () => {
    setLoading(true)
    setError(null)
    setConfirmResult(null)
    try {
      if (!confirmRows.length) throw new Error('No rows to import.')
      const res = await apiFetch<ConfirmResponse>('/people/import/confirm', {
        method: 'POST',
        body: JSON.stringify({ rows: confirmRows }),
      })
      setConfirmResult(res)
      setStep('done')
    } catch (err: any) {
      setError(err?.message || 'Unable to confirm import.')
    } finally {
      setLoading(false)
    }
  }

  const previewByRow = useMemo(() => {
    const map = new Map<number, PreviewRow>()
    preview?.rows?.forEach((row) => map.set(row.row, row))
    return map
  }, [preview])

  return (
    <section className="space-y-6">
      <div className="glass-card space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="badge">Import</div>
            <h1>People Import</h1>
            <p className="subtitle">Upload a CSV or Excel file, map columns, and import into your directory.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/dashboard/settings/people" className="btn secondary">
              Back to People
            </Link>
            <button type="button" className="btn secondary" onClick={downloadTemplate}>
              Download template
            </button>
          </div>
        </div>

        {loading && <div className="feedback subtle">Working…</div>}
        {error && <div className={cn('feedback error')}>{error}</div>}
        {user?.id && !canView && <div className={cn('feedback error')}>Org admin access required.</div>}
      </div>

      {canView && step === 'upload' && (
        <div className="glass-card space-y-3">
          <h2>1) Upload</h2>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleFile(file)
            }}
            disabled={loading}
          />
          <div className="muted">Supported: .csv, .xlsx</div>
        </div>
      )}

      {canView && step === 'map' && (
        <div className="glass-card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2>2) Map columns</h2>
            <div className="muted">
              {fileName ? fileName : 'File'} • {rawRows.length} rows
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {FIELD_DEFS.map((field) => (
              <label key={field.key} className="space-y-1 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span>
                    {field.label} {field.required ? <span className="text-red-400">*</span> : null}
                  </span>
                  {field.hint ? <span className="muted">{field.hint}</span> : null}
                </div>
                <select
                  className="input w-full"
                  value={mapping[field.key] || ''}
                  onChange={(e) => setMapping((prev) => ({ ...prev, [field.key]: e.target.value || undefined }))}
                >
                  <option value="">(not mapped)</option>
                  {headers.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn secondary" onClick={() => setStep('upload')} disabled={loading}>
              Back
            </button>
            <button type="button" className="btn primary" onClick={runPreview} disabled={loading}>
              Preview import
            </button>
          </div>
        </div>
      )}

      {canView && step === 'preview' && (
        <div className="glass-card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2>3) Preview</h2>
            <div className="muted">
              {preview
                ? `${preview.summary.creates} create • ${preview.summary.updates} update • ${preview.summary.errors} errors`
                : '—'}
            </div>
          </div>

          {confirmRows.length === 0 ? (
            <div className="muted">No rows to preview.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Type</th>
                    <th>Suggested</th>
                    <th>Action</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {confirmRows.slice(0, 200).map((row) => {
                    const p = previewByRow.get(row.row)
                    const notes = [
                      ...(p?.errors || []).map((e) => `Error: ${e}`),
                      ...(p?.warnings || []).map((w) => `Warn: ${w}`),
                      ...(p?.matchBy ? [`Match: ${p.matchBy}`] : []),
                    ].join(' • ')
                    return (
                      <tr key={row.row} className={cn(row.action === 'skip' && 'opacity-70')}>
                        <td>{row.row}</td>
                        <td>{row.name || '-'}</td>
                        <td>{row.email || '-'}</td>
                        <td>{row.personType || 'external'}</td>
                        <td>{p?.suggestedAction || '-'}</td>
                        <td>
                          <select
                            className="input"
                            value={row.action}
                            onChange={(e) => {
                              const next = e.target.value as ConfirmRow['action']
                              setConfirmRows((prev) =>
                                prev.map((r) => (r.row === row.row ? { ...r, action: next } : r))
                              )
                            }}
                          >
                            <option value="create">create</option>
                            <option value="update">update</option>
                            <option value="skip">skip</option>
                          </select>
                        </td>
                        <td className="muted">{notes || '-'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {confirmRows.length > 200 && <div className="muted mt-2">Showing first 200 rows.</div>}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn secondary" onClick={() => setStep('map')} disabled={loading}>
              Back
            </button>
            <button type="button" className="btn primary" onClick={runConfirm} disabled={loading}>
              Confirm import
            </button>
          </div>
        </div>
      )}

      {canView && step === 'done' && (
        <div className="glass-card space-y-3">
          <h2>4) Done</h2>
          {confirmResult ? (
            <>
              <div className="muted">
                {confirmResult.created} created • {confirmResult.updated} updated • {confirmResult.skipped} skipped •{' '}
                {confirmResult.invitesCreated} invites • {confirmResult.errors} errors
              </div>
              <div className="overflow-x-auto">
                <table className="table w-full">
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Status</th>
                      <th>Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {confirmResult.results.slice(0, 200).map((r) => (
                      <tr key={r.row}>
                        <td>{r.row}</td>
                        <td>{r.status}</td>
                        <td className="muted">{r.message || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {confirmResult.results.length > 200 && <div className="muted mt-2">Showing first 200 rows.</div>}
              </div>
            </>
          ) : (
            <div className="muted">No import result.</div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Link href="/dashboard/settings/people" className="btn primary">
              Return to People
            </Link>
            <button
              type="button"
              className="btn secondary"
              onClick={() => {
                setStep('upload')
                setFileName(null)
                setHeaders([])
                setRawRows([])
                setPreview(null)
                setConfirmRows([])
                setConfirmResult(null)
                setMapping({})
              }}
            >
              Start new import
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

