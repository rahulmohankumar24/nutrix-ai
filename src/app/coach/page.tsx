"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { NutritionChat } from "@/components/nutrition-chat"

interface MacroProgress {
  current: { calories: number; protein: number; carbs: number; fat: number }
  targets: { calories: number; protein: number; carbs: number; fat: number }
  remaining: { calories: number; protein: number; carbs: number; fat: number }
}

export default function CoachPage() {
  const router = useRouter()
  const { isLoaded, isSignedIn, user } = useUser()
  const [macros, setMacros] = useState<MacroProgress | null>(null)

  useEffect(() => {
    if (!isLoaded) return

    if (!isSignedIn) {
      router.push('/auth/signin')
      return
    }

    if (user?.id) {
      fetchMacros(user.id)
    }
  }, [isLoaded, isSignedIn, user?.id, router])

  const fetchMacros = async (userId: string) => {
    try {
      const response = await fetch(`/api/macro-progress?userId=${userId}&timezone=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`)
      if (response.ok) {
        const data = await response.json()
        setMacros(data)
      }
    } catch (error) {
      console.error('Failed to fetch macros:', error)
    }
  }

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <main className="min-h-[calc(100vh-130px)] bg-background flex flex-col">
      <NutritionChat
        userId={user?.id || ''}
        userName={user?.firstName || undefined}
        macros={macros}
        onMealLogged={() => user?.id && fetchMacros(user.id)}
        className="flex-1"
      />
    </main>
  )
}
