"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { TrendingUp, Flame, Target, Calendar, Lightbulb, AlertCircle, CheckCircle, Sparkles } from "lucide-react"

interface WeeklyData {
  day: string
  calories: number
  protein: number
  target: number
}

interface AIInsight {
  type: "warning" | "success" | "tip"
  title: string
  description: string
}

interface UserGoals {
  goal: string
  targetCalories: number
  targetProtein: number
  strategy: string
}

export default function MyPathPage() {
  const router = useRouter()
  const { user, isLoaded, isSignedIn } = useUser()
  const [loading, setLoading] = useState(true)
  const [insights, setInsights] = useState<AIInsight[]>([])
  const [loadingInsights, setLoadingInsights] = useState(false)

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) {
      router.push('/auth/signin')
      return
    }
    setLoading(false)
    fetchInsights()
  }, [isLoaded, isSignedIn, router])

  const fetchInsights = async () => {
    setLoadingInsights(true)
    try {
      // TODO: Replace with actual API call to get AI insights
      // const response = await fetch(`/api/ai-insights?userId=${user?.id}`)
      // const data = await response.json()

      // Mock AI insights for now
      setTimeout(() => {
        setInsights([
          {
            type: "warning",
            title: "Lunch is often light",
            description: "You're averaging only 350 calories at lunch. Consider adding a protein source to stay energized through the afternoon."
          },
          {
            type: "tip",
            title: "Protein timing",
            description: "Try spreading your protein more evenly. You're getting 60% of your protein at dinner — earlier intake can boost muscle synthesis."
          },
          {
            type: "success",
            title: "Great breakfast consistency",
            description: "You've logged breakfast 6 out of 7 days this week. Morning meals are setting you up for success!"
          },
          {
            type: "warning",
            title: "Weekend patterns",
            description: "Your calorie intake drops 25% on weekends. This might slow your progress toward your muscle-building goal."
          }
        ])
        setLoadingInsights(false)
      }, 1000)
    } catch (error) {
      console.error('Failed to fetch insights:', error)
      setLoadingInsights(false)
    }
  }

  // Mock user goals - replace with real API data
  const userGoals: UserGoals = {
    goal: "Build lean muscle",
    targetCalories: 2400,
    targetProtein: 150,
    strategy: "We're keeping you in a slight caloric surplus with high protein to support muscle growth while minimizing fat gain. Your meal timing is optimized around your workout schedule."
  }

  // Mock data - replace with real API calls
  const weeklyData: WeeklyData[] = [
    { day: "Mon", calories: 2100, protein: 130, target: 2400 },
    { day: "Tue", calories: 2350, protein: 145, target: 2400 },
    { day: "Wed", calories: 2400, protein: 150, target: 2400 },
    { day: "Thu", calories: 2200, protein: 135, target: 2400 },
    { day: "Fri", calories: 2500, protein: 155, target: 2400 },
    { day: "Sat", calories: 2300, protein: 140, target: 2400 },
    { day: "Sun", calories: 2150, protein: 128, target: 2400 },
  ]

  const stats = {
    currentStreak: 12,
    longestStreak: 21,
    daysOnTrack: 5,
    totalDaysLogged: 45,
    avgCalories: 2286,
    avgProtein: 140,
    weeklyGoalHit: 71, // percentage
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  const maxCalories = Math.max(...weeklyData.map(d => d.calories), ...weeklyData.map(d => d.target))
  const userName = user?.firstName || "there"

  const getInsightIcon = (type: AIInsight["type"]) => {
    switch (type) {
      case "warning":
        return <AlertCircle className="h-5 w-5 text-amber-500" />
      case "success":
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case "tip":
        return <Lightbulb className="h-5 w-5 text-blue-500" />
    }
  }

  const getInsightBg = (type: AIInsight["type"]) => {
    switch (type) {
      case "warning":
        return "bg-amber-500/10 border-amber-500/20"
      case "success":
        return "bg-green-500/10 border-green-500/20"
      case "tip":
        return "bg-blue-500/10 border-blue-500/20"
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-6xl px-8 py-12 space-y-10">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-semibold text-foreground">My Path</h1>
          <p className="text-lg text-muted-foreground mt-2">Your personalized nutrition journey</p>
        </div>

        {/* Goal + AI Insights Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Your Goal Narrative */}
          <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-3xl p-8 border border-primary/20 flex flex-col">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <p className="text-sm font-medium text-primary uppercase tracking-wider">Your Goal</p>
            </div>
            <h2 className="text-2xl font-semibold text-foreground mb-3">{userGoals.goal}</h2>
            <p className="text-base text-muted-foreground leading-relaxed mb-6 flex-1">
              {userGoals.strategy}
            </p>
            <div className="flex flex-wrap gap-3">
              <div className="bg-card/80 rounded-xl px-4 py-2 border border-border/50">
                <span className="text-lg font-semibold text-foreground">{userGoals.targetCalories}</span>
                <span className="text-sm text-muted-foreground ml-1">cal/day</span>
              </div>
              <div className="bg-card/80 rounded-xl px-4 py-2 border border-border/50">
                <span className="text-lg font-semibold text-primary">{userGoals.targetProtein}g</span>
                <span className="text-sm text-muted-foreground ml-1">protein/day</span>
              </div>
            </div>
          </div>

          {/* AI Insights */}
          <div className="bg-card rounded-3xl p-8 border border-border/50 flex flex-col">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">AI Insights</h2>
                <p className="text-sm text-muted-foreground">From your eating patterns</p>
              </div>
            </div>

            {loadingInsights ? (
              <div className="flex items-center justify-center py-12 flex-1">
                <div className="flex items-center gap-3">
                  <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  <span className="text-muted-foreground">Analyzing...</span>
                </div>
              </div>
            ) : (
              <div className="space-y-3 flex-1">
                {insights.map((insight, index) => (
                  <div
                    key={index}
                    className={`rounded-xl p-4 border ${getInsightBg(insight.type)}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">{getInsightIcon(insight.type)}</div>
                      <div>
                        <p className="font-medium text-foreground text-sm">{insight.title}</p>
                        <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{insight.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="bg-card rounded-3xl p-6 border border-border/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                <Flame className="h-5 w-5 text-orange-500" />
              </div>
            </div>
            <p className="text-3xl font-bold text-foreground">{stats.currentStreak}</p>
            <p className="text-base text-muted-foreground mt-1">Day Streak</p>
          </div>

          <div className="bg-card rounded-3xl p-6 border border-border/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Target className="h-5 w-5 text-primary" />
              </div>
            </div>
            <p className="text-3xl font-bold text-foreground">{stats.daysOnTrack}/7</p>
            <p className="text-base text-muted-foreground mt-1">Days On Track</p>
          </div>

          <div className="bg-card rounded-3xl p-6 border border-border/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-blue-500" />
              </div>
            </div>
            <p className="text-3xl font-bold text-foreground">{stats.avgCalories}</p>
            <p className="text-base text-muted-foreground mt-1">Avg. Calories</p>
          </div>

          <div className="bg-card rounded-3xl p-6 border border-border/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-green-500" />
              </div>
            </div>
            <p className="text-3xl font-bold text-foreground">{stats.totalDaysLogged}</p>
            <p className="text-base text-muted-foreground mt-1">Days Logged</p>
          </div>
        </div>

        {/* Weekly Chart */}
        <div className="bg-card rounded-3xl p-8 border border-border/50">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-xl font-semibold text-foreground">This Week</h2>
              <p className="text-base text-muted-foreground mt-1">Your daily calorie intake</p>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-primary" />
                <span className="text-muted-foreground">Calories</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-muted" />
                <span className="text-muted-foreground">Target</span>
              </div>
            </div>
          </div>

          {/* Bar Chart */}
          <div className="flex items-end justify-between gap-4 h-64">
            {weeklyData.map((day, index) => {
              const height = (day.calories / maxCalories) * 100
              const targetHeight = (day.target / maxCalories) * 100
              const isOnTrack = day.calories >= day.target * 0.9 && day.calories <= day.target * 1.1

              return (
                <div key={day.day} className="flex-1 flex flex-col items-center gap-3">
                  <div className="relative w-full flex justify-center" style={{ height: '200px' }}>
                    {/* Target line */}
                    <div
                      className="absolute w-full border-t-2 border-dashed border-muted"
                      style={{ bottom: `${targetHeight}%` }}
                    />
                    {/* Bar */}
                    <div
                      className={`w-full max-w-12 rounded-xl transition-all ${
                        isOnTrack ? 'bg-primary' : 'bg-primary/60'
                      }`}
                      style={{ height: `${height}%` }}
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-base font-medium text-foreground">{day.day}</p>
                    <p className="text-sm text-muted-foreground">{day.calories}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Progress Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Weekly Goal Progress */}
          <div className="bg-card rounded-3xl p-8 border border-border/50">
            <h2 className="text-xl font-semibold text-foreground mb-6">Weekly Goal</h2>
            <div className="flex items-center justify-center mb-6">
              <div className="relative w-40 h-40">
                <svg className="w-40 h-40 -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="10" className="text-muted" />
                  <circle
                    cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="10"
                    className="text-primary transition-all duration-500"
                    strokeLinecap="round"
                    strokeDasharray={`${stats.weeklyGoalHit * 2.64} 264`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl font-bold text-foreground">{stats.weeklyGoalHit}%</span>
                </div>
              </div>
            </div>
            <p className="text-center text-base text-muted-foreground">
              You hit your targets {stats.daysOnTrack} out of 7 days this week
            </p>
          </div>

          {/* Protein Tracking */}
          <div className="bg-card rounded-3xl p-8 border border-border/50">
            <h2 className="text-xl font-semibold text-foreground mb-6">Protein This Week</h2>
            <div className="space-y-4">
              {weeklyData.map((day) => {
                const proteinGoal = 150
                const percentage = Math.min(100, (day.protein / proteinGoal) * 100)

                return (
                  <div key={day.day} className="flex items-center gap-4">
                    <span className="text-base font-medium text-foreground w-10">{day.day}</span>
                    <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-sm text-muted-foreground w-12 text-right">{day.protein}g</span>
                  </div>
                )
              })}
            </div>
            <p className="text-center text-base text-muted-foreground mt-6">
              Avg: {stats.avgProtein}g / day
            </p>
          </div>
        </div>

        {/* Milestones */}
        <div className="bg-card rounded-3xl p-8 border border-border/50">
          <h2 className="text-xl font-semibold text-foreground mb-6">Milestones</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center p-4 rounded-2xl bg-muted/30">
              <p className="text-2xl font-bold text-primary">{stats.longestStreak}</p>
              <p className="text-sm text-muted-foreground mt-1">Longest Streak</p>
            </div>
            <div className="text-center p-4 rounded-2xl bg-muted/30">
              <p className="text-2xl font-bold text-primary">{stats.totalDaysLogged}</p>
              <p className="text-sm text-muted-foreground mt-1">Total Days</p>
            </div>
            <div className="text-center p-4 rounded-2xl bg-muted/30">
              <p className="text-2xl font-bold text-primary">{Math.round(stats.avgProtein * stats.totalDaysLogged / 1000)}kg</p>
              <p className="text-sm text-muted-foreground mt-1">Protein Eaten</p>
            </div>
            <div className="text-center p-4 rounded-2xl bg-muted/30">
              <p className="text-2xl font-bold text-primary">{Math.round(stats.avgCalories * stats.totalDaysLogged / 1000)}k</p>
              <p className="text-sm text-muted-foreground mt-1">Calories Logged</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
