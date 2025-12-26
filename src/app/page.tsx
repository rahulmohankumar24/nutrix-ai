'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'

export default function Page() {
  const router = useRouter()
  const { isLoaded, isSignedIn } = useUser()

  useEffect(() => {
    if (!isLoaded) return

    if (!isSignedIn) {
      // Redirect to signin if not authenticated
      router.push('/auth/signin')
      return
    }

    // Redirect to dashboard if authenticated
    router.push('/dashboard')
  }, [isLoaded, isSignedIn, router])

  // Show loading state while checking auth
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-2 border-primary border-t-transparent mx-auto"></div>
          <p className="mt-4 text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  // This will only briefly show before redirect
  return (
    <main className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-2 border-primary border-t-transparent mx-auto"></div>
        <p className="mt-4 text-muted-foreground text-sm">Redirecting...</p>
      </div>
    </main>
  )
}
