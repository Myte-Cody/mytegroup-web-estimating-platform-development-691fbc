'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, Suspense } from 'react'

// Create a client component that uses useSearchParams
function AuthContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pid = searchParams.get('projectId')
  
  useEffect(() => {
    // if (pid === process.env.NEXT_PUBLIC_PROJECT_ID) {
      router.replace(`/dashboard?projectId=${pid}`)
    // }
  }, [pid, router])
  
  return (
    <div className="flex items-center justify-center h-screen font-medium">
      You're not authorized to view this project
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
