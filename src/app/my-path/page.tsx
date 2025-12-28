"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { TrendingUp, Flame, Target, Calendar, Lightbulb, AlertCircle, CheckCircle, Sparkles, User, Edit3, Check, X } from "lucide-react"
import { Input } from "@/components/ui/input"

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

interface AIInsight {
  type: "warning" | "success" | "tip"
  title: string
  description: string
}

interface UserGoals {
  goal: string
  targetCalories: number
  targetProtein: number
  targetCarbs: number
  targetFat: number
  strategy: string
}

interface UserProfile {
  age: number
  heightFt: number
  heightIn: number
  weightLb: number
  activityLevel: string
  goal: string
}

interface PatternInsight {
  id: string
  headline: string
  body: string
  tone: 'positive' | 'neutral' | 'curious'
  category: string
  confidence: number
}

export default function MyPathPage() {
  const router = useRouter()
  const { user, isLoaded, isSignedIn } = useUser()
  const [loading, setLoading] = useState(true)
  const [insights, setInsights] = useState<AIInsight[]>([])
  const [loadingInsights, setLoadingInsights] = useState(false)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [userTargets, setUserTargets] = useState<UserGoals | null>(null)
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [editedProfile, setEditedProfile] = useState<UserProfile | null>(null)
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([])
  const [stats, setStats] = useState<WeeklyStats | null>(null)
  const [loadingData, setLoadingData] = useState(true)
  const [patternInsights, setPatternInsights] = useState<PatternInsight[]>([])
  const [loadingPatterns, setLoadingPatterns] = useState(true)
  const [daysAnalyzed, setDaysAnalyzed] = useState(0)
  const [nutritionDNA, setNutritionDNA] = useState<{ trait: string; icon: string; color: string }[]>([])

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
        // Generate insights based on real data
        generateInsights(data.days || [])
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
      // First trigger pattern analysis
      const analyzeResponse = await fetch('/api/patterns/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, reanalyze: true })
      })

      if (analyzeResponse.ok) {
        const analyzeData = await analyzeResponse.json()
        setDaysAnalyzed(analyzeData.daysAnalyzed || 0)
      }

      // Then fetch all insights
      const response = await fetch(`/api/patterns/insights?userId=${user.id}&context=my-path&limit=10`)
      if (response.ok) {
        const data = await response.json()
        const insights = data.insights || []
        setPatternInsights(insights)

        // Derive nutrition DNA traits from insights
        const dnaTraits: { trait: string; icon: string; color: string }[] = []

        for (const insight of insights) {
          if (insight.category === 'success' && insight.headline.includes('game is strong')) {
            dnaTraits.push({ trait: insight.headline, icon: '💪', color: 'green' })
          } else if (insight.category === 'restaurant' && insight.headline.includes('your spot')) {
            dnaTraits.push({ trait: insight.headline, icon: '🏆', color: 'yellow' })
          } else if (insight.category === 'timing' && insight.headline.includes('dialed in')) {
            dnaTraits.push({ trait: insight.headline, icon: '⏰', color: 'blue' })
          } else if (insight.category === 'recovery' && insight.headline.includes('balance')) {
            dnaTraits.push({ trait: 'Natural balancer', icon: '⚖️', color: 'purple' })
          } else if (insight.headline.includes('Breakfast')) {
            dnaTraits.push({ trait: 'Morning momentum builder', icon: '🌅', color: 'orange' })
          }
        }

        setNutritionDNA(dnaTraits.slice(0, 4)) // Max 4 traits
      }
    } catch (error) {
      console.error('Failed to fetch pattern insights:', error)
    } finally {
      setLoadingPatterns(false)
    }
  }

  const generateInsights = (days: WeeklyData[]) => {
    setLoadingInsights(true)
    const newInsights: AIInsight[] = []

    // Analyze the data
    const daysWithData = days.filter(d => d.calories > 0)
    if (daysWithData.length === 0) {
      setInsights([{
        type: 'tip',
        title: 'Start logging meals',
        description: 'Log your meals to get personalized insights about your eating patterns.'
      }])
      setLoadingInsights(false)
      return
    }

    // Calculate averages
    const avgCalories = Math.round(daysWithData.reduce((sum, d) => sum + d.calories, 0) / daysWithData.length)
    const avgProtein = Math.round(daysWithData.reduce((sum, d) => sum + d.protein, 0) / daysWithData.length)
    const targetCalories = daysWithData[0]?.caloriesTarget || 2000
    const targetProtein = daysWithData[0]?.proteinTarget || 150

    // Check calorie consistency
    const calPercent = (avgCalories / targetCalories) * 100
    if (calPercent < 80) {
      newInsights.push({
        type: 'warning',
        title: 'Under eating',
        description: `You're averaging ${avgCalories} calories, which is ${Math.round(100 - calPercent)}% below your target. Consider adding more nutrient-dense foods.`
      })
    } else if (calPercent > 110) {
      newInsights.push({
        type: 'warning',
        title: 'Over target',
        description: `You're averaging ${avgCalories} calories, which is ${Math.round(calPercent - 100)}% above your target.`
      })
    } else {
      newInsights.push({
        type: 'success',
        title: 'Great calorie balance',
        description: `You're averaging ${avgCalories} calories, right on target. Keep it up!`
      })
    }

    // Check protein
    const protPercent = (avgProtein / targetProtein) * 100
    if (protPercent < 80) {
      newInsights.push({
        type: 'warning',
        title: 'Protein opportunity',
        description: `You're averaging ${avgProtein}g protein (${Math.round(protPercent)}% of target). Add protein sources like chicken, fish, eggs, or legumes.`
      })
    } else if (protPercent >= 90) {
      newInsights.push({
        type: 'success',
        title: 'Protein on point',
        description: `Great job hitting ${avgProtein}g protein on average! This supports your muscle and recovery goals.`
      })
    }

    // Check logging consistency
    if (daysWithData.length >= 6) {
      newInsights.push({
        type: 'success',
        title: 'Consistent logging',
        description: `You've logged ${daysWithData.length} out of 7 days this week. Consistency is key to progress!`
      })
    } else if (daysWithData.length <= 3) {
      newInsights.push({
        type: 'tip',
        title: 'Log more consistently',
        description: `You've only logged ${daysWithData.length} days this week. Try to log every meal for better insights.`
      })
    }

    // Check weekend vs weekday patterns
    const weekendDays = days.filter(d => d.dayName === 'Saturday' || d.dayName === 'Sunday')
    const weekdayDays = days.filter(d => d.dayName !== 'Saturday' && d.dayName !== 'Sunday')

    const weekendCals = weekendDays.filter(d => d.calories > 0)
    const weekdayCals = weekdayDays.filter(d => d.calories > 0)

    if (weekendCals.length > 0 && weekdayCals.length > 0) {
      const avgWeekend = weekendCals.reduce((sum, d) => sum + d.calories, 0) / weekendCals.length
      const avgWeekday = weekdayCals.reduce((sum, d) => sum + d.calories, 0) / weekdayCals.length

      if (avgWeekend < avgWeekday * 0.7) {
        newInsights.push({
          type: 'warning',
          title: 'Weekend patterns',
          description: `Your weekend calorie intake is ${Math.round((1 - avgWeekend/avgWeekday) * 100)}% lower than weekdays. Maintain consistency for best results.`
        })
      }
    }

    setInsights(newInsights.slice(0, 4)) // Max 4 insights
    setLoadingInsights(false)
  }

  const fetchUserProfile = async () => {
    if (!user?.id) return
    try {
      const response = await fetch(`/api/profile?userId=${user.id}`)
      if (response.ok) {
        const data = await response.json()
        if (data.profile) {
          setUserProfile({
            age: data.profile.age || 0,
            heightFt: data.profile.heightFt || 5,
            heightIn: data.profile.heightIn || 10,
            weightLb: data.profile.weightLb || 150,
            activityLevel: data.profile.stepsLevel || 'med',
            goal: data.profile.goal || 'maintain'
          })
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
      'cut': "We're keeping you in a caloric deficit with high protein to preserve muscle while losing fat. Focus on nutrient-dense foods.",
      'maintain': "We're balancing your calories to maintain your current weight while optimizing protein for body composition.",
      'lean_bulk': "We're keeping you in a slight surplus with high protein to build muscle while minimizing fat gain.",
      'recomp': "We're optimizing your nutrition to build muscle while staying lean. High protein with strategic calorie timing.",
      'bulk': "We're fueling your muscle growth with a caloric surplus and high protein to maximize gains."
    }
    return strategies[goal] || strategies['recomp']
  }

  const formatActivityLevel = (level: string) => {
    const levelMap: Record<string, string> = {
      'low': 'Low Activity',
      'med': 'Moderate Activity',
      'high': 'High Activity'
    }
    return levelMap[level] || 'Moderate Activity'
  }

  const handleSaveProfile = async () => {
    if (!user?.id || !editedProfile) return
    try {
      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          age: editedProfile.age,
          heightFt: editedProfile.heightFt,
          heightIn: editedProfile.heightIn,
          weightLb: editedProfile.weightLb,
          stepsLevel: editedProfile.activityLevel,
          goal: editedProfile.goal
        })
      })
      if (response.ok) {
        setUserProfile(editedProfile)
        setIsEditingProfile(false)
        fetchUserProfile() // Refresh to get updated targets
      }
    } catch (error) {
      console.error('Failed to save profile:', error)
    }
  }

  const startEditing = () => {
    setEditedProfile(userProfile)
    setIsEditingProfile(true)
  }

  const cancelEditing = () => {
    setEditedProfile(null)
    setIsEditingProfile(false)
  }

  // Use fetched userTargets or fallback
  const displayGoals = userTargets || {
    goal: "Build lean muscle",
    targetCalories: 2400,
    targetProtein: 150,
    targetCarbs: 250,
    targetFat: 65,
    strategy: "We're keeping you in a slight caloric surplus with high protein to support muscle growth while minimizing fat gain."
  }

  // Default stats if not loaded
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

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

  const getPatternToneStyles = (tone: 'positive' | 'neutral' | 'curious') => {
    switch (tone) {
      case 'positive':
        return { bg: 'bg-green-500/10', border: 'border-green-500/20', icon: 'text-green-500' }
      case 'curious':
        return { bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: 'text-amber-500' }
      case 'neutral':
      default:
        return { bg: 'bg-purple-500/10', border: 'border-purple-500/20', icon: 'text-purple-500' }
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

        {/* Your Nutrition DNA - shown when patterns exist */}
        {nutritionDNA.length > 0 && (
          <div className="bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-emerald-500/10 rounded-3xl p-8 border border-purple-500/20">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
                <span className="text-xl">🧬</span>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">Your Nutrition DNA</h2>
                <p className="text-sm text-muted-foreground">What makes you, you</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {nutritionDNA.map((trait, index) => {
                const colorClasses: Record<string, string> = {
                  green: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700',
                  yellow: 'bg-amber-500/10 border-amber-500/20 text-amber-700',
                  blue: 'bg-blue-500/10 border-blue-500/20 text-blue-700',
                  purple: 'bg-purple-500/10 border-purple-500/20 text-purple-700',
                  orange: 'bg-orange-500/10 border-orange-500/20 text-orange-700'
                }
                return (
                  <div
                    key={index}
                    className={`rounded-2xl p-4 border ${colorClasses[trait.color] || colorClasses.purple} text-center`}
                  >
                    <span className="text-2xl block mb-2">{trait.icon}</span>
                    <p className="text-sm font-medium">{trait.trait}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

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
            <h2 className="text-2xl font-semibold text-foreground mb-3">{displayGoals.goal}</h2>
            <p className="text-base text-muted-foreground leading-relaxed mb-6 flex-1">
              {displayGoals.strategy}
            </p>
            <div className="flex flex-wrap gap-3">
              <div className="bg-card/80 rounded-xl px-4 py-2 border border-border/50">
                <span className="text-lg font-semibold text-foreground">{displayGoals.targetCalories}</span>
                <span className="text-sm text-muted-foreground ml-1">cal/day</span>
              </div>
              <div className="bg-card/80 rounded-xl px-4 py-2 border border-border/50">
                <span className="text-lg font-semibold text-primary">{displayGoals.targetProtein}g</span>
                <span className="text-sm text-muted-foreground ml-1">protein/day</span>
              </div>
              <div className="bg-card/80 rounded-xl px-4 py-2 border border-border/50">
                <span className="text-lg font-semibold text-foreground">{displayGoals.targetCarbs}g</span>
                <span className="text-sm text-muted-foreground ml-1">carbs/day</span>
              </div>
              <div className="bg-card/80 rounded-xl px-4 py-2 border border-border/50">
                <span className="text-lg font-semibold text-foreground">{displayGoals.targetFat}g</span>
                <span className="text-sm text-muted-foreground ml-1">fat/day</span>
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

        {/* What I've Learned About You - Pattern Insights */}
        <div className="bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent rounded-3xl p-8 border border-purple-500/20">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-foreground">What I've Learned About You</h2>
                  <p className="text-sm text-muted-foreground">
                    {daysAnalyzed >= 7
                      ? `Based on ${daysAnalyzed} days of data`
                      : daysAnalyzed > 0
                        ? `${daysAnalyzed} days logged (need 7+ for patterns)`
                        : 'Patterns from your eating history'}
                  </p>
                </div>
              </div>
            </div>

            {loadingPatterns ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="rounded-xl p-4 bg-muted/20 animate-pulse">
                    <div className="h-4 w-2/3 bg-muted rounded mb-2" />
                    <div className="h-3 w-full bg-muted rounded" />
                  </div>
                ))}
              </div>
            ) : patternInsights.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {patternInsights.map((insight) => {
                  const styles = getPatternToneStyles(insight.tone)
                  return (
                    <div
                      key={insight.id}
                      className={`rounded-xl p-4 border ${styles.bg} ${styles.border} transition-all hover:scale-[1.02]`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 ${styles.icon}`}>
                          {insight.tone === 'positive' ? (
                            <CheckCircle className="h-5 w-5" />
                          ) : insight.tone === 'curious' ? (
                            <Lightbulb className="h-5 w-5" />
                          ) : (
                            <Sparkles className="h-5 w-5" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{insight.headline}</p>
                          <p className="text-sm text-muted-foreground mt-1">{insight.body}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Keep logging meals to discover your eating patterns!</p>
                <p className="text-xs text-muted-foreground/60 mt-2">We need at least 7 days of data to find patterns</p>
              </div>
            )}
        </div>

        {/* Personal Info Card */}
        {userProfile && (
          <div className="bg-card rounded-3xl p-8 border border-border/50">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
                  <User className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Personal Info</h2>
                  <p className="text-sm text-muted-foreground">Your profile details</p>
                </div>
              </div>
              {isEditingProfile ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={cancelEditing}
                    className="p-2 rounded-full hover:bg-muted transition-colors"
                  >
                    <X className="h-5 w-5 text-muted-foreground" />
                  </button>
                  <button
                    onClick={handleSaveProfile}
                    className="p-2 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors"
                  >
                    <Check className="h-5 w-5 text-primary" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={startEditing}
                  className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <Edit3 className="h-4 w-4" />
                  Edit
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {/* Age */}
              <div className="bg-muted/30 rounded-xl p-4">
                <p className="text-xs text-muted-foreground mb-1">Age</p>
                {isEditingProfile && editedProfile ? (
                  <Input
                    type="number"
                    value={editedProfile.age}
                    onChange={(e) => setEditedProfile({ ...editedProfile, age: parseInt(e.target.value) || 0 })}
                    className="h-8 text-lg font-semibold bg-background"
                  />
                ) : (
                  <p className="text-lg font-semibold text-foreground">{userProfile.age} yrs</p>
                )}
              </div>

              {/* Height */}
              <div className="bg-muted/30 rounded-xl p-4">
                <p className="text-xs text-muted-foreground mb-1">Height</p>
                {isEditingProfile && editedProfile ? (
                  <div className="flex gap-1">
                    <Input
                      type="number"
                      value={editedProfile.heightFt}
                      onChange={(e) => setEditedProfile({ ...editedProfile, heightFt: parseInt(e.target.value) || 0 })}
                      className="h-8 w-12 text-sm font-semibold bg-background"
                    />
                    <span className="text-sm self-center">'</span>
                    <Input
                      type="number"
                      value={editedProfile.heightIn}
                      onChange={(e) => setEditedProfile({ ...editedProfile, heightIn: parseInt(e.target.value) || 0 })}
                      className="h-8 w-12 text-sm font-semibold bg-background"
                    />
                    <span className="text-sm self-center">"</span>
                  </div>
                ) : (
                  <p className="text-lg font-semibold text-foreground">{userProfile.heightFt}'{userProfile.heightIn}"</p>
                )}
              </div>

              {/* Weight */}
              <div className="bg-muted/30 rounded-xl p-4">
                <p className="text-xs text-muted-foreground mb-1">Weight</p>
                {isEditingProfile && editedProfile ? (
                  <Input
                    type="number"
                    value={editedProfile.weightLb}
                    onChange={(e) => setEditedProfile({ ...editedProfile, weightLb: parseInt(e.target.value) || 0 })}
                    className="h-8 text-lg font-semibold bg-background"
                  />
                ) : (
                  <p className="text-lg font-semibold text-foreground">{userProfile.weightLb} lbs</p>
                )}
              </div>

              {/* Activity Level */}
              <div className="bg-muted/30 rounded-xl p-4">
                <p className="text-xs text-muted-foreground mb-1">Activity</p>
                {isEditingProfile && editedProfile ? (
                  <select
                    value={editedProfile.activityLevel}
                    onChange={(e) => setEditedProfile({ ...editedProfile, activityLevel: e.target.value })}
                    className="h-8 w-full text-sm font-semibold bg-background border rounded-md px-2"
                  >
                    <option value="low">Low</option>
                    <option value="med">Moderate</option>
                    <option value="high">High</option>
                  </select>
                ) : (
                  <p className="text-lg font-semibold text-foreground">{formatActivityLevel(userProfile.activityLevel)}</p>
                )}
              </div>

              {/* Goal */}
              <div className="bg-muted/30 rounded-xl p-4 col-span-2">
                <p className="text-xs text-muted-foreground mb-1">Goal</p>
                {isEditingProfile && editedProfile ? (
                  <select
                    value={editedProfile.goal}
                    onChange={(e) => setEditedProfile({ ...editedProfile, goal: e.target.value })}
                    className="h-8 w-full text-sm font-semibold bg-background border rounded-md px-2"
                  >
                    <option value="cut">Lose Fat</option>
                    <option value="maintain">Maintain Weight</option>
                    <option value="lean_bulk">Lean Bulk</option>
                    <option value="recomp">Build Lean Muscle</option>
                    <option value="bulk">Build Muscle</option>
                  </select>
                ) : (
                  <p className="text-lg font-semibold text-foreground">{formatGoal(userProfile.goal)}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="bg-card rounded-3xl p-6 border border-border/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                <Flame className="h-5 w-5 text-orange-500" />
              </div>
            </div>
            {loadingData ? (
              <div className="h-9 w-16 bg-muted rounded animate-pulse" />
            ) : (
              <p className="text-3xl font-bold text-foreground">{displayStats.currentStreak}</p>
            )}
            <p className="text-base text-muted-foreground mt-1">Day Streak</p>
          </div>

          <div className="bg-card rounded-3xl p-6 border border-border/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Target className="h-5 w-5 text-primary" />
              </div>
            </div>
            {loadingData ? (
              <div className="h-9 w-16 bg-muted rounded animate-pulse" />
            ) : (
              <p className="text-3xl font-bold text-foreground">{displayStats.daysOnTrack}/7</p>
            )}
            <p className="text-base text-muted-foreground mt-1">Days On Track</p>
          </div>

          <div className="bg-card rounded-3xl p-6 border border-border/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-blue-500" />
              </div>
            </div>
            {loadingData ? (
              <div className="h-9 w-16 bg-muted rounded animate-pulse" />
            ) : (
              <p className="text-3xl font-bold text-foreground">{displayStats.avgCalories}</p>
            )}
            <p className="text-base text-muted-foreground mt-1">Avg. Calories</p>
          </div>

          <div className="bg-card rounded-3xl p-6 border border-border/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-green-500" />
              </div>
            </div>
            {loadingData ? (
              <div className="h-9 w-16 bg-muted rounded animate-pulse" />
            ) : (
              <p className="text-3xl font-bold text-foreground">{displayStats.totalDaysLogged}</p>
            )}
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
          {weeklyData.length > 0 ? (
            <div className="flex items-end justify-between gap-4 h-64">
              {weeklyData.map((day) => {
                const maxCalories = Math.max(...weeklyData.map(d => Math.max(d.calories, d.caloriesTarget)))
                const height = maxCalories > 0 ? (day.calories / maxCalories) * 100 : 0
                const targetHeight = maxCalories > 0 ? (day.caloriesTarget / maxCalories) * 100 : 0
                const isOnTrack = day.calories >= day.caloriesTarget * 0.9 && day.calories <= day.caloriesTarget * 1.1

                return (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-3">
                    <div className="relative w-full flex justify-center" style={{ height: '200px' }}>
                      {/* Target line */}
                      <div
                        className="absolute w-full border-t-2 border-dashed border-muted"
                        style={{ bottom: `${targetHeight}%` }}
                      />
                      {/* Bar */}
                      <div
                        className={`w-full max-w-12 rounded-xl transition-all ${
                          day.calories === 0 ? 'bg-muted/30' : isOnTrack ? 'bg-primary' : 'bg-primary/60'
                        }`}
                        style={{ height: day.calories === 0 ? '4px' : `${height}%` }}
                      />
                    </div>
                    <div className="text-center">
                      <p className={`text-base font-medium ${day.isCurrent ? 'text-primary' : 'text-foreground'}`}>{day.label}</p>
                      <p className="text-sm text-muted-foreground">{day.calories > 0 ? day.calories : '-'}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center h-64">
              <p className="text-muted-foreground">No data yet. Start logging meals to see your progress.</p>
            </div>
          )}
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
                    strokeDasharray={`${displayStats.weeklyGoalHit * 2.64} 264`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl font-bold text-foreground">{displayStats.weeklyGoalHit}%</span>
                </div>
              </div>
            </div>
            <p className="text-center text-base text-muted-foreground">
              You hit your targets {displayStats.daysOnTrack} out of 7 days this week
            </p>
          </div>

          {/* Protein Tracking */}
          <div className="bg-card rounded-3xl p-8 border border-border/50">
            <h2 className="text-xl font-semibold text-foreground mb-6">Protein This Week</h2>
            {weeklyData.length > 0 ? (
              <div className="space-y-4">
                {weeklyData.map((day) => {
                  const proteinGoal = day.proteinTarget || displayStats.targetProtein
                  const percentage = proteinGoal > 0 ? Math.min(100, (day.protein / proteinGoal) * 100) : 0

                  return (
                    <div key={day.date} className="flex items-center gap-4">
                      <span className={`text-base font-medium w-10 ${day.isCurrent ? 'text-primary' : 'text-foreground'}`}>{day.label}</span>
                      <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground w-12 text-right">{day.protein > 0 ? `${day.protein}g` : '-'}</span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center py-8">
                <p className="text-muted-foreground">No protein data yet</p>
              </div>
            )}
            <p className="text-center text-base text-muted-foreground mt-6">
              Avg: {displayStats.avgProtein}g / day
            </p>
          </div>
        </div>

        {/* Milestones */}
        <div className="bg-card rounded-3xl p-8 border border-border/50">
          <h2 className="text-xl font-semibold text-foreground mb-6">Milestones</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center p-4 rounded-2xl bg-muted/30">
              {loadingData ? (
                <div className="h-8 w-12 bg-muted rounded animate-pulse mx-auto" />
              ) : (
                <p className="text-2xl font-bold text-primary">{displayStats.longestStreak}</p>
              )}
              <p className="text-sm text-muted-foreground mt-1">Longest Streak</p>
            </div>
            <div className="text-center p-4 rounded-2xl bg-muted/30">
              {loadingData ? (
                <div className="h-8 w-12 bg-muted rounded animate-pulse mx-auto" />
              ) : (
                <p className="text-2xl font-bold text-primary">{displayStats.totalDaysLogged}</p>
              )}
              <p className="text-sm text-muted-foreground mt-1">Total Days</p>
            </div>
            <div className="text-center p-4 rounded-2xl bg-muted/30">
              {loadingData ? (
                <div className="h-8 w-12 bg-muted rounded animate-pulse mx-auto" />
              ) : (
                <p className="text-2xl font-bold text-primary">{Math.round(displayStats.avgProtein * displayStats.totalDaysLogged / 1000)}kg</p>
              )}
              <p className="text-sm text-muted-foreground mt-1">Protein Eaten</p>
            </div>
            <div className="text-center p-4 rounded-2xl bg-muted/30">
              {loadingData ? (
                <div className="h-8 w-12 bg-muted rounded animate-pulse mx-auto" />
              ) : (
                <p className="text-2xl font-bold text-primary">{Math.round(displayStats.avgCalories * displayStats.totalDaysLogged / 1000)}k</p>
              )}
              <p className="text-sm text-muted-foreground mt-1">Calories Logged</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
