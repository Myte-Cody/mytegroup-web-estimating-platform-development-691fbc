'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'

import { ApiError, apiFetch } from '../../../../../lib/api'
import { hasAnyRole } from '../../../../../lib/rbac'
import { cn } from '../../../../../lib/utils'

type SessionUser = {
  id?: string
  role?: string
  roles?: string[]
  orgId?: string
}

type ImportStep = 'upload' | 'map' | 'review' | 'preview' | 'done'

type ImportFieldKey =
  | 'personType'
  | 'displayName'
  | 'emails'
  | 'primaryEmail'
  | 'phones'
  | 'primaryPhone'
  | 'orgLocationName'
  | 'reportsToDisplayName'
  | 'companyExternalId'
  | 'companyName'
  | 'companyLocationExternalId'
  | 'companyLocationName'
  | 'title'
  | 'departmentKey'
  | 'ironworkerNumber'
  | 'unionLocal'
  | 'skillKeys'
  | 'tagKeys'
  | 'certifications'
  | 'rating'
  | 'notes'

type FieldDef = { key: ImportFieldKey; label: string; required?: boolean; hint?: string }

const FIELD_DEFS: FieldDef[] = [
  { key: 'personType', label: 'Person type', required: true, hint: 'internal_staff | internal_union | external_person' },
  { key: 'displayName', label: 'Name', required: true },
  { key: 'emails', label: 'Email(s)', hint: 'Separate multiple emails with ; or |' },
  { key: 'phones', label: 'Phone(s)', hint: 'Separate multiple phones with ; or |' },
  { key: 'companyName', label: 'Company (optional)', hint: 'Suppliers/subcontractors/clients' },
  { key: 'title', label: 'Title (optional)' },
  { key: 'orgLocationName', label: 'Org location (optional)', hint: 'Creates location if missing' },
  { key: 'ironworkerNumber', label: 'Ironworker # (optional)' },
  { key: 'unionLocal', label: 'Union local (optional)' },
  { key: 'notes', label: 'Notes' },

  { key: 'primaryEmail', label: 'Primary email', hint: 'Optional (defaults to first email)' },
  { key: 'primaryPhone', label: 'Primary phone', hint: 'Optional (defaults to first phone)' },
  { key: 'reportsToDisplayName', label: 'Reports to (optional)', hint: 'Exact match (best effort)' },
  { key: 'companyExternalId', label: 'Company external id (optional)', hint: 'Deterministic linking key' },
  { key: 'companyLocationName', label: 'Company location (optional)' },
  { key: 'companyLocationExternalId', label: 'Company location external id (optional)' },
  { key: 'departmentKey', label: 'Department (optional)' },
  { key: 'skillKeys', label: 'Skills (optional)', hint: 'Comma/semicolon separated' },
  { key: 'tagKeys', label: 'Tags (optional)', hint: 'Comma/semicolon separated' },
  { key: 'certifications', label: 'Certifications (optional)', hint: 'Comma/semicolon separated' },
  { key: 'rating', label: 'Rating (optional)', hint: 'Number' },
]

const ESSENTIAL_FIELD_KEYS: ImportFieldKey[] = [
  'personType',
  'displayName',
  'emails',
  'phones',
  'companyName',
  'title',
  'orgLocationName',
  'ironworkerNumber',
  'unionLocal',
  'notes',
]

const ESSENTIAL_FIELDS: FieldDef[] = ESSENTIAL_FIELD_KEYS.map((key) => FIELD_DEFS.find((f) => f.key === key)).filter(Boolean) as FieldDef[]
const ADVANCED_FIELDS: FieldDef[] = FIELD_DEFS.filter((f) => !ESSENTIAL_FIELD_KEYS.includes(f.key))

type RawRow = Record<string, any>

type ImportRow = {
  row: number
  personType: 'internal_staff' | 'internal_union' | 'external_person'
  displayName: string
  emails?: string[]
  primaryEmail?: string
  phones?: string[]
  primaryPhone?: string
  orgLocationName?: string
  reportsToDisplayName?: string
  companyExternalId?: string
  companyName?: string
  companyLocationExternalId?: string
  companyLocationName?: string
  title?: string
  departmentKey?: string
  ironworkerNumber?: string
  unionLocal?: string
  skillKeys?: string[]
  tagKeys?: string[]
  certifications?: string[]
  rating?: number
  notes?: string
}

type WorkingRow = ImportRow & {
  sourceRow: number
  derived?: boolean
  excluded?: boolean
  issues?: string[]
}

type PreviewRow = {
  row: number
  suggestedAction: 'create' | 'update' | 'error'
  personId?: string
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
  personId?: string
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
    personType: pick(['person_type', 'personType', 'type']),
    displayName: pick(['display_name', 'displayName', 'name', 'full_name', 'fullname']),
    emails: pick(['emails', 'email', 'email_address', 'emailAddress']),
    primaryEmail: pick(['primary_email', 'primaryEmail']),
    phones: pick(['phones', 'phone', 'phone_number', 'mobile', 'cell']),
    primaryPhone: pick(['primary_phone', 'primaryPhone']),
    orgLocationName: pick(['org_location_name', 'orgLocation', 'office', 'office_name']),
    reportsToDisplayName: pick(['reports_to_display_name', 'reportsTo', 'manager', 'reports_to']),
    companyExternalId: pick(['company_external_id', 'companyExternalId']),
    companyName: pick(['company_name', 'company', 'vendor', 'supplier']),
    // Avoid mapping org_location_name -> company_location_name by accident.
    // If the sheet has a generic "location_name", users can map it manually in Advanced.
    companyLocationExternalId: pick(['company_location_external_id', 'companyLocationExternalId']),
    companyLocationName: pick(['company_location_name', 'companyLocation', 'companyLocationName']),
    title: pick(['title', 'job_title', 'position']),
    departmentKey: pick(['department', 'department_key']),
    ironworkerNumber: pick(['ironworker_number', 'ironworkerNumber', 'ironworker', 'member_number', 'unionNumber']),
    unionLocal: pick(['union_local', 'unionLocal', 'local']),
    skillKeys: pick(['skills', 'skill_keys']),
    tagKeys: pick(['tags', 'tag_keys']),
    certifications: pick(['certifications', 'certs']),
    rating: pick(['rating', 'score']),
    notes: pick(['notes', 'note']),
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

const parsePipeList = (raw: string) => {
  const value = (raw || '').trim()
  if (!value) return undefined
  const parts = value.includes('|') ? value.split('|') : value.split(/[;,]/g)
  return parts
    .map((item) => item.trim())
    .filter(Boolean)
}

const extractEmails = (raw: string) => {
  const value = (raw || '').trim()
  if (!value) return []
  const matches = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []
  const seen = new Set<string>()
  const out: string[] = []
  for (const m of matches) {
    const normalized = m.trim().toLowerCase()
    if (!normalized) continue
    if (seen.has(normalized)) continue
    seen.add(normalized)
    out.push(normalized)
  }
  return out
}

const extractPhones = (raw: string) => {
  const value = (raw || '').trim()
  if (!value) return []
  const candidates = value
    .split(/[\n,;|]/g)
    .map((c) => c.trim())
    .filter(Boolean)

  const seen = new Set<string>()
  const out: string[] = []
  for (const c of candidates) {
    const digits = c.replace(/[^\d+]/g, '')
    if (!digits) continue
    if (digits.length < 7) continue
    if (seen.has(digits)) continue
    seen.add(digits)
    out.push(digits)
  }
  return out
}

const normalizeDedupeKey = (row: WorkingRow) => {
  // Backward-compatible single-key fallback (used nowhere after dedupe refactor, but kept
  // as a stable helper for future quick grouping).
  const email = (row.primaryEmail || row.emails?.[0] || '').trim().toLowerCase()
  if (email) return `primaryEmail:${email}`
  const iron = String(row.ironworkerNumber || '').trim()
  if (iron) return `ironworkerNumber:${iron}`
  const phone = (row.primaryPhone || row.phones?.[0] || '').replace(/[^\d+]/g, '')
  if (phone) return `primaryPhone:${phone}`
  const name = (row.displayName || '').trim().toLowerCase()
  const company = (row.companyName || '').trim().toLowerCase()
  if (name || company) return `name_company:${name}|${company}`
  return ''
}

type DedupeKind = 'primaryEmail' | 'ironworkerNumber' | 'primaryPhone' | 'name_company'

const dedupeKeysForRow = (row: WorkingRow) => {
  const out: Array<{ kind: DedupeKind; key: string; blocking: boolean }> = []

  const email = (row.primaryEmail || row.emails?.[0] || '').trim().toLowerCase()
  if (email) out.push({ kind: 'primaryEmail', key: `primaryEmail:${email}`, blocking: true })

  const iron = String(row.ironworkerNumber || '').trim()
  if (iron) out.push({ kind: 'ironworkerNumber', key: `ironworkerNumber:${iron}`, blocking: true })

  const phone = (row.primaryPhone || row.phones?.[0] || '').replace(/[^\d+]/g, '')
  if (phone) out.push({ kind: 'primaryPhone', key: `primaryPhone:${phone}`, blocking: true })

  const name = (row.displayName || '').trim().toLowerCase()
  const company = (row.companyName || '').trim().toLowerCase()
  if (name || company) out.push({ kind: 'name_company', key: `name_company:${name}|${company}`, blocking: false })

  return out
}

const labelForDedupeKind = (kind: DedupeKind) => {
  if (kind === 'primaryEmail') return 'primary email'
  if (kind === 'ironworkerNumber') return 'ironworker #'
  if (kind === 'primaryPhone') return 'primary phone'
  return 'name + company'
}

const stripComputedDedupeIssues = (issues?: string[]) => {
  return (issues || []).filter((issue) => {
    const trimmed = String(issue || '').trim()
    if (!trimmed) return false
    if (trimmed === 'Auto-excluded duplicate') return true
    if (trimmed.startsWith('Duplicate ')) return false
    if (trimmed.startsWith('Potential duplicate ')) return false
    return true
  })
}

const stripWorking = (row: WorkingRow): ImportRow => {
  const { sourceRow: _sourceRow, derived: _derived, excluded: _excluded, issues: _issues, ...rest } = row
  return rest
}

const normalizePersonType = (raw: string) => {
  const value = (raw || '').trim().toLowerCase()
  if (!value) return 'external_person'
  if (['internal_staff', 'staff', 'user', 'employee', 'internal'].includes(value)) return 'internal_staff'
  if (['internal_union', 'ironworker', 'iron', 'iw', 'union'].includes(value)) return 'internal_union'
  if (['external_person', 'external', 'vendor', 'supplier', 'subcontractor', 'client'].includes(value)) return 'external_person'
  return value as any
}

const parseDelimitedList = (raw: string, delimiter: RegExp) => {
  const value = (raw || '').trim()
  if (!value) return undefined
  return value
    .split(delimiter)
    .map((item) => item.trim())
    .filter(Boolean)
}

const splitPossibleNames = (raw: string) => {
  const value = (raw || '').trim()
  if (!value) return []

  const split = (rx: RegExp) =>
    value
      .split(rx)
      .map((part) => part.trim())
      .filter(Boolean)

  const bySemicolon = split(/[;|]/g)
  if (bySemicolon.length > 1) return bySemicolon

  const bySlash = split(/\s+\/\s+/g)
  if (bySlash.length > 1) return bySlash

  const byAmp = split(/\s+&\s+/g)
  if (byAmp.length > 1) return byAmp

  return [value]
}

const downloadTemplate = () => {
  const headers = [
    'person_type',
    'display_name',
    'email',
    'phone',
    'company_name',
    'title',
    'org_location_name',
    'ironworker_number',
    'union_local',
    'notes',
  ].join(',')
  const sample = [
    'internal_staff,Jane PM,jane.pm@myte.com,+15555550000,Myte Group Inc.,Project Manager,HQ,,,\"Core PM\"',
    'internal_union,John Doe,john.doe@example.com,+15555551234,,Ironworker,Shop,12345,63,',
    'external_person,Nina Vendor,\"nina@acme.example; nina.ops@acme.example\",+15555550302,Acme Steel,Operations Coordinator,,,,\"Multiple emails are supported\"',
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

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [fileName, setFileName] = useState<string | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<RawRow[]>([])
  const [mapping, setMapping] = useState<Partial<Record<ImportFieldKey, string>>>({})
  const [showAdvancedMapping, setShowAdvancedMapping] = useState(false)

  const [workingRows, setWorkingRows] = useState<WorkingRow[]>([])

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

  const buildWorkingRows = () => {
    const rows: WorkingRow[] = []
    rawRows.forEach((rawRow, idx) => {
      const get = (field: ImportFieldKey) => {
        const key = mapping[field]
        if (!key) return ''
        const value = rawRow[key]
        if (value === undefined || value === null) return ''
        return String(value).trim()
      }

      const displayName = get('displayName')
      const personType = normalizePersonType(get('personType'))
      const emailsRaw = [get('emails'), get('primaryEmail')].filter(Boolean).join(' ')
      const phonesRaw = [get('phones'), get('primaryPhone')].filter(Boolean).join(' ')

      const emails = (() => {
        const pipeList = parsePipeList(get('emails')) || []
        const extracted = extractEmails(emailsRaw)
        const merged = [...pipeList.map((e) => e.trim().toLowerCase()).filter(Boolean), ...extracted]
        return Array.from(new Set(merged)).filter(Boolean) || undefined
      })()

      const primaryEmailRaw = (get('primaryEmail') || '').trim().toLowerCase()
      const phones = (() => {
        const pipeList = parsePipeList(get('phones')) || []
        const extracted = extractPhones(phonesRaw)
        const merged = [...pipeList.map((p) => p.trim()).filter(Boolean), ...extracted]
        return Array.from(new Set(merged)).filter(Boolean) || undefined
      })()
      const primaryEmail = primaryEmailRaw || emails?.[0] || ''

      const primaryPhoneRaw = (get('primaryPhone') || '').trim()
      const primaryPhone = primaryPhoneRaw || phones?.[0] || ''
      const ratingRaw = get('rating')
      const rating = ratingRaw.trim() === '' ? undefined : Number(ratingRaw)

      const baseRow: WorkingRow = {
        row: idx + 2,
        sourceRow: idx + 2,
        personType,
        displayName,
        emails: emails?.length ? emails : undefined,
        primaryEmail: primaryEmail || undefined,
        phones: phones?.length ? phones : undefined,
        primaryPhone: primaryPhone || undefined,
        orgLocationName: get('orgLocationName') || undefined,
        reportsToDisplayName: get('reportsToDisplayName') || undefined,
        companyExternalId: get('companyExternalId') || undefined,
        companyName: get('companyName') || undefined,
        companyLocationExternalId: get('companyLocationExternalId') || undefined,
        companyLocationName: get('companyLocationName') || undefined,
        title: get('title') || undefined,
        departmentKey: get('departmentKey') || undefined,
        ironworkerNumber: get('ironworkerNumber') || undefined,
        unionLocal: get('unionLocal') || undefined,
        skillKeys: parseDelimitedList(get('skillKeys'), /[;,]/g),
        tagKeys: parseDelimitedList(get('tagKeys'), /[;,]/g),
        certifications: parseDelimitedList(get('certifications'), /[;,]/g),
        rating: Number.isFinite(rating as any) ? rating : undefined,
        notes: get('notes') || undefined,
      }

      const issues: string[] = []
      if (!baseRow.displayName?.trim()) issues.push('Missing display name')
      if (!baseRow.primaryEmail && !baseRow.primaryPhone) issues.push('Missing primary email/phone')

      const extractedEmails = baseRow.emails || []
      const nameParts = splitPossibleNames(baseRow.displayName || '')

      const canSplitByNameEmail =
        nameParts.length > 1 && extractedEmails.length > 1 && nameParts.length === extractedEmails.length

      if (canSplitByNameEmail) {
        const phonesForSplit = (baseRow.phones || []).length === nameParts.length ? (baseRow.phones || []) : []

        nameParts.forEach((namePart, partIdx) => {
          const email = extractedEmails[partIdx]
          const phoneForPart = phonesForSplit.length ? phonesForSplit[partIdx] : ''
          const rowNumber = partIdx === 0 ? baseRow.row : 100000 + baseRow.row * 100 + (partIdx + 1)

          rows.push({
            ...baseRow,
            row: rowNumber,
            sourceRow: baseRow.sourceRow,
            derived: partIdx > 0,
            displayName: namePart,
            emails: email ? [email] : undefined,
            primaryEmail: email || undefined,
            phones: phoneForPart ? [phoneForPart] : partIdx === 0 ? baseRow.phones : undefined,
            primaryPhone: phoneForPart ? phoneForPart : partIdx === 0 ? baseRow.primaryPhone : undefined,
            issues:
              partIdx === 0
                ? issues.length
                  ? issues
                  : undefined
                : ['Derived row from multi-contact row; review and add missing details or exclude'],
          })
        })
        return
      }

      if (nameParts.length > 1 && extractedEmails.length > 1) {
        issues.push('Possible multi-contact row (multiple names/emails); review')
      }

      baseRow.issues = issues.length ? issues : undefined
      rows.push(baseRow)
    })
    return rows
  }

  const handleFile = async (file: File) => {
    setError(null)
    setLoading(true)
    setPreview(null)
    setConfirmRows([])
    setConfirmResult(null)
    setWorkingRows([])
    setShowAdvancedMapping(false)
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
        setWorkingRows([])
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
        setWorkingRows([])
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

  const recomputeDedupeFlags = (rows: WorkingRow[]) => {
    const baseRows = rows.map((row) => ({ ...row, issues: stripComputedDedupeIssues(row.issues) }))

    const byKey = new Map<
      string,
      { kind: DedupeKind; blocking: boolean; indexes: number[]; rowNumbers: number[] }
    >()

    baseRows.forEach((row, idx) => {
      if (row.excluded) return
      dedupeKeysForRow(row).forEach(({ kind, key, blocking }) => {
        if (!key) return
        const existing = byKey.get(key) || { kind, blocking, indexes: [], rowNumbers: [] }
        existing.indexes.push(idx)
        existing.rowNumbers.push(row.row)
        byKey.set(key, existing)
      })
    })

    const messagesByIndex = new Map<number, Set<string>>()
    byKey.forEach((group) => {
      if (group.indexes.length < 2) return
      const rowList = Array.from(new Set(group.rowNumbers)).sort((a, b) => a - b)
      const message = `${group.blocking ? 'Duplicate' : 'Potential duplicate'} ${labelForDedupeKind(group.kind)} within file (rows ${rowList.join(', ')})`
      group.indexes.forEach((idx) => {
        const set = messagesByIndex.get(idx) || new Set<string>()
        set.add(message)
        messagesByIndex.set(idx, set)
      })
    })

    return baseRows.map((row, idx) => {
      const messages = messagesByIndex.get(idx)
      if (!messages || messages.size === 0) {
        return { ...row, issues: row.issues?.length ? row.issues : undefined }
      }
      const merged = [...(row.issues || []), ...Array.from(messages)]
      return { ...row, issues: merged.length ? merged : undefined }
    })
  }

  const buildReviewRows = () => {
    const built = buildWorkingRows()
    const limited = built.slice(0, 2000)
    return recomputeDedupeFlags(limited)
  }

  const goToReview = () => {
    setError(null)
    setPreview(null)
    setConfirmRows([])
    setConfirmResult(null)
    const next = buildReviewRows()
    setWorkingRows(next)
    setStep('review')
  }

  const runPreview = async () => {
    setLoading(true)
    setError(null)
    setPreview(null)
    setConfirmRows([])
    setConfirmResult(null)
    try {
      const importRows = (workingRows.length ? workingRows : buildReviewRows()).filter((r) => !r.excluded).map(stripWorking)
      if (!importRows.length) throw new Error('No rows found.')
      if (importRows.length > 1000) throw new Error('Row limit exceeded (max 1000).')

      const res = await apiFetch<PreviewResponse>('/people/import/v1/preview', {
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
          personId: p?.personId,
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
      const res = await apiFetch<ConfirmResponse>('/people/import/v1/confirm', {
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

  const missingRequiredFields = useMemo(() => {
    return FIELD_DEFS.filter((field) => field.required && !mapping[field.key])
  }, [mapping])

  const mappingFields = useMemo(() => {
    return showAdvancedMapping ? [...ESSENTIAL_FIELDS, ...ADVANCED_FIELDS] : ESSENTIAL_FIELDS
  }, [showAdvancedMapping])

  const reviewSummary = useMemo(() => {
    const total = workingRows.length
    const excluded = workingRows.filter((r) => r.excluded).length
    const withIssues = workingRows.filter((r) => (r.issues || []).length > 0).length
    const dupes = workingRows.filter((r) => (r.issues || []).some((i) => i.toLowerCase().includes('duplicate'))).length
    const derived = workingRows.filter((r) => r.derived).length
    return { total, excluded, withIssues, dupes, derived }
  }, [workingRows])

  const blockingDupes = useMemo(() => {
    const counts = new Map<string, number>()
    workingRows.forEach((row) => {
      if (row.excluded) return
      dedupeKeysForRow(row)
        .filter((k) => k.blocking)
        .forEach(({ key }) => {
          counts.set(key, (counts.get(key) || 0) + 1)
        })
    })

    let groups = 0
    counts.forEach((count) => {
      if (count > 1) groups += 1
    })

    return { groups }
  }, [workingRows])

  return (
    <section className="space-y-6">
      <div className="glass-card space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="badge">Import</div>
            <h1>People Import</h1>
            <p className="subtitle">Upload a CSV or .xlsx file, map columns, and import into your directory.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/dashboard/settings/people" className="btn secondary">
              Back to People
            </Link>
          </div>
        </div>

        {loading && <div className="feedback subtle">Working…</div>}
        {error && <div className={cn('feedback error')}>{error}</div>}
        {user?.id && !canView && <div className={cn('feedback error')}>Org admin access required.</div>}
      </div>

      {canView && step === 'upload' && (
        <div className="glass-card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2>1) Upload</h2>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="btn secondary" onClick={downloadTemplate} disabled={loading}>
                Download template
              </button>
              <a href="/fixtures/myte_people_v1_mock_50.csv" className="btn secondary" download>
                Download 50-row sample
              </a>
            </div>
          </div>

          <div className="muted">
            Use the template for the easiest import. Required columns: <span className="font-semibold">person_type</span> and{' '}
            <span className="font-semibold">display_name</span>. You can put multiple emails/phones in a single cell using{' '}
            <span className="font-semibold">;</span> or <span className="font-semibold">|</span>. Invites are created separately after
            import.
          </div>

          <input
            ref={fileInputRef}
            className="hidden"
            type="file"
            accept=".csv,.xlsx"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleFile(file)
            }}
            disabled={loading}
          />

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn primary"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
            >
              Choose file
            </button>
            <div className="muted">{fileName ? `Selected: ${fileName}` : 'Supported: .csv, .xlsx'}</div>
          </div>
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

          <div className="muted">
            Map the essentials below. If your file uses the template headers, this should already be pre-filled.
          </div>

          {missingRequiredFields.length > 0 && (
            <div className="feedback error">
              Map required fields: {missingRequiredFields.map((f) => f.label).join(', ')}
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            {mappingFields.map((field) => (
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

          <button
            type="button"
            className="btn secondary"
            onClick={() => setShowAdvancedMapping((prev) => !prev)}
            disabled={loading}
          >
            {showAdvancedMapping ? 'Hide advanced fields' : `Show advanced fields (${ADVANCED_FIELDS.length})`}
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn secondary" onClick={() => setStep('upload')} disabled={loading}>
              Back
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={goToReview}
              disabled={loading || missingRequiredFields.length > 0}
            >
              Next: review & dedupe
            </button>
          </div>
        </div>
      )}

      {canView && step === 'review' && (
        <div className="glass-card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2>3) Review</h2>
            <div className="muted">
              {reviewSummary.total} rows  {reviewSummary.excluded} excluded  {reviewSummary.derived} derived {' '}
              {reviewSummary.dupes} potential dupes
            </div>
          </div>

          <div className="muted">
            Edit inline, exclude duplicates or junk rows, then preview. Derived rows only appear when we detect multiple contacts in a
            single source row (ex: multiple names + emails).
          </div>

          {blockingDupes.groups > 0 && (
            <div className="feedback error">
              {blockingDupes.groups} duplicate group(s) are still included. Exclude duplicates (or edit the key fields) before
              previewing.
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn secondary"
              onClick={() => {
                setWorkingRows((prev) => {
                  const next = prev.map((row) => ({ ...row, excluded: false }))
                  return recomputeDedupeFlags(next)
                })
              }}
              disabled={loading || workingRows.length === 0}
            >
              Include all
            </button>
            <button
              type="button"
              className="btn secondary"
              onClick={() => {
                setWorkingRows((prev) => {
                  const seen = new Set<string>()
                  const next = prev.map((row) => {
                    const keys = dedupeKeysForRow(row)
                      .filter((k) => k.blocking)
                      .map((k) => k.key)
                      .filter(Boolean)
                    if (!keys.length) return row

                    const hasSeen = keys.some((key) => seen.has(key))
                    if (hasSeen) {
                      return { ...row, excluded: true, issues: [...(row.issues || []), 'Auto-excluded duplicate'] }
                    }

                    keys.forEach((key) => seen.add(key))
                    return row
                  })
                  return recomputeDedupeFlags(next)
                })
              }}
              disabled={loading || workingRows.length === 0}
            >
              Auto-exclude duplicates (keep first)
            </button>
          </div>

          {workingRows.length === 0 ? (
            <div className="muted">No rows to review.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>Include</th>
                    <th>Row</th>
                    <th>Source</th>
                    <th>Display name</th>
                    <th>Primary email</th>
                    <th>Primary phone</th>
                    <th>Company</th>
                    <th>Person type</th>
                    <th>Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {workingRows.slice(0, 200).map((row) => {
                    const primaryEmail = row.primaryEmail || row.emails?.[0] || ''
                    const primaryPhone = row.primaryPhone || row.phones?.[0] || ''
                    return (
                      <tr key={row.row} className={cn(row.excluded && 'opacity-70')}>
                        <td>
                          <input
                            type="checkbox"
                            checked={!row.excluded}
                            onChange={(e) => {
                              const checked = e.target.checked
                              setWorkingRows((prev) => {
                                const next = prev.map((r) => (r.row === row.row ? { ...r, excluded: !checked } : r))
                                return recomputeDedupeFlags(next)
                              })
                            }}
                          />
                        </td>
                        <td className="whitespace-nowrap">{row.row}</td>
                        <td className="whitespace-nowrap">{row.sourceRow}</td>
                        <td>
                          <input
                            className="input w-64"
                            value={row.displayName || ''}
                            onChange={(e) => {
                              const value = e.target.value
                              setWorkingRows((prev) =>
                                recomputeDedupeFlags(prev.map((r) => (r.row === row.row ? { ...r, displayName: value } : r)))
                              )
                            }}
                          />
                        </td>
                        <td>
                          <input
                            className="input w-64"
                            value={primaryEmail}
                            onChange={(e) => {
                              const value = e.target.value.trim().toLowerCase()
                              setWorkingRows((prev) =>
                                recomputeDedupeFlags(
                                  prev.map((r) => {
                                    if (r.row !== row.row) return r
                                    const emails = value ? Array.from(new Set([...(r.emails || []), value])) : r.emails
                                    return { ...r, primaryEmail: value || undefined, emails }
                                  })
                                )
                              )
                            }}
                          />
                        </td>
                        <td>
                          <input
                            className="input w-48"
                            value={primaryPhone}
                            onChange={(e) => {
                              const value = e.target.value.trim()
                              setWorkingRows((prev) =>
                                recomputeDedupeFlags(
                                  prev.map((r) => {
                                    if (r.row !== row.row) return r
                                    const phones = value ? Array.from(new Set([...(r.phones || []), value])) : r.phones
                                    return { ...r, primaryPhone: value || undefined, phones }
                                  })
                                )
                              )
                            }}
                          />
                        </td>
                        <td>
                          <input
                            className="input w-64"
                            value={row.companyName || ''}
                            onChange={(e) => {
                              const value = e.target.value
                              setWorkingRows((prev) =>
                                recomputeDedupeFlags(prev.map((r) => (r.row === row.row ? { ...r, companyName: value || undefined } : r)))
                              )
                            }}
                          />
                        </td>
                        <td className="whitespace-nowrap">{row.personType}</td>
                        <td className="muted">{(row.issues || []).join(' | ') || '-'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {workingRows.length > 200 && <div className="muted mt-2">Showing first 200 rows.</div>}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn secondary" onClick={() => setStep('map')} disabled={loading}>
              Back
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={runPreview}
              disabled={loading || blockingDupes.groups > 0 || reviewSummary.total === reviewSummary.excluded}
            >
              Preview import
            </button>
          </div>
        </div>
      )}

      {canView && step === 'preview' && (
        <div className="glass-card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2>4) Preview</h2>
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
                    <th>Display name</th>
                    <th>Primary email</th>
                    <th>Person type</th>
                    <th>Suggested</th>
                    <th>Action</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {confirmRows.slice(0, 200).map((row) => {
                    const p = previewByRow.get(row.row)
                    const primaryEmail = row.primaryEmail || row.emails?.[0] || ''
                    const canUpdate = !!p?.personId
                    const notes = [
                      ...(p?.errors || []).map((e) => `Error: ${e}`),
                      ...(p?.warnings || []).map((w) => `Warn: ${w}`),
                      ...(p?.matchBy ? [`Match: ${p.matchBy}`] : []),
                    ].join(' | ')
                    return (
                      <tr key={row.row} className={cn(row.action === 'skip' && 'opacity-70')}>
                        <td>{row.row}</td>
                        <td>{row.displayName || '-'}</td>
                        <td>{primaryEmail || '-'}</td>
                        <td>{row.personType}</td>
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
                            {canUpdate ? <option value="update">update</option> : null}
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
            <button type="button" className="btn secondary" onClick={() => setStep('review')} disabled={loading}>
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
          <h2>5) Done</h2>
          {confirmResult ? (
            <>
              <div className="muted">
                {confirmResult.created} created • {confirmResult.updated} updated • {confirmResult.skipped} skipped • {confirmResult.errors} errors
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
                setWorkingRows([])
                setPreview(null)
                setConfirmRows([])
                setConfirmResult(null)
                setMapping({})
                setShowAdvancedMapping(false)
                if (fileInputRef.current) fileInputRef.current.value = ''
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
