'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import AuthShell from '../components/AuthShell'
import { ApiError, apiFetch, labelForLegalType } from '../lib/api'

type LegalDoc = {
  type: string
  version: string
  content: string
}

type Status = {
  required: string[]
}

const placeholderText: Record<string, string> = {
  privacy_policy:
    'Privacy Policy placeholder: describe how we collect, use, store, and protect data; include contact details and data subject rights.',
  terms:
    'Terms & Conditions placeholder: outline acceptable use, account responsibilities, payment terms (if any), and liability/indemnity language.',
}

export default function LegalAcceptancePage() {
  const router = useRouter()
  const [required, setRequired] = useState<string[]>([])
  const [docs, setDocs] = useState<Record<string, LegalDoc>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [accepting, setAccepting] = useState<string | null>(null)

  const loadStatus = async () => {
    setLoading(true)
    setError(null)
    try {
      const status = await apiFetch<Status>('/legal/acceptance/status')
      const pending = status?.required || []
      setRequired(pending)
      if (!pending.length) {
        router.replace('/dashboard')
        return
      }
      await loadDocs(pending)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace('/auth/login')
        return
      }
      const message = err instanceof ApiError ? err.message : 'Unable to fetch legal requirements right now.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const loadDocs = async (types: string[]) => {
    const nextDocs: Record<string, LegalDoc> = {}
    for (const type of types) {
      try {
        const doc = await apiFetch<LegalDoc>(`/legal/${type}`)
        nextDocs[type] = doc
      } catch (err) {
        nextDocs[type] = {
          type,
          version: 'v1',
          content: placeholderText[type] || 'Legal content placeholder.',
        }
      }
    }
    setDocs(nextDocs)
  }

  useEffect(() => {
    loadStatus()
  }, [])

  const handleAccept = async (type: string) => {
    const doc = docs[type]
    setAccepting(type)
    setError(null)
    try {
      await apiFetch('/legal/accept', {
        method: 'POST',
        body: JSON.stringify({ docType: type, version: doc?.version || 'v1' }),
      })
      await loadStatus()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Unable to record acceptance. Please retry.'
      setError(message)
    } finally {
      setAccepting(null)
    }
  }

  const pendingDocs = useMemo(() => required.map((type) => docs[type]).filter(Boolean) as LegalDoc[], [required, docs])

  return (
    <AuthShell
      title="Review & accept legal documents"
      subtitle="Please review the latest Privacy Policy and Terms before continuing. Your acceptance is recorded with your session."
      badge="Compliance hold"
    >
      <div className="legal-stack">
        {loading && <div className="feedback subtle">Loading requirements...</div>}
        {error && <div className="feedback error">{error}</div>}
        {!loading && !required.length && <div className="feedback success">You are all set. Redirecting...</div>}
        {pendingDocs.map((doc) => (
          <article key={doc.type} className="legal-card">
            <div className="legal-header">
              <div>
                <div className="legal-label">{labelForLegalType[doc.type] || doc.type}</div>
                <div className="muted">Version: {doc.version || 'Latest'}</div>
              </div>
              <button
                className="btn primary"
                type="button"
                onClick={() => handleAccept(doc.type)}
                disabled={accepting === doc.type}
              >
                {accepting === doc.type ? 'Recording...' : 'Accept'}
              </button>
            </div>
            <div className="legal-body">
              <p>{doc.content}</p>
            </div>
          </article>
        ))}
        <div className="form-links">
          <Link href="/auth/login">Back to sign in</Link>
          <Link href="/auth/register">Create account</Link>
        </div>
      </div>
    </AuthShell>
  )
}
