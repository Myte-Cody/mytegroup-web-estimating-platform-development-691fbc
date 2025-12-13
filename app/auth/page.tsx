'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, Suspense } from 'react'

import { ApiError, apiFetch } from '../lib/api'

type SessionUser = {
  id?: string
  role?: string
  orgId?: string
}

const isSafeInternalPath = (value: string) => {
  if (!value.startsWith('/')) return false
  if (value.startsWith('//')) return false
  if (value.includes('://')) return false
  return true
}

function defaultLandingForUser(user?: SessionUser | null) {
  const role = (user?.role || '').toLowerCase()
  if (role === 'superadmin' || role === 'platform_admin') {
    return '/platform'
  }
  return '/dashboard'
}

function AuthContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const next = searchParams.get('next') || ''
  const projectId = searchParams.get('projectId')
  
  useEffect(() => {
    const route = async () => {
      try {
        const res = await apiFetch<{ user?: SessionUser }>('/auth/me')
        const user = res?.user || null
        if (!user?.id) {
          router.replace('/auth/login')
          return
        }

        if (next && isSafeInternalPath(next)) {
          router.replace(next)
          return
        }

        const dest = defaultLandingForUser(user)
        if (projectId && dest === '/dashboard') {
          router.replace(`/dashboard?projectId=${encodeURIComponent(projectId)}`)
          return
        }

        router.replace(dest)
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          router.replace('/auth/login')
          return
        }
        if (err instanceof ApiError && err.status === 403 && err.message?.includes('Legal acceptance required')) {
          router.replace('/legal')
          return
        }
        router.replace('/dashboard')
      }
    }

    route()
  }, [next, projectId, router])
  
  return (
    <div className="flex h-screen items-center justify-center font-medium text-[color:var(--text)]">
      Routing your session...
    </div>
  )
}

// Main page component with Suspense boundary
export default function AuthPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
      <AuthContent />
    </Suspense>
  )
}
