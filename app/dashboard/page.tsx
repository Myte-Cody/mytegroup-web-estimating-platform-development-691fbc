'use client'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import '../../app/globals.css'

export default function DashboardPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const path = usePathname()
  // const pid = searchParams.get('projectId')
  // const valid = pid === process.env.NEXT_PUBLIC_PROJECT_ID

  // useEffect(() => {
  //   // direct access guard
  //   if (!valid) {
  //     router.replace(`/auth`)
  //   }
  // }, [])

  // if (!valid) return null
  return (
    <div className="container mx-auto p-6">
      <h1>Dashboard</h1>
      <p className="text-gray-600">
        Welcome to your dashboard. This is a starting point for your application.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-2">Card Title 1</h2>
          <p className="text-gray-600">Card content goes here.</p>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-2">Card Title 2</h2>
          <p className="text-gray-600">Card content goes here.</p>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-2">Card Title 3</h2>
          <p className="text-gray-600">Card content goes here.</p>
        </div>
      </div>
    </div>
  );
}
