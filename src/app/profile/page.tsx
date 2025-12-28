"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUser, SignOutButton } from "@clerk/nextjs"
import {
  Target, Flame, Calendar, TrendingUp, Utensils,
  Moon, Dumbbell, Droplets, Brain, Heart, Settings,
  ChevronRight, Sparkles
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

    // Sleep recommendation based on goal
    if (profile.goal === 'cut' || profile.goal === 'recomp') {
      tips.push({
        icon: Moon,
        title: "Prioritize 7-9 Hours of Sleep",
        description: "Sleep is crucial for fat loss and muscle preservation. Poor sleep increases cortisol and hunger hormones, making it harder to stick to your deficit.",
        color: "purple"
      })
    } else {
      tips.push({
        icon: Moon,
        title: "Sleep for Recovery",
        description: "Aim for 7-9 hours. Growth hormone is released during deep sleep, essential for muscle repair and growth.",
        color: "purple"
      })
    }

    // Training recommendation based on lifting days
    if (profile.liftingDays >= 4) {
      tips.push({
        icon: Dumbbell,
        title: "Progressive Overload",
        description: `With ${profile.liftingDays} lifting days, focus on gradually increasing weight or reps each week. Track your lifts to ensure consistent progress.`,
        color: "orange"
      })
    } else if (profile.liftingDays >= 2) {
      tips.push({
        icon: Dumbbell,
        title: "Full Body Focus",
        description: `With ${profile.liftingDays} days, prioritize compound movements (squats, deadlifts, bench, rows) to maximize muscle stimulation per session.`,
        color: "orange"
      })
    } else {
      tips.push({
        icon: Dumbbell,
        title: "Consider Adding Resistance Training",
        description: "Even 2-3 days of lifting can significantly improve body composition and metabolic health.",
        color: "orange"
      })
    }

    // Hydration
    const waterOz = Math.round(profile.weightLb * 0.5)
    tips.push({
      icon: Droplets,
      title: `Aim for ${waterOz}+ oz Water Daily`,
      description: "Proper hydration supports metabolism, workout performance, and helps control appetite. Drink more on training days.",
      color: "blue"
    })

    // Protein timing
    tips.push({
      icon: Brain,
      title: "Spread Protein Throughout the Day",
      description: `With a ${Math.round(profile.weightLb * 0.8)}g target, aim for 30-50g per meal. This optimizes muscle protein synthesis better than one large dose.`,
      color: "green"
    })

    // Steps/NEAT based on activity level
    if (profile.stepsLevel === 'low') {
      tips.push({
        icon: Heart,
        title: "Increase Daily Movement",
        description: "Try to add 2,000-3,000 more steps daily. NEAT (non-exercise activity) is a major factor in maintaining a healthy metabolism.",
        color: "red"
      })
    } else if (profile.stepsLevel === 'high') {
      tips.push({
        icon: Heart,
        title: "Great Activity Level",
        description: "Your high step count supports calorie burn and cardiovascular health. Just ensure you're fueling adequately for recovery.",
        color: "red"
      })
    } else {
      tips.push({
        icon: Heart,
        title: "Maintain Your Activity",
        description: "Your moderate activity is solid. Consider a daily walk after meals to aid digestion and boost NEAT.",
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
      <main className="mx-auto max-w-4xl px-6 py-10 space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-semibold text-primary">
              {user?.firstName?.charAt(0) || user?.emailAddresses?.[0]?.emailAddress?.charAt(0) || 'U'}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {user?.firstName || 'Your Profile'}
              </h1>
              <p className="text-sm text-muted-foreground">{user?.emailAddresses?.[0]?.emailAddress}</p>
            </div>
          </div>
          <button
            onClick={() => router.push('/onboarding')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted/50 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
          >
            <Settings className="h-4 w-4" />
            Edit Goals
          </button>
        </div>

        {/* Goal Card */}
        <div className="bg-card rounded-2xl p-6 border border-border/50">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Target className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">{displayGoals.goal}</h2>
                <p className="text-sm text-muted-foreground">{displayGoals.strategy}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div className="text-center p-4 rounded-xl bg-muted/30">
              <p className="text-2xl font-bold text-foreground">{displayGoals.targetCalories}</p>
              <p className="text-xs text-muted-foreground">Cal/day</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-primary/10">
              <p className="text-2xl font-bold text-primary">{displayGoals.targetProtein}g</p>
              <p className="text-xs text-muted-foreground">Protein</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-muted/30">
              <p className="text-2xl font-bold text-foreground">{displayGoals.targetCarbs}g</p>
              <p className="text-xs text-muted-foreground">Carbs</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-muted/30">
              <p className="text-2xl font-bold text-foreground">{displayGoals.targetFat}g</p>
              <p className="text-xs text-muted-foreground">Fat</p>
            </div>
          </div>
        </div>

        {/* Milestones */}
        <div className="bg-card rounded-2xl p-6 border border-border/50">
          <h3 className="font-semibold text-foreground mb-4">Your Milestones</h3>
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

        {/* Personalized Plan */}
        <div className="bg-card rounded-2xl p-6 border border-border/50">
          <div className="flex items-center gap-2 mb-5">
            <Sparkles className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">Your Personalized Plan</h3>
          </div>

          {loadingPlan ? (
            <div className="text-center py-8">
              <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
            </div>
          ) : (
            <div className="space-y-4">
              {personalizedPlan.map((tip, index) => {
                const Icon = tip.icon
                const colors = colorClasses[tip.color] || colorClasses.blue
                return (
                  <div
                    key={index}
                    className={`rounded-xl p-4 border ${colors.split(' ')[2]} bg-gradient-to-r ${colors.split(' ')[0]} to-transparent`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`h-10 w-10 rounded-lg ${colors.split(' ')[0]} flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`h-5 w-5 ${colors.split(' ')[1]}`} />
                      </div>
                      <div>
                        <h4 className="font-medium text-foreground mb-1">{tip.title}</h4>
                        <p className="text-sm text-muted-foreground">{tip.description}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Quick Stats */}
        {userProfile && (
          <div className="bg-card rounded-2xl p-6 border border-border/50">
            <h3 className="font-semibold text-foreground mb-4">Your Stats</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 rounded-xl bg-muted/30">
                <p className="text-lg font-bold text-foreground">{userProfile.age}</p>
                <p className="text-xs text-muted-foreground">Age</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-muted/30">
                <p className="text-lg font-bold text-foreground">{userProfile.heightFt}'{userProfile.heightIn}"</p>
                <p className="text-xs text-muted-foreground">Height</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-muted/30">
                <p className="text-lg font-bold text-foreground">{userProfile.weightLb} lbs</p>
                <p className="text-xs text-muted-foreground">Weight</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-muted/30">
                <p className="text-lg font-bold text-foreground">{userProfile.liftingDays}x</p>
                <p className="text-xs text-muted-foreground">Lifting/week</p>
              </div>
            </div>
          </div>
        )}

        {/* Sign Out */}
        <div className="flex justify-center">
          <SignOutButton>
            <button className="text-sm text-muted-foreground hover:text-red-500 transition-colors">
              Sign Out
            </button>
          </SignOutButton>
        </div>

      </main>
    </div>
  )
}
