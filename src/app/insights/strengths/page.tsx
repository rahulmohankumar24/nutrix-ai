"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import Link from "next/link"
import { ArrowLeft, Trophy, Sparkles } from "lucide-react"

interface StrengthInsight {
  title: string
  description: string
  evidence: string
}

export default function StrengthsPage() {
  const router = useRouter()
  const { user, isLoaded, isSignedIn } = useUser()
  const [loading, setLoading] = useState(true)
  const [insights, setInsights] = useState<StrengthInsight[]>([])
  const [daysLogged, setDaysLogged] = useState(0)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) {
      router.push('/auth/signin')
      return
    }
    setLoading(false)
    if (user?.id) {
      fetchStrengths()
    }
  }, [isLoaded, isSignedIn, router, user?.id])

  const fetchStrengths = async () => {
    if (!user?.id) return
    setGenerating(true)
    try {
      const response = await fetch('/api/insights/strengths', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      })
      if (response.ok) {
        const data = await response.json()
        setInsights(data.insights || [])
        setDaysLogged(data.daysLogged || 0)
      }
    } catch (error) {
      console.error('Failed to fetch strengths:', error)
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  const needsMoreData = daysLogged < 3

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-2xl px-6 py-10">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/my-path"
            className="h-10 w-10 rounded-full bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Your Strengths</h1>
            <p className="text-sm text-muted-foreground">What you're doing well</p>
          </div>
        </div>

        {/* Icon */}
        <div className="flex justify-center mb-8">
          <div className="h-20 w-20 rounded-2xl bg-green-500/10 flex items-center justify-center">
            <Trophy className="h-10 w-10 text-green-500" />
          </div>
        </div>

        {generating ? (
          <div className="text-center py-12">
            <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Analyzing your patterns...</p>
          </div>
        ) : needsMoreData ? (
          <div className="bg-card rounded-2xl p-8 border border-border/50 text-center">
            <Sparkles className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-2">Not Enough Data Yet</h2>
            <p className="text-muted-foreground mb-4">
              Log meals for at least 3 days so I can identify your strengths. You've logged {daysLogged} day{daysLogged !== 1 ? 's' : ''} so far.
            </p>
            <div className="w-full bg-muted rounded-full h-2 mb-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(100, (daysLogged / 3) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">{daysLogged}/3 days</p>
          </div>
        ) : (
          <div className="space-y-4">
            {insights.length > 0 ? (
              insights.map((insight, index) => (
                <div
                  key={index}
                  className="bg-card rounded-2xl p-6 border border-green-500/20 hover:border-green-500/40 transition-colors"
                >
                  <h3 className="font-semibold text-foreground mb-2">{insight.title}</h3>
                  <p className="text-muted-foreground mb-3">{insight.description}</p>
                  {insight.evidence && (
                    <p className="text-sm text-green-600 bg-green-500/10 px-3 py-2 rounded-lg">
                      {insight.evidence}
                    </p>
                  )}
                </div>
              ))
            ) : (
              <div className="bg-card rounded-2xl p-8 border border-border/50 text-center">
                <p className="text-muted-foreground">Keep logging to discover your strengths!</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
