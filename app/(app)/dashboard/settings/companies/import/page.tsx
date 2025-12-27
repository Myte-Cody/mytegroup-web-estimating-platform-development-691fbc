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
  | 'companyName'
  | 'companyExternalId'
  | 'website'
  | 'mainEmail'
  | 'mainPhone'
  | 'companyTypeKeys'
  | 'companyTagKeys'
  | 'notes'
  | 'locationName'
  | 'locationExternalId'
  | 'locationEmail'
  | 'locationPhone'
  | 'locationAddressLine1'
  | 'locationCity'
  | 'locationRegion'
  | 'locationPostal'
  | 'locationCountry'
  | 'locationTagKeys'
  | 'locationNotes'

type FieldDef = { key: ImportFieldKey; label: string; required?: boolean; hint?: string }

const FIELD_DEFS: FieldDef[] = [
  { key: 'companyName', label: 'Company name', required: true },
  { key: 'companyExternalId', label: 'Company external id' },
  { key: 'website', label: 'Website' },
  { key: 'mainEmail', label: 'Main email' },
  { key: 'mainPhone', label: 'Main phone' },
  { key: 'companyTypeKeys', label: 'Company types', hint: 'Comma/semicolon separated' },
  { key: 'companyTagKeys', label: 'Company tags', hint: 'Comma/semicolon separated' },
  { key: 'notes', label: 'Company notes' },
  { key: 'locationName', label: 'Location name' },
  { key: 'locationExternalId', label: 'Location external id' },
  { key: 'locationEmail', label: 'Location email' },
  { key: 'locationPhone', label: 'Location phone' },
  { key: 'locationAddressLine1', label: 'Location address line 1' },
  { key: 'locationCity', label: 'Location city' },
  { key: 'locationRegion', label: 'Location region' },
  { key: 'locationPostal', label: 'Location postal' },
  { key: 'locationCountry', label: 'Location country' },
  { key: 'locationTagKeys', label: 'Location tags', hint: 'Comma/semicolon separated' },
  { key: 'locationNotes', label: 'Location notes' },
]

type RawRow = Record<string, any>

type ImportRow = {
  row: number
  companyName: string
  companyExternalId?: string
  website?: string
  mainEmail?: string
  mainPhone?: string
  companyTypeKeys?: string[]
  companyTagKeys?: string[]
  notes?: string
  locationName?: string
  locationExternalId?: string
  locationEmail?: string
  locationPhone?: string
  locationAddressLine1?: string
  locationCity?: string
  locationRegion?: string
  locationPostal?: string
  locationCountry?: string
  locationTagKeys?: string[]
  locationNotes?: string
}

type PreviewRow = {
  row: number
  suggestedAction: 'upsert' | 'error'
  companyAction?: 'create' | 'update'
  locationAction?: 'create' | 'update' | 'none'
  errors?: string[]
  warnings?: string[]
}

type PreviewResponse = {
  orgId: string
  summary: { total: number; creates: number; updates: number; errors: number }
  rows: PreviewRow[]
}

type ConfirmRow = ImportRow & {
  action: 'upsert' | 'skip'
}

type ConfirmResponse = {
  orgId: string
  processed: number
  created: number
  updated: number
  skipped: number
  locationsCreated: number
  locationsUpdated: number
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
    companyName: pick(['company_name', 'companyName', 'company', 'name', 'vendor']),
    companyExternalId: pick(['company_external_id', 'companyExternalId', 'externalId']),
    website: pick(['website', 'url']),
    mainEmail: pick(['main_email', 'mainEmail', 'email']),
    mainPhone: pick(['main_phone', 'mainPhone', 'phone']),
    companyTypeKeys: pick(['company_types', 'companyTypeKeys', 'types']),
    companyTagKeys: pick(['company_tags', 'companyTagKeys', 'tags']),
    notes: pick(['notes', 'company_notes']),
    locationName: pick(['location_name', 'locationName', 'branch', 'site']),
    locationExternalId: pick(['location_external_id', 'locationExternalId']),
    locationEmail: pick(['location_email', 'locationEmail']),
    locationPhone: pick(['location_phone', 'locationPhone']),
    locationAddressLine1: pick(['location_address_line1', 'address', 'addressLine1']),
    locationCity: pick(['location_city', 'city']),
    locationRegion: pick(['location_region', 'region', 'state']),
    locationPostal: pick(['location_postal', 'postal', 'zip']),
    locationCountry: pick(['location_country', 'country']),
    locationTagKeys: pick(['location_tags', 'locationTagKeys']),
    locationNotes: pick(['location_notes', 'locationNotes']),
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

const parseDelimitedList = (raw: string) => {
  const value = (raw || '').trim()
  if (!value) return undefined
  return value
    .split(/[;,]/g)
    .map((item) => item.trim())
    .filter(Boolean)
}

const downloadTemplate = () => {
  const headers = [
    'company_name',
    'company_types',
    'company_tags',
    'company_external_id',
    'website',
    'main_email',
    'main_phone',
    'notes',
    'location_name',
    'location_external_id',
    'location_email',
    'location_phone',
    'location_address_line1',
    'location_city',
    'location_region',
    'location_postal',
    'location_country',
    'location_tags',
    'location_notes',
  ].join(',')
  const sample = [
    'Myte Steel,\"supplier;subcontractor\",\"galvanizing\",MYTE-001,https://example.com,info@myte.com,+15551230000,\"Preferred vendor\",Main Shop,,shop@myte.com,+15551230001,123 Main St,Montreal,QC,H1H1H1,CA,\"shop\",',
  ].join('\n')
  const blob = new Blob([`${headers}\n${sample}\n`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'myte_companies_v1_template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export default function CompaniesImportPage() {
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
          setError('You need to sign in to import companies.')
          return
        }
        setError(err instanceof ApiError ? err.message : 'Unable to load session.')
      } finally {
        setLoading(false)
      }
    }
    void load()
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

      rows.push({
        row: idx + 2,
        companyName: get('companyName'),
        companyExternalId: get('companyExternalId') || undefined,
        website: get('website') || undefined,
        mainEmail: get('mainEmail') ? get('mainEmail').toLowerCase() : undefined,
        mainPhone: get('mainPhone') || undefined,
        companyTypeKeys: parseDelimitedList(get('companyTypeKeys')),
        companyTagKeys: parseDelimitedList(get('companyTagKeys')),
        notes: get('notes') || undefined,
        locationName: get('locationName') || undefined,
        locationExternalId: get('locationExternalId') || undefined,
        locationEmail: get('locationEmail') ? get('locationEmail').toLowerCase() : undefined,
        locationPhone: get('locationPhone') || undefined,
        locationAddressLine1: get('locationAddressLine1') || undefined,
        locationCity: get('locationCity') || undefined,
        locationRegion: get('locationRegion') || undefined,
        locationPostal: get('locationPostal') || undefined,
        locationCountry: get('locationCountry') || undefined,
        locationTagKeys: parseDelimitedList(get('locationTagKeys')),
        locationNotes: get('locationNotes') || undefined,
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

      if (lower.endsWith('.xlsx')) {
        const buffer = await file.arrayBuffer()
        const ExcelJSImport = await import('exceljs')
        const workbook = new ExcelJSImport.Workbook()
        await workbook.xlsx.load(buffer)

        const worksheet = workbook.worksheets[0]
        if (!worksheet) throw new Error('No sheets found in workbook.')

        const asText = (value: unknown) => {
          if (value === null || value === undefined) return ''
          if (typeof value === 'string') return value
          if (typeof value === 'number' || typeof value === 'boolean' || value instanceof Date) return String(value)
          if (typeof value === 'object' && 'text' in (value as any) && typeof (value as any).text === 'string') {
            return (value as any).text
          }
          if (typeof value === 'object' && 'richText' in (value as any) && Array.isArray((value as any).richText)) {
            return (value as any).richText.map((part: any) => part?.text || '').join('')
          }
          return String(value)
        }

        const headerValues = Array.isArray(worksheet.getRow(1).values) ? (worksheet.getRow(1).values as any[]) : []
        const resolvedHeaders = headerValues
          .slice(1)
          .map((cell) => asText(cell).trim())
          .filter(Boolean)
        if (!resolvedHeaders.length) throw new Error('No headers found in worksheet.')

        const rows: RawRow[] = []
        for (let rowIndex = 2; rowIndex <= worksheet.rowCount; rowIndex++) {
          const row = worksheet.getRow(rowIndex)
          const obj: RawRow = {}
          resolvedHeaders.forEach((header, idx) => {
            const cellValue = row.getCell(idx + 1).value
            obj[header] = asText(cellValue).trim()
          })
          const hasAnyValue = Object.values(obj).some((v) => String(v || '').trim().length > 0)
          if (hasAnyValue) rows.push(obj)
        }

        setHeaders(resolvedHeaders)
        setRawRows(rows)
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

      const res = await apiFetch<PreviewResponse>('/companies/import/v1/preview', {
        method: 'POST',
        body: JSON.stringify({ rows: importRows }),
      })
      setPreview(res)

      const suggested = new Map<number, PreviewRow>()
      ;(res?.rows || []).forEach((row) => suggested.set(row.row, row))

      const nextConfirmRows: ConfirmRow[] = importRows.map((row) => {
        const p = suggested.get(row.row)
        const defaultAction: ConfirmRow['action'] = p?.suggestedAction === 'error' ? 'skip' : 'upsert'
        return {
          ...row,
          action: defaultAction,
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
      const res = await apiFetch<ConfirmResponse>('/companies/import/v1/confirm', {
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
            <h1>Companies Import</h1>
            <p className="subtitle">Upload a CSV or .xlsx file, map columns, and import companies and locations.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/dashboard/settings/companies" className="btn secondary">
              Back to Companies
            </Link>
            <button type="button" className="btn secondary" onClick={downloadTemplate}>
              Download template
            </button>
          </div>
        </div>

        {loading && <div className="feedback subtle">Working.</div>}
        {error && <div className={cn('feedback error')}>{error}</div>}
        {user?.id && !canView && <div className={cn('feedback error')}>Org admin access required.</div>}
      </div>

      {canView && step === 'upload' && (
        <div className="glass-card space-y-3">
          <h2>1) Upload</h2>
          <input
            type="file"
            accept=".csv,.xlsx"
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
                : '-'}
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
                    <th>Company</th>
                    <th>Location</th>
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
                      ...(p?.companyAction ? [`Company: ${p.companyAction}`] : []),
                      ...(p?.locationAction && p.locationAction !== 'none' ? [`Location: ${p.locationAction}`] : []),
                    ].join(' | ')
                    return (
                      <tr key={row.row} className={cn(row.action === 'skip' && 'opacity-70')}>
                        <td>{row.row}</td>
                        <td>{row.companyName || '-'}</td>
                        <td>{row.locationName || '-'}</td>
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
                            <option value="upsert">upsert</option>
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
                {confirmResult.created} created • {confirmResult.updated} updated • {confirmResult.locationsCreated} locations created •{' '}
                {confirmResult.locationsUpdated} locations updated • {confirmResult.errors} errors
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
            <Link href="/dashboard/settings/companies" className="btn primary">
              Return to Companies
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
