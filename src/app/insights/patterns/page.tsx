"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import Link from "next/link"
import { ArrowLeft, Brain, Sparkles } from "lucide-react"

interface PatternInsight {
  title: string
  description: string
  frequency: string
}

export default function PatternsPage() {
  const router = useRouter()
  const { user, isLoaded, isSignedIn } = useUser()
  const [loading, setLoading] = useState(true)
  const [insights, setInsights] = useState<PatternInsight[]>([])
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
      fetchPatterns()
    }
  }, [isLoaded, isSignedIn, router, user?.id])

  const fetchPatterns = async () => {
    if (!user?.id) return
    setGenerating(true)
    try {
      const response = await fetch('/api/insights/patterns', {
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
      console.error('Failed to fetch patterns:', error)
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
            <h1 className="text-2xl font-bold text-foreground">Your Patterns</h1>
            <p className="text-sm text-muted-foreground">Habits I've noticed</p>
          </div>
        </div>

        {/* Icon */}
        <div className="flex justify-center mb-8">
          <div className="h-20 w-20 rounded-2xl bg-purple-500/10 flex items-center justify-center">
            <Brain className="h-10 w-10 text-purple-500" />
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
              Log meals for at least 3 days so I can identify your patterns. You've logged {daysLogged} day{daysLogged !== 1 ? 's' : ''} so far.
            </p>
            <div className="w-full bg-muted rounded-full h-2 mb-2">
              <div
                className="bg-purple-500 h-2 rounded-full transition-all"
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
                  className="bg-card rounded-2xl p-6 border border-purple-500/20 hover:border-purple-500/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <h3 className="font-semibold text-foreground">{insight.title}</h3>
                    {insight.frequency && (
                      <span className="text-xs px-2 py-1 rounded-full bg-purple-500/10 text-purple-600 whitespace-nowrap">
                        {insight.frequency}
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground">{insight.description}</p>
                </div>
              ))
            ) : (
              <div className="bg-card rounded-2xl p-8 border border-border/50 text-center">
                <p className="text-muted-foreground">Keep logging to discover your patterns!</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
