"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import Link from "next/link"
import { ArrowLeft, BarChart3, Sparkles } from "lucide-react"

interface DayData {
  dayName: string
  date: string
  calories: number
  caloriesTarget: number
  protein: number
  proteinTarget: number
  summary: string
}

export default function WeeklyPage() {
  const router = useRouter()
  const { user, isLoaded, isSignedIn } = useUser()
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState<DayData[]>([])
  const [aiSummary, setAiSummary] = useState("")
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) {
      router.push('/auth/signin')
      return
    }
    setLoading(false)
    if (user?.id) {
      fetchWeeklyData()
    }
  }, [isLoaded, isSignedIn, router, user?.id])

  const fetchWeeklyData = async () => {
    if (!user?.id) return
    setGenerating(true)
    try {
      const response = await fetch('/api/insights/weekly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      })
      if (response.ok) {
        const data = await response.json()
        setDays(data.days || [])
        setAiSummary(data.summary || "")
      }
    } catch (error) {
      console.error('Failed to fetch weekly data:', error)
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

  const daysWithData = days.filter(d => d.calories > 0)

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
            <h1 className="text-2xl font-bold text-foreground">Weekly Breakdown</h1>
            <p className="text-sm text-muted-foreground">Day-by-day analysis</p>
          </div>
        </div>

        {/* Icon */}
        <div className="flex justify-center mb-8">
          <div className="h-20 w-20 rounded-2xl bg-blue-500/10 flex items-center justify-center">
            <BarChart3 className="h-10 w-10 text-blue-500" />
          </div>
        </div>

        {generating ? (
          <div className="text-center py-12">
            <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Analyzing your week...</p>
          </div>
        ) : daysWithData.length === 0 ? (
          <div className="bg-card rounded-2xl p-8 border border-border/50 text-center">
            <Sparkles className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-2">No Data This Week</h2>
            <p className="text-muted-foreground">
              Start logging meals to see your weekly breakdown.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* AI Summary */}
            {aiSummary && (
              <div className="bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent rounded-2xl p-5 border border-blue-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium text-blue-600">AI Summary</span>
                </div>
                <p className="text-foreground">{aiSummary}</p>
              </div>
            )}

            {/* Day by Day */}
            <div className="space-y-3">
              {days.map((day, index) => {
                const calPercent = day.caloriesTarget > 0
                  ? Math.round((day.calories / day.caloriesTarget) * 100)
                  : 0
                const proteinPercent = day.proteinTarget > 0
                  ? Math.round((day.protein / day.proteinTarget) * 100)
                  : 0
                const hasData = day.calories > 0

                return (
                  <div
                    key={index}
                    className={`bg-card rounded-xl p-4 border transition-colors ${
                      hasData ? 'border-border/50' : 'border-border/30 opacity-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-medium text-foreground">{day.dayName}</p>
                        <p className="text-xs text-muted-foreground">{day.date}</p>
                      </div>
                      {hasData && (
                        <div className="text-right">
                          <p className="text-sm font-medium text-foreground">{day.calories} cal</p>
                          <p className="text-xs text-primary">{day.protein}g protein</p>
                        </div>
                      )}
                    </div>

                    {hasData ? (
                      <>
                        {/* Progress bars */}
                        <div className="space-y-2">
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-muted-foreground">Calories</span>
                              <span className={calPercent >= 90 && calPercent <= 110 ? 'text-green-600' : 'text-muted-foreground'}>
                                {calPercent}%
                              </span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  calPercent >= 90 && calPercent <= 110 ? 'bg-green-500' :
                                  calPercent < 90 ? 'bg-amber-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${Math.min(100, calPercent)}%` }}
                              />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-muted-foreground">Protein</span>
                              <span className={proteinPercent >= 90 ? 'text-green-600' : 'text-muted-foreground'}>
                                {proteinPercent}%
                              </span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  proteinPercent >= 90 ? 'bg-green-500' : 'bg-primary/60'
                                }`}
                                style={{ width: `${Math.min(100, proteinPercent)}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Day summary */}
                        {day.summary && (
                          <p className="text-xs text-muted-foreground mt-3 italic">
                            {day.summary}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">No meals logged</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
