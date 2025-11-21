'use client'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import { useEffect, Suspense } from 'react'

// Create a component that uses the hooks
function LayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const path = usePathname()
  const projectId = searchParams.get('projectId')
  const valid = projectId === process.env.NEXT_PUBLIC_PROJECT_ID

  useEffect(() => {
    // initial load: enforce auth via query param
    // if (!valid) {
      if (path === '/' || path === '/auth' || path === '/dashboard') {
        router.replace('/dashboard')
      }
    // }
  }, [valid, path, router])

  return children
}

// Root layout with Suspense boundary
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <Suspense fallback={<div>Loading...</div>}>
          <LayoutContent>{children}</LayoutContent>
        </Suspense>
      </body>
    </html>
  )
}
