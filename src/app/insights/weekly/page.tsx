"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import Link from "next/link"
import { ArrowLeft, BarChart3, Sparkles, TrendingUp, Target, Flame, Check, X } from "lucide-react"

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

  // Calculate weekly stats
  const totalCalories = daysWithData.reduce((sum, d) => sum + d.calories, 0)
  const totalProtein = daysWithData.reduce((sum, d) => sum + d.protein, 0)
  const avgCalories = daysWithData.length > 0 ? Math.round(totalCalories / daysWithData.length) : 0
  const avgProtein = daysWithData.length > 0 ? Math.round(totalProtein / daysWithData.length) : 0
  const daysOnTarget = daysWithData.filter(d => {
    const calPercent = d.caloriesTarget > 0 ? (d.calories / d.caloriesTarget) * 100 : 0
    const proteinPercent = d.proteinTarget > 0 ? (d.protein / d.proteinTarget) * 100 : 0
    return calPercent >= 85 && calPercent <= 115 && proteinPercent >= 85
  }).length

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-6xl px-6 py-10">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/my-path"
            className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-foreground">Weekly Breakdown</h1>
            <p className="text-muted-foreground">Your day-by-day nutrition analysis</p>
          </div>
          <div className="h-14 w-14 rounded-2xl bg-blue-500/10 flex items-center justify-center">
            <BarChart3 className="h-7 w-7 text-blue-500" />
          </div>
        </div>

        {generating ? (
          <div className="text-center py-20">
            <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-4" />
            <p className="text-lg text-muted-foreground">Analyzing your week...</p>
          </div>
        ) : daysWithData.length === 0 ? (
          <div className="bg-card rounded-3xl p-12 border border-border/50 text-center">
            <Sparkles className="h-16 w-16 text-muted-foreground/30 mx-auto mb-6" />
            <h2 className="text-2xl font-semibold text-foreground mb-3">No Data This Week</h2>
            <p className="text-lg text-muted-foreground">
              Start logging meals to see your weekly breakdown.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Weekly Stats Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-card rounded-2xl p-6 border border-border/50">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                    <Flame className="h-5 w-5 text-orange-500" />
                  </div>
                  <span className="text-sm text-muted-foreground">Avg Calories</span>
                </div>
                <p className="text-3xl font-bold text-foreground">{avgCalories}</p>
              </div>
              <div className="bg-card rounded-2xl p-6 border border-border/50">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Target className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-sm text-muted-foreground">Avg Protein</span>
                </div>
                <p className="text-3xl font-bold text-primary">{avgProtein}g</p>
              </div>
              <div className="bg-card rounded-2xl p-6 border border-border/50">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-green-500" />
                  </div>
                  <span className="text-sm text-muted-foreground">Days Logged</span>
                </div>
                <p className="text-3xl font-bold text-foreground">{daysWithData.length}<span className="text-lg text-muted-foreground">/7</span></p>
              </div>
              <div className="bg-card rounded-2xl p-6 border border-border/50">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <Check className="h-5 w-5 text-emerald-500" />
                  </div>
                  <span className="text-sm text-muted-foreground">On Target</span>
                </div>
                <p className="text-3xl font-bold text-emerald-500">{daysOnTarget} <span className="text-lg">days</span></p>
              </div>
            </div>

            {/* AI Summary */}
            {aiSummary && (
              <div className="bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent rounded-2xl p-6 border border-blue-500/20">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="h-6 w-6 text-blue-500" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-blue-600">AI Weekly Summary</span>
                    <p className="text-foreground mt-2 text-lg leading-relaxed">{aiSummary}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Days Grid - 2 rows of cards */}
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-4">Daily Breakdown</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {days.slice(0, 4).map((day, index) => {
                  const calPercent = day.caloriesTarget > 0
                    ? Math.round((day.calories / day.caloriesTarget) * 100)
                    : 0
                  const proteinPercent = day.proteinTarget > 0
                    ? Math.round((day.protein / day.proteinTarget) * 100)
                    : 0
                  const hasData = day.calories > 0
                  const isOnTarget = calPercent >= 85 && calPercent <= 115 && proteinPercent >= 85

                  return (
                    <div
                      key={index}
                      className={`bg-card rounded-2xl p-5 border transition-all ${
                        hasData
                          ? isOnTarget
                            ? 'border-emerald-500/40 bg-emerald-500/5'
                            : 'border-border/50'
                          : 'border-border/30 opacity-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-lg font-semibold text-foreground">{day.dayName}</p>
                          <p className="text-sm text-muted-foreground">{day.date}</p>
                        </div>
                        {hasData && isOnTarget && (
                          <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                            <Check className="h-4 w-4 text-emerald-500" />
                          </div>
                        )}
                      </div>

                      {hasData ? (
                        <div className="space-y-4">
                          <div className="flex justify-between items-end">
                            <div>
                              <p className="text-2xl font-bold text-foreground">{day.calories}</p>
                              <p className="text-sm text-muted-foreground">calories</p>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-bold text-primary">{day.protein}g</p>
                              <p className="text-sm text-muted-foreground">protein</p>
                            </div>
                          </div>

                          {/* Progress bars */}
                          <div className="space-y-3">
                            <div>
                              <div className="flex justify-between text-sm mb-1.5">
                                <span className="text-muted-foreground">Calories</span>
                                <span className={calPercent >= 85 && calPercent <= 115 ? 'text-emerald-600 font-medium' : 'text-muted-foreground'}>
                                  {calPercent}%
                                </span>
                              </div>
                              <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    calPercent >= 85 && calPercent <= 115 ? 'bg-emerald-500' :
                                    calPercent < 85 ? 'bg-amber-500' : 'bg-red-500'
                                  }`}
                                  style={{ width: `${Math.min(100, calPercent)}%` }}
                                />
                              </div>
                            </div>
                            <div>
                              <div className="flex justify-between text-sm mb-1.5">
                                <span className="text-muted-foreground">Protein</span>
                                <span className={proteinPercent >= 85 ? 'text-primary font-medium' : 'text-muted-foreground'}>
                                  {proteinPercent}%
                                </span>
                              </div>
                              <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    proteinPercent >= 85 ? 'bg-primary' : 'bg-primary/40'
                                  }`}
                                  style={{ width: `${Math.min(100, proteinPercent)}%` }}
                                />
                              </div>
                            </div>
                          </div>

                          {day.summary && (
                            <p className="text-sm text-muted-foreground pt-2 border-t border-border/30">
                              {day.summary}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-6">
                          <X className="h-8 w-8 text-muted-foreground/30 mb-2" />
                          <p className="text-muted-foreground">No meals logged</p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Second row for remaining days */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                {days.slice(4).map((day, index) => {
                  const calPercent = day.caloriesTarget > 0
                    ? Math.round((day.calories / day.caloriesTarget) * 100)
                    : 0
                  const proteinPercent = day.proteinTarget > 0
                    ? Math.round((day.protein / day.proteinTarget) * 100)
                    : 0
                  const hasData = day.calories > 0
                  const isOnTarget = calPercent >= 85 && calPercent <= 115 && proteinPercent >= 85

                  return (
                    <div
                      key={index + 4}
                      className={`bg-card rounded-2xl p-5 border transition-all ${
                        hasData
                          ? isOnTarget
                            ? 'border-emerald-500/40 bg-emerald-500/5'
                            : 'border-border/50'
                          : 'border-border/30 opacity-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-lg font-semibold text-foreground">{day.dayName}</p>
                          <p className="text-sm text-muted-foreground">{day.date}</p>
                        </div>
                        {hasData && isOnTarget && (
                          <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                            <Check className="h-4 w-4 text-emerald-500" />
                          </div>
                        )}
                      </div>

                      {hasData ? (
                        <div className="space-y-4">
                          <div className="flex justify-between items-end">
                            <div>
                              <p className="text-2xl font-bold text-foreground">{day.calories}</p>
                              <p className="text-sm text-muted-foreground">calories</p>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-bold text-primary">{day.protein}g</p>
                              <p className="text-sm text-muted-foreground">protein</p>
                            </div>
                          </div>

                          {/* Progress bars */}
                          <div className="space-y-3">
                            <div>
                              <div className="flex justify-between text-sm mb-1.5">
                                <span className="text-muted-foreground">Calories</span>
                                <span className={calPercent >= 85 && calPercent <= 115 ? 'text-emerald-600 font-medium' : 'text-muted-foreground'}>
                                  {calPercent}%
                                </span>
                              </div>
                              <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    calPercent >= 85 && calPercent <= 115 ? 'bg-emerald-500' :
                                    calPercent < 85 ? 'bg-amber-500' : 'bg-red-500'
                                  }`}
                                  style={{ width: `${Math.min(100, calPercent)}%` }}
                                />
                              </div>
                            </div>
                            <div>
                              <div className="flex justify-between text-sm mb-1.5">
                                <span className="text-muted-foreground">Protein</span>
                                <span className={proteinPercent >= 85 ? 'text-primary font-medium' : 'text-muted-foreground'}>
                                  {proteinPercent}%
                                </span>
                              </div>
                              <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    proteinPercent >= 85 ? 'bg-primary' : 'bg-primary/40'
                                  }`}
                                  style={{ width: `${Math.min(100, proteinPercent)}%` }}
                                />
                              </div>
                            </div>
                          </div>

                          {day.summary && (
                            <p className="text-sm text-muted-foreground pt-2 border-t border-border/30">
                              {day.summary}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-6">
                          <X className="h-8 w-8 text-muted-foreground/30 mb-2" />
                          <p className="text-muted-foreground">No meals logged</p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-8 text-sm text-muted-foreground pt-4">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-emerald-500" />
                <span>On target (85-115%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-amber-500" />
                <span>Under target</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-red-500" />
                <span>Over target</span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
