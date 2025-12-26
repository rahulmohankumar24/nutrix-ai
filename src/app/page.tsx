'use client'

import { useUser } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function Home() {
  const { isLoaded, isSignedIn } = useUser()
  const router = useRouter()

  useEffect(() => {
    if (!isLoaded) return

    if (!isSignedIn) {
      router.push('/auth/signin')
    } else {
      router.push('/dashboard')
    }
  }, [isLoaded, isSignedIn, router])

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-2 border-blue-500 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-400 text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  return null
}
