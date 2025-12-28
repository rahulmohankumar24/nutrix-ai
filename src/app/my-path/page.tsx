"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import Link from "next/link"
import {
  TrendingUp, Flame, Target, Calendar, Sparkles,
  ChevronRight, Zap, Brain, Trophy, Clock,
  Utensils, ArrowUpRight, BarChart3
} from "lucide-react"

interface WeeklyData {
  label: string
  dayName: string
  date: string
  calories: number
  caloriesTarget: number
  protein: number
  proteinTarget: number
  carbs: number
  fat: number
  summary: string
  isCurrent: boolean
}

interface WeeklyStats {
  currentStreak: number
  longestStreak: number
  daysOnTrack: number
  totalDaysLogged: number
  avgCalories: number
  avgProtein: number
  weeklyGoalHit: number
  targetCalories: number
  targetProtein: number
}

interface PatternInsight {
  id: string
  headline: string
  body: string
  tone: 'positive' | 'neutral' | 'curious'
  category: string
  confidence: number
}

interface UserGoals {
  goal: string
  targetCalories: number
  targetProtein: number
  targetCarbs: number
  targetFat: number
  strategy: string
}

export default function MyPathPage() {
  const router = useRouter()
  const { user, isLoaded, isSignedIn } = useUser()
  const [loading, setLoading] = useState(true)
  const [userTargets, setUserTargets] = useState<UserGoals | null>(null)
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([])
  const [stats, setStats] = useState<WeeklyStats | null>(null)
  const [loadingData, setLoadingData] = useState(true)
  const [patternInsights, setPatternInsights] = useState<PatternInsight[]>([])
  const [loadingPatterns, setLoadingPatterns] = useState(true)
  const [daysAnalyzed, setDaysAnalyzed] = useState(0)
  const [weeklyInsight, setWeeklyInsight] = useState<string>("")

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) {
      router.push('/auth/signin')
      return
    }
    setLoading(false)
    if (user?.id) {
      fetchUserProfile()
      fetchWeeklyData()
      fetchStats()
      fetchPatternInsights()
    }
  }, [isLoaded, isSignedIn, router, user?.id])

  const fetchWeeklyData = async () => {
    if (!user?.id) return
    try {
      const response = await fetch(`/api/weekly-summary?userId=${user.id}`)
      if (response.ok) {
        const data = await response.json()
        setWeeklyData(data.days || [])
        generateWeeklyInsight(data.days || [])
      }
    } catch (error) {
      console.error('Failed to fetch weekly data:', error)
    }
  }

  const fetchStats = async () => {
    if (!user?.id) return
    setLoadingData(true)
    try {
      const response = await fetch(`/api/weekly-stats?userId=${user.id}`)
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    } finally {
      setLoadingData(false)
    }
  }

  const fetchPatternInsights = async () => {
    if (!user?.id) return
    setLoadingPatterns(true)
    try {
      const analyzeResponse = await fetch('/api/patterns/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, reanalyze: true })
      })

      if (analyzeResponse.ok) {
        const analyzeData = await analyzeResponse.json()
        setDaysAnalyzed(analyzeData.daysAnalyzed || 0)
      }

      const response = await fetch(`/api/patterns/insights?userId=${user.id}&context=my-path&limit=6`)
      if (response.ok) {
        const data = await response.json()
        setPatternInsights(data.insights || [])
      }
    } catch (error) {
      console.error('Failed to fetch pattern insights:', error)
    } finally {
      setLoadingPatterns(false)
    }
  }

  const generateWeeklyInsight = (days: WeeklyData[]) => {
    const daysWithData = days.filter(d => d.calories > 0)
    if (daysWithData.length === 0) {
      setWeeklyInsight("Start logging meals to see your weekly insights!")
      return
    }

    const avgCalories = Math.round(daysWithData.reduce((sum, d) => sum + d.calories, 0) / daysWithData.length)
    const avgProtein = Math.round(daysWithData.reduce((sum, d) => sum + d.protein, 0) / daysWithData.length)
    const targetCalories = daysWithData[0]?.caloriesTarget || 2000
    const targetProtein = daysWithData[0]?.proteinTarget || 150

    // Helper to describe a day's eating
    const describeDay = (d: WeeklyData): string => {
      const calPercent = Math.round((d.calories / d.caloriesTarget) * 100)
      const proteinPercent = Math.round((d.protein / d.proteinTarget) * 100)

      let calDesc = ''
      if (calPercent >= 90 && calPercent <= 110) calDesc = 'right on target'
      else if (calPercent < 50) calDesc = 'a very light day'
      else if (calPercent < 75) calDesc = 'on the lighter side'
      else if (calPercent < 90) calDesc = 'slightly under'
      else if (calPercent <= 120) calDesc = 'a bit over'
      else calDesc = 'a bigger eating day'

      let proteinDesc = ''
      if (proteinPercent >= 90) proteinDesc = 'protein was solid'
      else if (proteinPercent >= 70) proteinDesc = 'protein could use a boost'
      else proteinDesc = 'protein fell short'

      return `${d.dayName} was ${calDesc} — ${proteinDesc}`
    }

    // Find notable days
    const bestCalorieDay = daysWithData.reduce((best, d) => {
      const diff = Math.abs(d.calories - d.caloriesTarget)
      const bestDiff = Math.abs(best.calories - best.caloriesTarget)
      return diff < bestDiff ? d : best
    }, daysWithData[0])

    const highestCalorieDay = daysWithData.reduce((h, d) => d.calories > h.calories ? d : h, daysWithData[0])
    const lowestCalorieDay = daysWithData.reduce((l, d) => d.calories < l.calories ? d : l, daysWithData[0])
    const bestProteinDay = daysWithData.reduce((b, d) => d.protein > b.protein ? d : b, daysWithData[0])

    // Check patterns
    const proteinHits = daysWithData.filter(d => d.protein >= d.proteinTarget * 0.9).length
    const calPercent = Math.round((avgCalories / targetCalories) * 100)

    const weekendDays = daysWithData.filter(d => d.dayName === 'Sat' || d.dayName === 'Sun')
    const weekdayDays = daysWithData.filter(d => d.dayName !== 'Sat' && d.dayName !== 'Sun')
    const weekendAvg = weekendDays.length > 0 ? weekendDays.reduce((s, d) => s + d.calories, 0) / weekendDays.length : 0
    const weekdayAvg = weekdayDays.length > 0 ? weekdayDays.reduce((s, d) => s + d.calories, 0) / weekdayDays.length : 0

    // Build the story
    const parts: string[] = []

    // For 1-2 days, tell the story of each day
    if (daysWithData.length <= 2) {
      daysWithData.forEach(d => parts.push(describeDay(d) + '.'))

      // Add overall context
      if (calPercent < 70) {
        parts.push("Overall, you're eating quite a bit under your needs.")
      } else if (calPercent < 90) {
        parts.push("You're running a little under — a snack or two could help.")
      }
    } else {
      // Multiple days - tell a week story

      // Opening: overall vibe
      if (calPercent >= 90 && calPercent <= 110) {
        parts.push("Solid week overall — you stayed close to your targets.")
      } else if (calPercent < 70) {
        parts.push("This week ran pretty light on calories.")
      } else if (calPercent < 90) {
        parts.push("You came in a bit under this week.")
      } else if (calPercent <= 120) {
        parts.push("Slightly over target this week, but nothing major.")
      } else {
        parts.push("This was a bigger eating week.")
      }

      // Highlight the standout day
      if (highestCalorieDay.calories > lowestCalorieDay.calories * 1.5) {
        parts.push(`${highestCalorieDay.dayName} stood out as the biggest day, while ${lowestCalorieDay.dayName} was the lightest.`)
      } else if (bestCalorieDay) {
        const bestDiff = Math.abs(bestCalorieDay.calories - bestCalorieDay.caloriesTarget)
        if (bestDiff < 100) {
          parts.push(`${bestCalorieDay.dayName} was your most balanced day.`)
        }
      }

      // Protein story
      if (proteinHits === daysWithData.length) {
        parts.push("Protein was consistent all week — nice work.")
      } else if (proteinHits === 0) {
        parts.push("Protein fell short each day — try adding a protein-rich snack or bigger portions at meals.")
      } else if (proteinHits >= daysWithData.length / 2) {
        parts.push(`${bestProteinDay.dayName} led on protein. Keep that momentum going.`)
      } else {
        parts.push("Protein was hit or miss — focus on getting more at each meal.")
      }

      // Weekend pattern
      if (weekendDays.length > 0 && weekdayDays.length > 0 && Math.abs(weekendAvg - weekdayAvg) > 300) {
        if (weekendAvg > weekdayAvg) {
          parts.push("Weekends tended to be bigger eating days.")
        } else {
          parts.push("You ate lighter on the weekend.")
        }
      }
    }

    setWeeklyInsight(parts.join(' '))
  }

  const fetchUserProfile = async () => {
    if (!user?.id) return
    try {
      const response = await fetch(`/api/profile?userId=${user.id}`)
      if (response.ok) {
        const data = await response.json()
        if (data.profile) {
          setUserTargets({
            goal: formatGoal(data.profile.goal),
            targetCalories: data.targets?.calories || 2000,
            targetProtein: data.targets?.protein || 150,
            targetCarbs: data.targets?.carbs || 250,
            targetFat: data.targets?.fat || 65,
            strategy: getGoalStrategy(data.profile.goal)
          })
        }
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error)
    }
  }

  const formatGoal = (goal: string) => {
    const goalMap: Record<string, string> = {
      'cut': 'Lose Fat',
      'maintain': 'Maintain Weight',
      'lean_bulk': 'Lean Bulk',
      'recomp': 'Build Lean Muscle',
      'bulk': 'Build Muscle'
    }
    return goalMap[goal] || 'Build Lean Muscle'
  }

  const getGoalStrategy = (goal: string) => {
    const strategies: Record<string, string> = {
      'cut': "Caloric deficit with high protein to preserve muscle.",
      'maintain': "Balanced calories to maintain your current weight.",
      'lean_bulk': "Slight surplus with high protein to build muscle.",
      'recomp': "Optimized nutrition to build muscle while staying lean.",
      'bulk': "Caloric surplus with high protein to maximize gains."
    }
    return strategies[goal] || strategies['recomp']
  }

  const displayStats = stats || {
    currentStreak: 0,
    longestStreak: 0,
    daysOnTrack: 0,
    totalDaysLogged: 0,
    avgCalories: 0,
    avgProtein: 0,
    weeklyGoalHit: 0,
    targetCalories: 2000,
    targetProtein: 150
  }

  const displayGoals = userTargets || {
    goal: "Build lean muscle",
    targetCalories: 2400,
    targetProtein: 150,
    targetCarbs: 250,
    targetFat: 65,
    strategy: "Optimized nutrition to build muscle while staying lean."
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  // Categorize insights
  const strengthInsights = patternInsights.filter(i => i.tone === 'positive').slice(0, 2)
  const opportunityInsights = patternInsights.filter(i => i.tone === 'curious').slice(0, 2)
  const patternCards = patternInsights.filter(i => i.tone === 'neutral').slice(0, 2)

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-5xl px-6 py-10 space-y-8">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Analytics</h1>
            <p className="text-muted-foreground mt-1">Your personalized nutrition insights</p>
          </div>
          <Link
            href="/profile"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted/50 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
          >
            Edit Profile
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Weekly Summary Hero */}
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-2xl p-6 border border-primary/20">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">This Week</h2>
                <p className="text-sm text-muted-foreground">{daysAnalyzed} days analyzed</p>
              </div>
            </div>
          </div>

          <p className="text-lg text-foreground mb-6">{weeklyInsight}</p>

          {/* Quick Stats Row */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-card/60 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-foreground">{displayStats.currentStreak}</p>
              <p className="text-xs text-muted-foreground">Day Streak</p>
            </div>
            <div className="bg-card/60 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-foreground">{displayStats.daysOnTrack}/7</p>
              <p className="text-xs text-muted-foreground">On Track</p>
            </div>
            <div className="bg-card/60 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-foreground">{displayStats.avgCalories}</p>
              <p className="text-xs text-muted-foreground">Avg Cal</p>
            </div>
            <div className="bg-card/60 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-primary">{displayStats.avgProtein}g</p>
              <p className="text-xs text-muted-foreground">Avg Protein</p>
            </div>
          </div>
        </div>

        {/* AI Insight Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Your Strengths */}
          <Link href="/insights/strengths" className="group">
            <div className="bg-card rounded-2xl p-5 border border-border/50 hover:border-green-500/30 hover:shadow-lg transition-all h-full">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                    <Trophy className="h-5 w-5 text-green-500" />
                  </div>
                  <h3 className="font-semibold text-foreground">Your Strengths</h3>
                </div>
                <ArrowUpRight className="h-5 w-5 text-muted-foreground group-hover:text-green-500 transition-colors" />
              </div>

              {loadingPatterns ? (
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded animate-pulse" />
                  <div className="h-4 bg-muted rounded w-3/4 animate-pulse" />
                </div>
              ) : strengthInsights.length > 0 ? (
                <div className="space-y-2">
                  {strengthInsights.map((insight, i) => (
                    <p key={i} className="text-sm text-muted-foreground">• {insight.headline}</p>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Keep logging to discover your strengths!</p>
              )}
            </div>
          </Link>

          {/* Areas to Explore */}
          <Link href="/insights/opportunities" className="group">
            <div className="bg-card rounded-2xl p-5 border border-border/50 hover:border-amber-500/30 hover:shadow-lg transition-all h-full">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                    <Zap className="h-5 w-5 text-amber-500" />
                  </div>
                  <h3 className="font-semibold text-foreground">Areas to Explore</h3>
                </div>
                <ArrowUpRight className="h-5 w-5 text-muted-foreground group-hover:text-amber-500 transition-colors" />
              </div>

              {loadingPatterns ? (
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded animate-pulse" />
                  <div className="h-4 bg-muted rounded w-3/4 animate-pulse" />
                </div>
              ) : opportunityInsights.length > 0 ? (
                <div className="space-y-2">
                  {opportunityInsights.map((insight, i) => (
                    <p key={i} className="text-sm text-muted-foreground">• {insight.headline}</p>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Log more meals to find opportunities!</p>
              )}
            </div>
          </Link>

          {/* Your Patterns */}
          <Link href="/insights/patterns" className="group">
            <div className="bg-card rounded-2xl p-5 border border-border/50 hover:border-purple-500/30 hover:shadow-lg transition-all h-full">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                    <Brain className="h-5 w-5 text-purple-500" />
                  </div>
                  <h3 className="font-semibold text-foreground">Your Patterns</h3>
                </div>
                <ArrowUpRight className="h-5 w-5 text-muted-foreground group-hover:text-purple-500 transition-colors" />
              </div>

              {loadingPatterns ? (
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded animate-pulse" />
                  <div className="h-4 bg-muted rounded w-3/4 animate-pulse" />
                </div>
              ) : patternCards.length > 0 ? (
                <div className="space-y-2">
                  {patternCards.map((insight, i) => (
                    <p key={i} className="text-sm text-muted-foreground">• {insight.headline}</p>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Patterns emerge after 7+ days of logging.</p>
              )}
            </div>
          </Link>

          {/* Weekly Breakdown */}
          <Link href="/insights/weekly" className="group">
            <div className="bg-card rounded-2xl p-5 border border-border/50 hover:border-blue-500/30 hover:shadow-lg transition-all h-full">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <BarChart3 className="h-5 w-5 text-blue-500" />
                  </div>
                  <h3 className="font-semibold text-foreground">Weekly Breakdown</h3>
                </div>
                <ArrowUpRight className="h-5 w-5 text-muted-foreground group-hover:text-blue-500 transition-colors" />
              </div>

              {/* Mini bar chart preview */}
              <div className="flex items-end gap-1 h-12">
                {weeklyData.slice(0, 7).map((day, i) => {
                  const height = day.caloriesTarget > 0
                    ? Math.min(100, (day.calories / day.caloriesTarget) * 100)
                    : 0
                  return (
                    <div
                      key={i}
                      className={`flex-1 rounded-t transition-all ${
                        day.calories === 0 ? 'bg-muted/30' : 'bg-blue-500/60'
                      }`}
                      style={{ height: day.calories === 0 ? '4px' : `${height}%` }}
                    />
                  )
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-2">Tap to see detailed breakdown</p>
            </div>
          </Link>
        </div>

        {/* Goal Card */}
        <div className="bg-card rounded-2xl p-6 border border-border/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{displayGoals.goal}</h3>
                <p className="text-sm text-muted-foreground">{displayGoals.strategy}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div className="text-center p-3 rounded-xl bg-muted/30">
              <p className="text-lg font-bold text-foreground">{displayGoals.targetCalories}</p>
              <p className="text-xs text-muted-foreground">Cal/day</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-primary/10">
              <p className="text-lg font-bold text-primary">{displayGoals.targetProtein}g</p>
              <p className="text-xs text-muted-foreground">Protein</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-muted/30">
              <p className="text-lg font-bold text-foreground">{displayGoals.targetCarbs}g</p>
              <p className="text-xs text-muted-foreground">Carbs</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-muted/30">
              <p className="text-lg font-bold text-foreground">{displayGoals.targetFat}g</p>
              <p className="text-xs text-muted-foreground">Fat</p>
            </div>
          </div>
        </div>

        {/* Milestones */}
        <div className="bg-card rounded-2xl p-6 border border-border/50">
          <h3 className="font-semibold text-foreground mb-4">Milestones</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 rounded-xl bg-gradient-to-br from-orange-500/10 to-transparent border border-orange-500/20">
              <Flame className="h-6 w-6 text-orange-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground">{displayStats.longestStreak}</p>
              <p className="text-xs text-muted-foreground">Best Streak</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-gradient-to-br from-primary/10 to-transparent border border-primary/20">
              <Calendar className="h-6 w-6 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground">{displayStats.totalDaysLogged}</p>
              <p className="text-xs text-muted-foreground">Days Logged</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-gradient-to-br from-green-500/10 to-transparent border border-green-500/20">
              <TrendingUp className="h-6 w-6 text-green-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground">{Math.round(displayStats.avgProtein * displayStats.totalDaysLogged / 1000)}kg</p>
              <p className="text-xs text-muted-foreground">Protein Eaten</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/20">
              <Utensils className="h-6 w-6 text-blue-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground">{Math.round(displayStats.avgCalories * displayStats.totalDaysLogged / 1000)}k</p>
              <p className="text-xs text-muted-foreground">Calories Logged</p>
            </div>
          </div>
        </div>

      </main>
    </div>
  )
}
