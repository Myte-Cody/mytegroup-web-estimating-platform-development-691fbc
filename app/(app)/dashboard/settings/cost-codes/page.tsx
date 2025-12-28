'use client'

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import Link from 'next/link'

import { ApiError, apiFetch } from '../../../../lib/api'
import { useLanguage } from '../../../../lib/i18n'
import { hasAnyRole } from '../../../../lib/rbac'
import { cn } from '../../../../lib/utils'
import { apiUrl } from '../../../../config/domain'

type SessionUser = {
  id?: string
  role?: string
  roles?: string[]
  orgId?: string
}

type Organization = {
  _id?: string
  id?: string
  name?: string
  archivedAt?: string | null
  piiStripped?: boolean
  legalHold?: boolean
}

type CostCode = {
  _id?: string
  id?: string
  orgId?: string
  category: string
  code: string
  description: string
  active: boolean
  isUsed?: boolean
  deactivatedAt?: string | null
  createdAt?: string
  updatedAt?: string
}

type CostCodePreview = {
  category: string
  code: string
  description: string
}

type CostCodeCounts = {
  total: number
  active: number
  inactive: number
  used?: number
}

type ImportStatus = {
  status: 'queued' | 'processing' | 'preview' | 'done' | 'failed'
  preview?: CostCodePreview[]
  errorMessage?: string
}

type ImportSummary = {
  inserted: number
  updated: number
  muted: number
}

type ImportIssue = {
  index: number
  field: 'code' | 'description' | 'duplicate'
  message: string
}

type BulkSummary = {
  upserted: number
  modified: number
}

type BulkIssue = {
  line: number
  message: string
}

const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL || apiUrl || 'http://localhost:3001').replace(/\/$/, '')
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
const MAX_UPLOAD_MB = 10

const formatDateTime = (value?: string | null, locale?: string) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(locale || undefined)
}

const postForm = async (path: string, data: FormData) => {
  const url = path.startsWith('http') ? path : `${apiBase}${path}`
  const res = await fetch(url, { method: 'POST', body: data, credentials: 'include' })
  let payload: any = null
  try {
    payload = await res.json()
  } catch {
    payload = null
  }
  if (!res.ok) {
    const message =
      payload?.message ||
      payload?.error ||
      `Request failed with status ${res.status}${res.statusText ? `: ${res.statusText}` : ''}`
    throw new ApiError(message, res.status, payload)
  }
  return payload
}

const detectDelimiter = (line: string) => {
  if (line.includes('\t')) return '\t'
  if (line.includes(';') && !line.includes(',')) return ';'
  return ','
}

const splitDelimitedLine = (line: string, delimiter: string) => {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (char === '"') {
      const next = line[i + 1]
      if (inQuotes && next === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (char === delimiter && !inQuotes) {
      result.push(current.trim())
      current = ''
      continue
    }
    current += char
  }
  result.push(current.trim())
  return result
}

export default function CostCodesPage() {
  const { t, language } = useLanguage()
  const [user, setUser] = useState<SessionUser | null>(null)
  const [org, setOrg] = useState<Organization | null>(null)
  const [codes, setCodes] = useState<CostCode[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [reloadAt, setReloadAt] = useState(0)

  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [updatedSince, setUpdatedSince] = useState('')
  const [counts, setCounts] = useState<CostCodeCounts | null>(null)

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [selectedCode, setSelectedCode] = useState<CostCode | null>(null)

  const [formCategory, setFormCategory] = useState('')
  const [formCode, setFormCode] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [importFile, setImportFile] = useState<File | null>(null)
  const [importJobId, setImportJobId] = useState<string | null>(null)
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null)
  const [importing, setImporting] = useState(false)
  const [importStep, setImportStep] = useState<'upload' | 'processing' | 'preview' | 'summary'>('upload')
  const [importPreview, setImportPreview] = useState<CostCodePreview[]>([])
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null)
  const [importResumed, setImportResumed] = useState(false)
  const [seedLoading, setSeedLoading] = useState(false)
  const [bulkInput, setBulkInput] = useState('')
  const [bulkSummary, setBulkSummary] = useState<BulkSummary | null>(null)
  const [bulkSubmitting, setBulkSubmitting] = useState(false)

  const canManage = useMemo(() => hasAnyRole(user, ['admin']), [user])
  const orgLegalHold = !!org?.legalHold
  const orgArchived = !!org?.archivedAt
  const actionDisabled = !canManage || orgLegalHold || orgArchived

  const refresh = () => setReloadAt(Date.now())

  const importStorageKey = useMemo(() => {
    if (!user?.orgId) return null
    return `myte-costcodes-import-${user.orgId}`
  }, [user?.orgId])

  const persistImportJob = useCallback(
    (jobId: string) => {
      if (typeof window === 'undefined' || !importStorageKey) return
      window.localStorage.setItem(importStorageKey, jobId)
    },
    [importStorageKey]
  )

  const clearPersistedImportJob = useCallback(() => {
    if (typeof window === 'undefined' || !importStorageKey) return
    window.localStorage.removeItem(importStorageKey)
  }, [importStorageKey])

  const resetImportState = useCallback(() => {
    setImportJobId(null)
    setImportStatus(null)
    setImportFile(null)
    setImportPreview([])
    setImportSummary(null)
    setImportStep('upload')
    setImportResumed(false)
    clearPersistedImportJob()
  }, [clearPersistedImportJob])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      setActionMessage(null)
      try {
        const me = await apiFetch<{ user?: SessionUser }>('/auth/me')
        const currentUser = me?.user || null
        setUser(currentUser)
        setOrg(null)
        setCodes([])
        setCounts(null)

        if (!currentUser?.id) {
          setError(t('costcodes.errors.signin'))
          return
        }
        if (!currentUser?.orgId) {
          setError(t('costcodes.errors.no_org'))
          return
        }
        if (!hasAnyRole(currentUser, ['admin'])) {
          setError(t('costcodes.errors.admin_required'))
          return
        }

        const qs = new URLSearchParams()
        qs.set('noPagination', 'true')
        if (search.trim()) qs.set('q', search.trim())
        if (selectedCategory.trim()) qs.set('category', selectedCategory.trim())
        if (activeFilter !== 'all') qs.set('active', activeFilter === 'active' ? 'true' : 'false')
        if (updatedSince) qs.set('updatedSince', updatedSince)

        const countsQs = new URLSearchParams()
        if (search.trim()) countsQs.set('q', search.trim())
        if (selectedCategory.trim()) countsQs.set('category', selectedCategory.trim())
        if (activeFilter !== 'all') countsQs.set('active', activeFilter === 'active' ? 'true' : 'false')
        if (updatedSince) countsQs.set('updatedSince', updatedSince)

        const [codesRes, orgRes, countsRes] = await Promise.allSettled([
          apiFetch<CostCode[] | { data: CostCode[] }>(`/cost-codes?${qs.toString()}`),
          apiFetch<Organization>(`/organizations/${currentUser.orgId}`),
          apiFetch<CostCodeCounts>(`/cost-codes/counts?${countsQs.toString()}`),
        ])

        if (codesRes.status === 'fulfilled') {
          const payload = codesRes.value
          const rows = Array.isArray(payload) ? payload : payload.data
          setCodes(Array.isArray(rows) ? rows : [])
        } else {
          throw codesRes.reason
        }

        if (orgRes.status === 'fulfilled') {
          setOrg(orgRes.value)
        }

        if (countsRes.status === 'fulfilled') {
          setCounts(countsRes.value)
        }
      } catch (err: any) {
        setError(err instanceof ApiError ? err.message : t('costcodes.errors.load_failed'))
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [reloadAt, search, selectedCategory, activeFilter, updatedSince, t])

  useEffect(() => {
    if (!showImportModal || importJobId || !importStorageKey) return
    if (typeof window === 'undefined') return
    const saved = window.localStorage.getItem(importStorageKey)
    if (!saved) return
    setImportJobId(saved)
    setImportStatus({ status: 'queued' })
    setImportStep('processing')
    setImportResumed(true)
  }, [showImportModal, importJobId, importStorageKey])

  const categories = useMemo(() => {
    const map = new Map<string, { total: number; active: number; used: number }>()
    codes.forEach((code) => {
      const key = code.category || 'General'
      if (!map.has(key)) map.set(key, { total: 0, active: 0, used: 0 })
      const bucket = map.get(key) as { total: number; active: number; used: number }
      bucket.total += 1
      if (code.active) bucket.active += 1
      if (code.isUsed) bucket.used += 1
    })
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [codes])

  const categoryOptions = useMemo(() => categories.map(([category]) => category), [categories])

  const totals = useMemo(() => {
    return codes.reduce(
      (acc, code) => {
        acc.total += 1
        if (code.active) acc.active += 1
        else acc.inactive += 1
        if (code.isUsed) acc.used += 1
        return acc
      },
      { total: 0, active: 0, inactive: 0, used: 0 }
    )
  }, [codes])

  const summary = useMemo(() => {
    return {
      total: counts?.total ?? totals.total,
      active: counts?.active ?? totals.active,
      inactive: counts?.inactive ?? totals.inactive,
      used: counts?.used ?? totals.used,
    }
  }, [counts, totals])

  const sortedCodes = useMemo(() => {
    return [...codes].sort((a, b) => (a.code || '').localeCompare(b.code || ''))
  }, [codes])

  const importIssues = useMemo(() => {
    const issues: ImportIssue[] = []
    const seen = new Map<string, number[]>()

    importPreview.forEach((row, index) => {
      const code = (row.code || '').trim()
      const description = (row.description || '').trim()

      if (!code) {
        issues.push({
          index,
          field: 'code',
          message: t('costcodes.import.validation.code_missing', { row: index + 1 }),
        })
      } else {
        const key = code.toLowerCase()
        const bucket = seen.get(key) || []
        bucket.push(index)
        seen.set(key, bucket)
      }

      if (!description) {
        issues.push({
          index,
          field: 'description',
          message: t('costcodes.import.validation.description_missing', { row: index + 1 }),
        })
      }
    })

    seen.forEach((indexes, key) => {
      if (indexes.length < 2) return
      indexes.forEach((idx) => {
        issues.push({
          index: idx,
          field: 'duplicate',
          message: t('costcodes.import.validation.duplicate', {
            row: idx + 1,
            code: importPreview[idx]?.code || key,
          }),
        })
      })
    })

    return issues
  }, [importPreview, t])

  const importWarnings = useMemo(() => {
    const warnings: string[] = []
    if (importPreview.some((row) => !(row.category || '').trim())) {
      warnings.push(t('costcodes.import.warning.category_default'))
    }
    return warnings
  }, [importPreview, t])

  const importIssuesByRow = useMemo(() => {
    const map = new Map<number, ImportIssue[]>()
    importIssues.forEach((issue) => {
      const bucket = map.get(issue.index) || []
      bucket.push(issue)
      map.set(issue.index, bucket)
    })
    return map
  }, [importIssues])

  const hasBlockingImportIssues = importIssues.length > 0

  const bulkParsed = useMemo(() => {
    const issues: BulkIssue[] = []
    const rows: CostCodePreview[] = []
    const rawLines = bulkInput
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)

    if (!rawLines.length) {
      return { rows, issues, total: 0, valid: 0 }
    }

    const firstDelimiter = detectDelimiter(rawLines[0])
    const firstCells = splitDelimitedLine(rawLines[0], firstDelimiter).map((cell) => cell.toLowerCase())
    const isHeader =
      firstCells.includes('code') ||
      (firstCells.includes('category') && firstCells.includes('description'))

    const seen = new Set<string>()
    const startIndex = isHeader ? 1 : 0

    for (let i = startIndex; i < rawLines.length; i += 1) {
      const line = rawLines[i]
      const delimiter = detectDelimiter(line)
      const cells = splitDelimitedLine(line, delimiter)
      const lineNumber = i + 1

      let category = ''
      let code = ''
      let description = ''

      if (cells.length >= 3) {
        ;[category, code, description] = cells
      } else if (cells.length === 2) {
        ;[code, description] = cells
      } else {
        issues.push({ line: lineNumber, message: t('costcodes.bulk.validation.missing_fields', { line: lineNumber }) })
        rows.push({ category: category || '', code: code || '', description: description || '' })
        continue
      }

      const normalizedCode = (code || '').trim()
      const normalizedDescription = (description || '').trim()
      const normalizedCategory = (category || '').trim()

      if (!normalizedCode || !normalizedDescription) {
        issues.push({ line: lineNumber, message: t('costcodes.bulk.validation.missing_fields', { line: lineNumber }) })
      } else if (seen.has(normalizedCode.toLowerCase())) {
        issues.push({
          line: lineNumber,
          message: t('costcodes.bulk.validation.duplicate', { line: lineNumber, code: normalizedCode }),
        })
      }

      if (normalizedCode) {
        seen.add(normalizedCode.toLowerCase())
      }

      rows.push({ category: normalizedCategory, code: normalizedCode, description: normalizedDescription })
    }

    const valid = rows.filter((row) => row.code && row.description).length
    return { rows, issues, total: rows.length, valid }
  }, [bulkInput, t])

  const bulkHasErrors = bulkParsed.issues.length > 0

  const openCreateModal = () => {
    setFormCategory('')
    setFormCode('')
    setFormDescription('')
    setSelectedCode(null)
    setShowCreateModal(true)
  }

  const openEditModal = (code: CostCode) => {
    setSelectedCode(code)
    setFormCategory(code.category || '')
    setFormCode(code.code || '')
    setFormDescription(code.description || '')
    setShowEditModal(true)
  }

  const openImportModal = () => {
    setError(null)
    setShowImportModal(true)
    if (!importJobId) {
      setImportStep('upload')
      setImportResumed(false)
    }
  }

  const openBulkModal = () => {
    setError(null)
    setBulkSummary(null)
    setShowBulkModal(true)
  }

  const closeBulkModal = () => {
    setShowBulkModal(false)
    setBulkSubmitting(false)
    setBulkSummary(null)
    setBulkInput('')
  }

  const closeModals = () => {
    setShowCreateModal(false)
    setShowEditModal(false)
    setSelectedCode(null)
    setSubmitting(false)
  }

  const updateImportRow = useCallback((index: number, patch: Partial<CostCodePreview>) => {
    setImportPreview((prev) =>
      prev.map((row, idx) => (idx === index ? { ...row, ...patch } : row))
    )
  }, [])

  const addImportRow = useCallback(() => {
    setImportPreview((prev) => [...prev, { category: '', code: '', description: '' }])
  }, [])

  const removeImportRow = useCallback((index: number) => {
    setImportPreview((prev) => prev.filter((_, idx) => idx !== index))
  }, [])

  const handleCreate = async () => {
    if (actionDisabled) return
    setSubmitting(true)
    setError(null)
    setActionMessage(null)
    try {
      await apiFetch('/cost-codes', {
        method: 'POST',
        body: JSON.stringify({
          category: formCategory.trim(),
          code: formCode.trim(),
          description: formDescription.trim(),
        }),
      })
      setActionMessage(t('costcodes.messages.created'))
      closeModals()
      refresh()
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : t('costcodes.errors.create_failed'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdate = async () => {
    if (!selectedCode) return
    const id = selectedCode.id || selectedCode._id
    if (!id) return
    setSubmitting(true)
    setError(null)
    setActionMessage(null)
    try {
      await apiFetch(`/cost-codes/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          category: formCategory.trim(),
          code: formCode.trim(),
          description: formDescription.trim(),
        }),
      })
      setActionMessage(t('costcodes.messages.updated'))
      closeModals()
      refresh()
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : t('costcodes.errors.update_failed'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggle = async (code: CostCode) => {
    const id = code.id || code._id
    if (!id || actionDisabled) return
    setError(null)
    setActionMessage(null)
    try {
      await apiFetch(`/cost-codes/${id}/active`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !code.active }),
      })
      setActionMessage(code.active ? t('costcodes.messages.deactivated') : t('costcodes.messages.activated'))
      refresh()
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : t('costcodes.errors.status_failed'))
    }
  }

  const handleDelete = async (code: CostCode) => {
    const id = code.id || code._id
    if (!id || actionDisabled) return
    const label = t('costcodes.confirm.delete', { code: code.code || '' })
    if (!window.confirm(label)) return
    setError(null)
    setActionMessage(null)
    try {
      await apiFetch(`/cost-codes/${id}`, { method: 'DELETE' })
      setActionMessage(t('costcodes.messages.deleted'))
      refresh()
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : t('costcodes.errors.delete_failed'))
    }
  }

  const handleImportFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      setImportFile(null)
      return
    }

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!ext || (ext !== 'xlsx' && ext !== 'xls')) {
      setError(t('costcodes.import.file_error_type'))
      setImportFile(null)
      event.target.value = ''
      return
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      setError(t('costcodes.import.file_error_size', { size: MAX_UPLOAD_MB }))
      setImportFile(null)
      event.target.value = ''
      return
    }

    setError(null)
    setImportFile(file)
  }

  const handleStartImport = async () => {
    if (!importFile || actionDisabled) return
    setImporting(true)
    setError(null)
    setActionMessage(null)
    setImportResumed(false)
    setImportPreview([])
    setImportSummary(null)
    try {
      const data = new FormData()
      data.append('file', importFile)
      const res = await postForm('/cost-codes/import', data)
      const jobId = res?.jobId as string
      setImportJobId(jobId)
      setImportStatus({ status: 'queued' })
      setImportStep('processing')
      persistImportJob(jobId)
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : t('costcodes.errors.import_start_failed'))
    } finally {
      setImporting(false)
    }
  }

  useEffect(() => {
    if (!importJobId || !showImportModal) return
    let cancelled = false

    const poll = async () => {
      try {
        const status = await apiFetch<ImportStatus>(`/cost-codes/import/${importJobId}`)
        if (cancelled) return
        setImportStatus(status)
        if (status.status === 'preview') {
          setImportStep('preview')
          if (!importPreview.length || importResumed) {
            setImportPreview(status.preview || [])
          }
          setImportResumed(false)
          return
        }
        if (status.status === 'failed') {
          setError(status.errorMessage || t('costcodes.import.failed_message'))
          resetImportState()
          return
        }
        if (status.status === 'done') {
          setImportStep('summary')
          return
        }
        setImportStep('processing')
        setTimeout(poll, 1500)
      } catch (err: any) {
        if (cancelled) return
        setImportStatus({
          status: 'failed',
          errorMessage: err instanceof ApiError ? err.message : t('costcodes.import.failed_message'),
        })
        setImportStep('upload')
      }
    }

    poll()
    return () => {
      cancelled = true
    }
  }, [importJobId, showImportModal, t, importPreview.length, importResumed, resetImportState])

  const handleCommitImport = async () => {
    if (!importJobId || actionDisabled) return
    if (hasBlockingImportIssues) return
    setImporting(true)
    setError(null)
    setActionMessage(null)
    try {
      const codes = importPreview
        .map((row) => ({
          category: (row.category || '').trim() || 'General',
          code: (row.code || '').trim(),
          description: (row.description || '').trim(),
        }))
        .filter((row) => row.code && row.description)

      const summary = await apiFetch<ImportSummary>(`/cost-codes/import/${importJobId}/commit`, {
        method: 'POST',
        body: JSON.stringify({ codes }),
      })

      setImportSummary(summary)
      setImportStatus({ status: 'done' })
      setImportStep('summary')
      setActionMessage(t('costcodes.messages.import_committed'))
      clearPersistedImportJob()
      refresh()
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : t('costcodes.errors.import_commit_failed'))
    } finally {
      setImporting(false)
    }
  }

  const closeImportModal = () => {
    setShowImportModal(false)
    if (importStep === 'summary' || importStatus?.status === 'failed') {
      resetImportState()
    }
  }

  const handleDownloadTemplate = async () => {
    setError(null)
    try {
      const res = await fetch(`${apiBase}/cost-codes/template`, { credentials: 'include' })
      if (!res.ok) {
        throw new ApiError(
          `Request failed with status ${res.status}${res.statusText ? `: ${res.statusText}` : ''}`,
          res.status
        )
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'cost-codes-template.xlsx'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : t('costcodes.import.template_failed'))
    }
  }

  const handleSeedPack = async () => {
    if (actionDisabled) return
    const confirmed = window.confirm(t('costcodes.confirm.seed'))
    if (!confirmed) return
    setSeedLoading(true)
    setError(null)
    setActionMessage(null)
    try {
      await apiFetch('/cost-codes/seed', { method: 'POST', body: JSON.stringify({ replace: true }) })
      setActionMessage(t('costcodes.messages.seeded'))
      resetImportState()
      setShowImportModal(false)
      refresh()
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : t('costcodes.errors.seed_failed'))
    } finally {
      setSeedLoading(false)
    }
  }

  const handleBulkUpsert = async () => {
    if (actionDisabled || bulkSubmitting) return
    if (bulkHasErrors || bulkParsed.valid === 0) {
      setError(t('costcodes.bulk.validation.blocked'))
      return
    }
    setBulkSubmitting(true)
    setError(null)
    setActionMessage(null)
    try {
      const codes = bulkParsed.rows
        .map((row) => ({
          category: (row.category || '').trim() || 'General',
          code: (row.code || '').trim(),
          description: (row.description || '').trim(),
        }))
        .filter((row) => row.code && row.description)

      const result = await apiFetch<BulkSummary>('/cost-codes/bulk', {
        method: 'POST',
        body: JSON.stringify({ codes }),
      })
      setBulkSummary(result)
      setActionMessage(
        t('costcodes.bulk.messages.applied', {
          upserted: result.upserted,
          modified: result.modified,
        })
      )
      refresh()
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : t('costcodes.bulk.errors.failed'))
    } finally {
      setBulkSubmitting(false)
    }
  }

  const importStatusLabel = importStatus?.status ? t(`costcodes.import.status.${importStatus.status}`) : ''

  return (
    <section className="cost-codes-shell">
      <div className="surface-card space-y-4">
        <div className="cost-hero">
          <div className="cost-hero-main space-y-2">
            <div className="eyebrow">{t('costcodes.eyebrow')}</div>
            <h1>{t('costcodes.title')}</h1>
            <p className="subtitle">{t('costcodes.subtitle')}</p>
          </div>

          <div className="cost-hero-actions">
            <button type="button" className="btn secondary" onClick={refresh} disabled={loading}>
              {loading ? t('costcodes.actions.loading') : t('costcodes.actions.refresh')}
            </button>
            <button type="button" className="btn secondary" onClick={openCreateModal} disabled={actionDisabled}>
              {t('costcodes.actions.new')}
            </button>
            <button type="button" className="btn secondary" onClick={openBulkModal} disabled={actionDisabled}>
              {t('costcodes.actions.bulk_upsert')}
            </button>
            <button type="button" className="btn primary" onClick={openImportModal} disabled={actionDisabled}>
              {t('costcodes.actions.import')}
            </button>
          </div>
        </div>

        {actionMessage && <div className="feedback success">{actionMessage}</div>}
        {error && <div className={cn('feedback error')}>{error}</div>}
        {orgLegalHold && <div className="feedback subtle">{t('costcodes.notice.legal_hold')}</div>}
        {orgArchived && <div className="feedback subtle">{t('costcodes.notice.archived')}</div>}
      </div>

      {canManage && (
        <div className="surface-card tight">
            <div className="stat-strip">
              <div className="stat-item">
                <div className="stat-strip-label">{t('costcodes.stats.total')}</div>
                <div className="stat-strip-value">{summary.total}</div>
              </div>
              <div className="stat-item">
                <div className="stat-strip-label">{t('costcodes.stats.active')}</div>
                <div className="stat-strip-value">{summary.active}</div>
              </div>
              <div className="stat-item">
                <div className="stat-strip-label">{t('costcodes.stats.inactive')}</div>
                <div className="stat-strip-value">{summary.inactive}</div>
              </div>
              <div className="stat-item">
                <div className="stat-strip-label">{t('costcodes.stats.used')}</div>
                <div className="stat-strip-value">{summary.used}</div>
              </div>
            </div>
          </div>
      )}

      <div className="surface-card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2>{t('costcodes.filters.title')}</h2>
          {(selectedCategory || updatedSince) && (
            <button
              type="button"
              className="btn secondary"
              onClick={() => {
                setSelectedCategory('')
                setUpdatedSince('')
              }}
            >
              {t('costcodes.filters.clear')}
            </button>
          )}
        </div>

        <div className="filter-row">
          <label className="filter-field">
            <span>{t('costcodes.filters.search')}</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('costcodes.filters.search_placeholder')}
            />
          </label>
          <label className="filter-field">
            <span>{t('costcodes.filters.status')}</span>
            <select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value as any)}>
              <option value="all">{t('costcodes.filters.all')}</option>
              <option value="active">{t('costcodes.filters.active')}</option>
              <option value="inactive">{t('costcodes.filters.inactive')}</option>
            </select>
          </label>
          <label className="filter-field">
            <span>{t('costcodes.filters.category')}</span>
            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
              <option value="">{t('costcodes.filters.all')}</option>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-field">
            <span>{t('costcodes.filters.updated_since')}</span>
            <input
              type="datetime-local"
              value={updatedSince}
              onChange={(e) => setUpdatedSince(e.target.value)}
            />
          </label>
        </div>

        {categories.length > 0 && (
          <div className="chip-row">
            <button
              type="button"
              className={cn('chip', !selectedCategory && 'active')}
              onClick={() => setSelectedCategory('')}
            >
              {t('costcodes.filters.all')}
            </button>
            {categories.map(([category, data]) => (
              <button
                key={category}
                type="button"
                className={cn('chip', selectedCategory === category && 'active')}
                onClick={() => setSelectedCategory(category)}
              >
                <span className="font-semibold">{category}</span>
                <span className="ml-2 text-xs text-[color:var(--muted)]">({data.total})</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {canManage && (
        <div className="surface-card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2>{t('costcodes.directory.title')}</h2>
              <div className="muted">{t('costcodes.directory.count', { count: sortedCodes.length })}</div>
            </div>
          </div>

          {sortedCodes.length === 0 ? (
            <div className="muted">{t('costcodes.empty')}</div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t('costcodes.table.code')}</th>
                      <th>{t('costcodes.table.description')}</th>
                      <th>{t('costcodes.table.category')}</th>
                      <th>{t('costcodes.table.status')}</th>
                      <th>{t('costcodes.table.used')}</th>
                      <th>{t('costcodes.table.updated')}</th>
                      <th className="text-right">{t('costcodes.table.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedCodes.map((code) => {
                      const id = code.id || code._id || code.code
                      return (
                        <tr key={id} className={cn(!code.active && 'opacity-70')}>
                          <td className="font-semibold">{code.code}</td>
                          <td>{code.description}</td>
                          <td>{code.category}</td>
                          <td>{code.active ? t('costcodes.status.active') : t('costcodes.status.inactive')}</td>
                          <td>{code.isUsed ? t('costcodes.used') : t('costcodes.not_used')}</td>
                          <td>{formatDateTime(code.updatedAt, language)}</td>
                          <td className="text-right">
                            <div className="table-actions">
                              <button type="button" className="btn secondary" onClick={() => openEditModal(code)} disabled={actionDisabled}>
                                {t('costcodes.actions.edit')}
                              </button>
                              <button type="button" className="btn secondary" onClick={() => handleToggle(code)} disabled={actionDisabled}>
                                {code.active ? t('costcodes.actions.deactivate') : t('costcodes.actions.activate')}
                              </button>
                              <button type="button" className="btn secondary" onClick={() => handleDelete(code)} disabled={actionDisabled}>
                                {t('costcodes.actions.delete')}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-3 md:hidden">
                {sortedCodes.map((code) => {
                  const id = code.id || code._id || code.code
                  return (
                    <div key={id} className={cn('code-card', !code.active && 'opacity-80')}>
                      <div className="code-card-header">
                        <div className="font-semibold">{code.code}</div>
                        <span className="code-pill">
                          {code.active ? t('costcodes.status.active') : t('costcodes.status.inactive')}
                        </span>
                      </div>
                      <div>{code.description}</div>
                      <div className="code-meta">
                        <span>{code.category}</span>
                        <span>{code.isUsed ? t('costcodes.used') : t('costcodes.not_used')}</span>
                        <span>{formatDateTime(code.updatedAt, language)}</span>
                      </div>
                      <div className="table-actions">
                        <button type="button" className="btn secondary" onClick={() => openEditModal(code)} disabled={actionDisabled}>
                          {t('costcodes.actions.edit')}
                        </button>
                        <button type="button" className="btn secondary" onClick={() => handleToggle(code)} disabled={actionDisabled}>
                          {code.active ? t('costcodes.actions.deactivate') : t('costcodes.actions.activate')}
                        </button>
                        <button type="button" className="btn secondary" onClick={() => handleDelete(code)} disabled={actionDisabled}>
                          {t('costcodes.actions.delete')}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}

      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="modal-shell space-y-4">
            <div className="space-y-1">
              <div className="text-lg font-semibold">
                {showEditModal ? t('costcodes.modal.edit_title') : t('costcodes.modal.create_title')}
              </div>
              <div className="text-sm text-muted-foreground">{t('costcodes.modal.subtitle')}</div>
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-medium">
                {t('costcodes.field.category')} <span className="text-red-400">*</span>
                <input
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  placeholder={t('costcodes.placeholder.category')}
                  disabled={submitting}
                />
              </label>
              <label className="block text-sm font-medium">
                {t('costcodes.field.code')} <span className="text-red-400">*</span>
                <input
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  placeholder={t('costcodes.placeholder.code')}
                  disabled={submitting}
                />
              </label>
              <label className="block text-sm font-medium">
                {t('costcodes.field.description')} <span className="text-red-400">*</span>
                <textarea
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder={t('costcodes.placeholder.description')}
                  rows={3}
                  disabled={submitting}
                />
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" className="btn secondary" onClick={closeModals} disabled={submitting}>
                {t('costcodes.modal.cancel')}
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={showEditModal ? handleUpdate : handleCreate}
                disabled={submitting || !formCategory.trim() || !formCode.trim() || !formDescription.trim()}
              >
                {submitting ? t('costcodes.modal.saving') : showEditModal ? t('costcodes.modal.save') : t('costcodes.modal.create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showBulkModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="modal-shell space-y-4">
            <div className="space-y-1">
              <div className="text-lg font-semibold">{t('costcodes.bulk.title')}</div>
              <div className="text-sm text-muted-foreground">{t('costcodes.bulk.subtitle')}</div>
            </div>

            {bulkHasErrors && (
              <div className="feedback error">
                <div className="font-semibold">{t('costcodes.bulk.validation.title')}</div>
                <div className="text-xs mt-1">{t('costcodes.bulk.validation.summary', { count: bulkParsed.issues.length })}</div>
                <div className="text-xs mt-2 space-y-1">
                  {bulkParsed.issues.slice(0, 6).map((issue, idx) => (
                    <div key={`${issue.line}-${idx}`}>{issue.message}</div>
                  ))}
                  {bulkParsed.issues.length > 6 && (
                    <div className="muted text-xs">{t('costcodes.bulk.validation.more', { count: bulkParsed.issues.length - 6 })}</div>
                  )}
                </div>
              </div>
            )}

            <label className="block text-sm font-medium">
              {t('costcodes.bulk.input_label')}
              <textarea
                className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                rows={7}
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                placeholder={t('costcodes.bulk.placeholder')}
                disabled={bulkSubmitting}
              />
            </label>

            <div className="stat-strip">
              <div className="stat-item">
                <div className="stat-strip-label">{t('costcodes.bulk.metrics.total')}</div>
                <div className="stat-strip-value">{bulkParsed.total}</div>
              </div>
              <div className="stat-item">
                <div className="stat-strip-label">{t('costcodes.bulk.metrics.valid')}</div>
                <div className="stat-strip-value">{bulkParsed.valid}</div>
              </div>
            </div>

            <div className="modal-panel space-y-2">
              <div className="text-sm font-semibold">{t('costcodes.bulk.preview_title')}</div>
              {bulkParsed.rows.length === 0 ? (
                <div className="muted text-sm">{t('costcodes.bulk.preview_empty')}</div>
              ) : (
                <div className="max-h-56 overflow-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{t('costcodes.table.category')}</th>
                        <th>{t('costcodes.table.code')}</th>
                        <th>{t('costcodes.table.description')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkParsed.rows.slice(0, 12).map((row, idx) => (
                        <tr key={`${row.code || 'row'}-${idx}`}>
                          <td>{row.category || t('costcodes.bulk.preview_default')}</td>
                          <td>{row.code || '-'}</td>
                          <td>{row.description || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {bulkSummary && (
              <div className="modal-panel space-y-2">
                <div className="text-sm font-semibold">{t('costcodes.bulk.summary.title')}</div>
                <div className="stat-strip">
                  <div className="stat-item">
                    <div className="stat-strip-label">{t('costcodes.bulk.summary.upserted')}</div>
                    <div className="stat-strip-value">{bulkSummary.upserted}</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-strip-label">{t('costcodes.bulk.summary.modified')}</div>
                    <div className="stat-strip-value">{bulkSummary.modified}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="modal-actions">
              <button type="button" className="btn secondary" onClick={closeBulkModal} disabled={bulkSubmitting}>
                {t('costcodes.bulk.close')}
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={handleBulkUpsert}
                disabled={actionDisabled || bulkSubmitting || bulkParsed.total === 0 || bulkHasErrors}
              >
                {bulkSubmitting ? t('costcodes.bulk.applying') : t('costcodes.bulk.apply')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="modal-shell space-y-4">
            <div className="space-y-1">
              <div className="text-lg font-semibold">{t('costcodes.import.title')}</div>
              <div className="text-sm text-muted-foreground">{t('costcodes.import.subtitle')}</div>
            </div>

            <div className="import-stepper">
              {(['upload', 'processing', 'preview', 'summary'] as const).map((step) => {
                const order = ['upload', 'processing', 'preview', 'summary']
                const active = importStep === step
                const completed = order.indexOf(step) < order.indexOf(importStep)
                return (
                  <span key={step} className={cn('import-step', active && 'active', completed && 'completed')}>
                    {t(`costcodes.import.step.${step}`)}
                  </span>
                )
              })}
            </div>

            {importResumed && <div className="feedback subtle">{t('costcodes.import.resume_notice')}</div>}
            {error && <div className="feedback error">{error}</div>}

            {importStep === 'upload' && (
              <div className="modal-grid md:grid-cols-2">
                <div className="modal-panel space-y-3">
                  <div>
                    <div className="text-sm font-semibold">{t('costcodes.import.upload_label')}</div>
                    <div className="text-xs text-muted-foreground">{t('costcodes.import.upload_hint')}</div>
                  </div>
                  <input type="file" accept=".xlsx,.xls" onChange={handleImportFileChange} disabled={importing} />

                  <div className="text-xs text-muted-foreground">{t('costcodes.import.template_hint')}</div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={handleDownloadTemplate}
                      disabled={importing || actionDisabled}
                    >
                      {t('costcodes.import.template')}
                    </button>
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={handleSeedPack}
                      disabled={seedLoading || actionDisabled}
                    >
                      {seedLoading ? t('costcodes.actions.seeding') : t('costcodes.actions.seed')}
                    </button>
                  </div>

                  <button type="button" className="btn primary" onClick={handleStartImport} disabled={!importFile || importing || actionDisabled}>
                    {importing ? t('costcodes.import.starting') : t('costcodes.import.start')}
                  </button>

                  <div className="text-xs text-muted-foreground">{t('costcodes.import.replacement_note')}</div>
                </div>

                <div className="modal-panel space-y-3">
                  <div className="text-sm font-semibold">{t('costcodes.import.preview_title')}</div>
                  <div className="muted text-sm">{t('costcodes.import.preview_empty')}</div>
                  <div className="text-xs text-muted-foreground">{t('costcodes.import.help')}</div>
                </div>
              </div>
            )}

            {importStep === 'processing' && (
              <div className="modal-panel space-y-3">
                <div className="text-sm font-semibold">
                  {t('costcodes.import.status_label')}: {importStatusLabel || t('costcodes.import.status.processing')}
                </div>
                <div className="muted text-sm">{t('costcodes.import.processing_note')}</div>
                {importStatus?.errorMessage && <div className="feedback error">{importStatus.errorMessage}</div>}
              </div>
            )}

            {importStep === 'preview' && (
              <div className="space-y-4">
                <div className="modal-panel space-y-2">
                  <div className="text-sm font-semibold">{t('costcodes.import.review_title')}</div>
                  <div className="muted text-sm">{t('costcodes.import.review_hint')}</div>
                  <div className="muted text-sm">{t('costcodes.import.preview_count', { count: importPreview.length })}</div>
                </div>

                {hasBlockingImportIssues && (
                  <div className="feedback error">
                    <div className="font-semibold">{t('costcodes.import.validation.title')}</div>
                    <div className="text-xs mt-1">{t('costcodes.import.validation.summary', { count: importIssues.length })}</div>
                    <div className="text-xs mt-2 space-y-1">
                      {importIssues.slice(0, 6).map((issue, idx) => (
                        <div key={`${issue.index}-${issue.field}-${idx}`}>{issue.message}</div>
                      ))}
                      {importIssues.length > 6 && (
                        <div className="muted text-xs">{t('costcodes.import.validation.more', { count: importIssues.length - 6 })}</div>
                      )}
                    </div>
                  </div>
                )}

                {importWarnings.length > 0 && (
                  <div className="feedback subtle">
                    <div className="font-semibold">{t('costcodes.import.warning.title')}</div>
                    <div className="text-xs mt-1 space-y-1">
                      {importWarnings.map((warning, idx) => (
                        <div key={`${warning}-${idx}`}>{warning}</div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="modal-panel max-h-80 overflow-auto">
                  {importPreview.length === 0 ? (
                    <div className="muted text-sm">{t('costcodes.import.empty_preview')}</div>
                  ) : (
                    <table className="data-table import-preview-table">
                      <thead>
                        <tr>
                          <th>{t('costcodes.table.category')}</th>
                          <th>{t('costcodes.table.code')}</th>
                          <th>{t('costcodes.table.description')}</th>
                          <th className="text-right">{t('costcodes.table.actions')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.map((code, idx) => {
                          const rowIssues = importIssuesByRow.get(idx) || []
                          const codeError = rowIssues.some((issue) => issue.field === 'code' || issue.field === 'duplicate')
                          const descError = rowIssues.some((issue) => issue.field === 'description')
                          return (
                            <tr key={`${code.code || 'row'}-${idx}`} className={cn(rowIssues.length > 0 && 'row-error')}>
                              <td>
                                <input
                                  className="table-input"
                                  value={code.category || ''}
                                  onChange={(event) => updateImportRow(idx, { category: event.target.value })}
                                  placeholder={t('costcodes.placeholder.category')}
                                />
                              </td>
                              <td>
                                <input
                                  className={cn('table-input', codeError && 'error')}
                                  value={code.code || ''}
                                  onChange={(event) => updateImportRow(idx, { code: event.target.value })}
                                  placeholder={t('costcodes.placeholder.code')}
                                />
                              </td>
                              <td>
                                <input
                                  className={cn('table-input', descError && 'error')}
                                  value={code.description || ''}
                                  onChange={(event) => updateImportRow(idx, { description: event.target.value })}
                                  placeholder={t('costcodes.placeholder.description')}
                                />
                              </td>
                              <td className="text-right">
                                <button type="button" className="btn secondary" onClick={() => removeImportRow(idx)}>
                                  {t('costcodes.import.remove_row')}
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn secondary" onClick={addImportRow}>
                    {t('costcodes.import.add_row')}
                  </button>
                </div>
              </div>
            )}

            {importStep === 'summary' && (
              <div className="modal-panel space-y-3">
                <div className="text-sm font-semibold">{t('costcodes.import.summary.title')}</div>
                {importSummary ? (
                  <div className="stat-strip">
                    <div className="stat-item">
                      <div className="stat-strip-label">{t('costcodes.import.summary.inserted')}</div>
                      <div className="stat-strip-value">{importSummary.inserted}</div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-strip-label">{t('costcodes.import.summary.updated')}</div>
                      <div className="stat-strip-value">{importSummary.updated}</div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-strip-label">{t('costcodes.import.summary.muted')}</div>
                      <div className="stat-strip-value">{importSummary.muted}</div>
                    </div>
                  </div>
                ) : (
                  <div className="muted text-sm">{t('costcodes.import.summary.empty')}</div>
                )}
              </div>
            )}

            <div className="modal-actions">
              <button type="button" className="btn secondary" onClick={closeImportModal} disabled={importing}>
                {t('costcodes.import.close')}
              </button>
              {importStep === 'preview' && (
                <button
                  type="button"
                  className="btn primary"
                  onClick={handleCommitImport}
                  disabled={importing || actionDisabled || hasBlockingImportIssues || importPreview.length === 0}
                >
                  {importing ? t('costcodes.import.committing') : t('costcodes.import.commit')}
                </button>
              )}
              {importStep === 'summary' && (
                <button type="button" className="btn primary" onClick={closeImportModal}>
                  {t('costcodes.import.done')}
                </button>
              )}
            </div>

            <div className="text-xs text-muted-foreground">
              {t('costcodes.import.seed_hint')}
              <Link href="/dashboard/settings" className="ml-1 underline">
                {t('costcodes.import.back')}
              </Link>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
