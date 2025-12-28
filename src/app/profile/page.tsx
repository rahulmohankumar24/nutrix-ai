"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUser, SignOutButton } from "@clerk/nextjs"
import {
  Target, Flame, Calendar, TrendingUp, Utensils,
  Moon, Dumbbell, Droplets, Brain, Heart, Settings,
  Send, Sparkles, ChevronRight
} from "lucide-react"

interface UserGoals {
  goal: string
  goalKey: string
  targetCalories: number
  targetProtein: number
  targetCarbs: number
  targetFat: number
  strategy: string
}

interface UserProfile {
  sex: string
  age: number
  heightFt: number
  heightIn: number
  weightLb: number
  liftingDays: number
  stepsLevel: string
}

interface Stats {
  currentStreak: number
  longestStreak: number
  totalDaysLogged: number
  avgCalories: number
  avgProtein: number
}

interface PersonalizedTip {
  icon: typeof Moon
  title: string
  description: string
  color: string
}

export default function ProfilePage() {
  const router = useRouter()
  const { user, isLoaded, isSignedIn } = useUser()
  const [loading, setLoading] = useState(true)
  const [userGoals, setUserGoals] = useState<UserGoals | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [personalizedPlan, setPersonalizedPlan] = useState<PersonalizedTip[]>([])
  const [loadingPlan, setLoadingPlan] = useState(false)
  const [chatInput, setChatInput] = useState("")
  const [chatLoading, setChatLoading] = useState(false)
  const [chatMessage, setChatMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) {
      router.push('/auth/signin')
      return
    }
    setLoading(false)
    if (user?.id) {
      fetchUserData()
      fetchStats()
    }
  }, [isLoaded, isSignedIn, router, user?.id])

  const fetchUserData = async () => {
    if (!user?.id) return
    try {
      const response = await fetch(`/api/profile?userId=${user.id}`)
      if (response.ok) {
        const data = await response.json()
        if (data.profile) {
          setUserProfile({
            sex: data.profile.sex,
            age: data.profile.age,
            heightFt: data.profile.heightFt,
            heightIn: data.profile.heightIn,
            weightLb: data.profile.weightLb,
            liftingDays: data.profile.liftingDays,
            stepsLevel: data.profile.stepsLevel
          })
          setUserGoals({
            goal: formatGoal(data.profile.goal),
            goalKey: data.profile.goal,
            targetCalories: data.targets?.calories || 2000,
            targetProtein: data.targets?.protein || 150,
            targetCarbs: data.targets?.carbs || 250,
            targetFat: data.targets?.fat || 65,
            strategy: getGoalStrategy(data.profile.goal)
          })
          generatePersonalizedPlan(data.profile)
        }
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error)
    }
  }

  const fetchStats = async () => {
    if (!user?.id) return
    try {
      const response = await fetch(`/api/weekly-stats?userId=${user.id}`)
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    }
  }

  const handleMacroChat = async () => {
    if (!chatInput.trim() || !user?.id || !userGoals) return

    setChatLoading(true)
    setChatMessage(null)

    try {
      const response = await fetch('/api/adjust-macros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          message: chatInput,
          currentTargets: {
            calories: userGoals.targetCalories,
            protein: userGoals.targetProtein,
            carbs: userGoals.targetCarbs,
            fat: userGoals.targetFat
          }
        })
      })

      if (response.ok) {
        const data = await response.json()
        if (data.newTargets) {
          setUserGoals(prev => prev ? {
            ...prev,
            targetCalories: data.newTargets.calories,
            targetProtein: data.newTargets.protein,
            targetCarbs: data.newTargets.carbs,
            targetFat: data.newTargets.fat
          } : null)
          setChatMessage(data.message || "Targets updated!")
        }
      } else {
        setChatMessage("Couldn't understand that. Try something like 'increase protein by 20g'")
      }
    } catch (error) {
      setChatMessage("Something went wrong. Please try again.")
    } finally {
      setChatLoading(false)
      setChatInput("")
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
      'cut': "Caloric deficit with high protein to preserve muscle mass.",
      'maintain': "Balanced nutrition to maintain your current physique.",
      'lean_bulk': "Slight caloric surplus with high protein for lean gains.",
      'recomp': "Optimized nutrition to build muscle while staying lean.",
      'bulk': "Caloric surplus with high protein to maximize muscle growth."
    }
    return strategies[goal] || strategies['recomp']
  }

  const generatePersonalizedPlan = (profile: any) => {
    setLoadingPlan(true)
    const tips: PersonalizedTip[] = []

    if (profile.goal === 'cut' || profile.goal === 'recomp') {
      tips.push({
        icon: Moon,
        title: "Prioritize 7-9 Hours of Sleep",
        description: "Sleep is crucial for fat loss and muscle preservation. Poor sleep increases cortisol and hunger hormones.",
        color: "purple"
      })
    } else {
      tips.push({
        icon: Moon,
        title: "Sleep for Recovery",
        description: "Aim for 7-9 hours. Growth hormone is released during deep sleep, essential for muscle repair.",
        color: "purple"
      })
    }

    if (profile.liftingDays >= 4) {
      tips.push({
        icon: Dumbbell,
        title: "Progressive Overload",
        description: `With ${profile.liftingDays} lifting days, focus on gradually increasing weight or reps each week.`,
        color: "orange"
      })
    } else if (profile.liftingDays >= 2) {
      tips.push({
        icon: Dumbbell,
        title: "Full Body Focus",
        description: `With ${profile.liftingDays} days, prioritize compound movements to maximize muscle stimulation.`,
        color: "orange"
      })
    } else {
      tips.push({
        icon: Dumbbell,
        title: "Add Resistance Training",
        description: "Even 2-3 days of lifting can significantly improve body composition.",
        color: "orange"
      })
    }

    const waterOz = Math.round(profile.weightLb * 0.5)
    tips.push({
      icon: Droplets,
      title: `${waterOz}+ oz Water Daily`,
      description: "Proper hydration supports metabolism, workout performance, and appetite control.",
      color: "blue"
    })

    tips.push({
      icon: Brain,
      title: "Spread Protein Throughout Day",
      description: "Aim for 30-50g per meal to optimize muscle protein synthesis.",
      color: "green"
    })

    if (profile.stepsLevel === 'low') {
      tips.push({
        icon: Heart,
        title: "Increase Daily Movement",
        description: "Add 2,000-3,000 more steps. NEAT is key for metabolism.",
        color: "red"
      })
    } else if (profile.stepsLevel === 'high') {
      tips.push({
        icon: Heart,
        title: "Great Activity Level",
        description: "Your step count supports calorie burn. Ensure adequate fueling.",
        color: "red"
      })
    } else {
      tips.push({
        icon: Heart,
        title: "Maintain Your Activity",
        description: "Consider a daily walk after meals to boost NEAT.",
        color: "red"
      })
    }

    setPersonalizedPlan(tips)
    setLoadingPlan(false)
  }

  const displayGoals = userGoals || {
    goal: "Build Lean Muscle",
    goalKey: "recomp",
    targetCalories: 2400,
    targetProtein: 150,
    targetCarbs: 250,
    targetFat: 65,
    strategy: "Optimized nutrition to build muscle while staying lean."
  }

  const displayStats = stats || {
    currentStreak: 0,
    longestStreak: 0,
    totalDaysLogged: 0,
    avgCalories: 0,
    avgProtein: 0
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  const colorClasses: Record<string, string> = {
    purple: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    orange: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    blue: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    green: "bg-green-500/10 text-green-500 border-green-500/20",
    red: "bg-red-500/10 text-red-500 border-red-500/20"
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-4xl px-6 py-10 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-xl font-semibold text-primary">
              {user?.firstName?.charAt(0) || user?.emailAddresses?.[0]?.emailAddress?.charAt(0) || 'U'}
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">
                {user?.firstName || 'Profile'}
              </h1>
              <p className="text-sm text-muted-foreground">{user?.emailAddresses?.[0]?.emailAddress}</p>
            </div>
          </div>
          <SignOutButton>
            <button className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Sign Out
            </button>
          </SignOutButton>
        </div>

        {/* Your Plan - Personalized Tips */}
        <div className="bg-card rounded-2xl p-5 border border-border/50">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-foreground">Your Plan</h2>
          </div>

          {loadingPlan ? (
            <div className="text-center py-6">
              <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {personalizedPlan.map((tip, index) => {
                const Icon = tip.icon
                const colors = colorClasses[tip.color] || colorClasses.blue
                return (
                  <div
                    key={index}
                    className={`rounded-xl p-3 border ${colors.split(' ')[2]} ${colors.split(' ')[0]}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`h-8 w-8 rounded-lg ${colors.split(' ')[0]} flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`h-4 w-4 ${colors.split(' ')[1]}`} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-medium text-foreground text-sm">{tip.title}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{tip.description}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Daily Targets with Chat */}
        <div className="bg-card rounded-2xl p-5 border border-border/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">{displayGoals.goal}</h2>
                <p className="text-xs text-muted-foreground">{displayGoals.strategy}</p>
              </div>
            </div>
            <button
              onClick={() => router.push('/onboarding')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
            >
              <Settings className="h-3.5 w-3.5" />
              Edit
            </button>
          </div>

          {/* Macro Grid */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            <div className="text-center p-3 rounded-xl bg-muted/30">
              <p className="text-xl font-bold text-foreground">{displayGoals.targetCalories}</p>
              <p className="text-xs text-muted-foreground">Calories</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-primary/10">
              <p className="text-xl font-bold text-primary">{displayGoals.targetProtein}g</p>
              <p className="text-xs text-muted-foreground">Protein</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-muted/30">
              <p className="text-xl font-bold text-foreground">{displayGoals.targetCarbs}g</p>
              <p className="text-xs text-muted-foreground">Carbs</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-muted/30">
              <p className="text-xl font-bold text-foreground">{displayGoals.targetFat}g</p>
              <p className="text-xs text-muted-foreground">Fat</p>
            </div>
          </div>

          {/* Chat Input for Adjustments */}
          <div className="relative">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleMacroChat()}
              placeholder="Adjust targets... e.g. 'increase protein by 20g'"
              className="w-full px-4 py-3 pr-12 rounded-xl bg-muted/30 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
              disabled={chatLoading}
            />
            <button
              onClick={handleMacroChat}
              disabled={chatLoading || !chatInput.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20 disabled:opacity-50 transition-all"
            >
              {chatLoading ? (
                <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>

          {chatMessage && (
            <p className="text-xs text-muted-foreground mt-2 text-center">{chatMessage}</p>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* Milestones */}
          <div className="bg-card rounded-2xl p-5 border border-border/50">
            <h3 className="font-semibold text-foreground text-sm mb-3">Milestones</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Flame className="h-4 w-4 text-orange-500" />
                  <span className="text-sm text-muted-foreground">Best Streak</span>
                </div>
                <span className="font-semibold text-foreground">{displayStats.longestStreak} days</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span className="text-sm text-muted-foreground">Days Logged</span>
                </div>
                <span className="font-semibold text-foreground">{displayStats.totalDaysLogged}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-muted-foreground">Protein Eaten</span>
                </div>
                <span className="font-semibold text-foreground">{Math.round(displayStats.avgProtein * displayStats.totalDaysLogged / 1000)}kg</span>
              </div>
            </div>
          </div>

          {/* Body Stats */}
          {userProfile && (
            <div className="bg-card rounded-2xl p-5 border border-border/50">
              <h3 className="font-semibold text-foreground text-sm mb-3">Your Stats</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Age</span>
                  <span className="font-semibold text-foreground">{userProfile.age}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Height</span>
                  <span className="font-semibold text-foreground">{userProfile.heightFt}'{userProfile.heightIn}"</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Weight</span>
                  <span className="font-semibold text-foreground">{userProfile.weightLb} lbs</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Lifting</span>
                  <span className="font-semibold text-foreground">{userProfile.liftingDays}x/week</span>
                </div>
              </div>
            </div>
          )}
        </div>

      </main>
    </div>
  )
}
