'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    // Check if user has completed onboarding
    const userId = localStorage.getItem('userId')
    if (userId) {
      router.push('/dashboard')
    } else {
      router.push('/onboarding')
    }
  }, [router])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading Nutrix AI...</p>
      </div>
    </div>
  )
}
