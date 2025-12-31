"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUser, SignOutButton } from "@clerk/nextjs"
import {
  Target, Flame, Calendar, TrendingUp,
  Moon, Dumbbell, Droplets, Brain, Heart, Settings,
  Send, Sparkles, ChevronRight, Crown, Loader2, Trash2,
  ChevronLeft, Plus, Pencil, Check, X, Clock
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

interface MealLogEntry {
  id: string
  datetime: string
  servings: number
  mealType?: string
  orderTemplate?: {
    id: string
    title: string
    restaurantBrand: string
    calories: number
    protein: number
    carbs: number
    fat: number
  }
  foodCatalogItem?: {
    id: string
    name: string
    source: string
    calories: number
    protein: number
    carbs: number
    fat: number
  }
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
  const [isPro, setIsPro] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Meal History state
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  })
  const [mealLogs, setMealLogs] = useState<MealLogEntry[]>([])
  const [loadingMeals, setLoadingMeals] = useState(false)
  const [addingMeal, setAddingMeal] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack' | null>(null)
  const [newMealInput, setNewMealInput] = useState('')
  const [savingMeal, setSavingMeal] = useState(false)
  const [editingMeal, setEditingMeal] = useState<{ id: string; calories: string; protein: string } | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)

  // Favorites state
  interface FavoriteMeal {
    id: string
    name: string
    description?: string
    source: string
    restaurant?: string
    calories: number
    protein: number
    carbs: number
    fat: number
  }
  const [favoriteMeals, setFavoriteMeals] = useState<FavoriteMeal[]>([])
  const [favoritedMealKeys, setFavoritedMealKeys] = useState<Set<string>>(new Set())
  const [togglingFavorite, setTogglingFavorite] = useState<string | null>(null)
  const [loadingFavorites, setLoadingFavorites] = useState(false)

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
      loadFavorites()
    }
  }, [isLoaded, isSignedIn, router, user?.id])

  const loadFavorites = async () => {
    if (!user?.id) return
    setLoadingFavorites(true)
    try {
      const res = await fetch(`/api/favorites?userId=${user.id}`)
      if (res.ok) {
        const data = await res.json()
        setFavoriteMeals(data.favorites)
        const keys = new Set<string>()
        data.favorites.forEach((fav: FavoriteMeal) => {
          keys.add(`${fav.name}|${fav.restaurant || ''}`)
        })
        setFavoritedMealKeys(keys)
      }
    } catch (error) {
      console.error('Failed to load favorites:', error)
    } finally {
      setLoadingFavorites(false)
    }
  }

  const toggleFavorite = async (meal: { id: string; name: string; calories: number; protein: number; carbs: number; fat: number; restaurant?: string; source: string }) => {
    if (!user?.id || togglingFavorite) return

    const mealKey = `${meal.name}|${meal.restaurant || ''}`
    const isFavorited = favoritedMealKeys.has(mealKey)

    setTogglingFavorite(meal.id)

    try {
      if (isFavorited) {
        await fetch(`/api/favorites?userId=${user.id}&name=${encodeURIComponent(meal.name)}&restaurant=${encodeURIComponent(meal.restaurant || '')}`, {
          method: 'DELETE'
        })
        setFavoritedMealKeys(prev => {
          const next = new Set(prev)
          next.delete(mealKey)
          return next
        })
        setFavoriteMeals(prev => prev.filter(f => !(f.name === meal.name && f.restaurant === meal.restaurant)))
      } else {
        const res = await fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            name: meal.name,
            source: meal.source,
            restaurant: meal.restaurant || null,
            calories: meal.calories,
            protein: meal.protein,
            carbs: meal.carbs,
            fat: meal.fat
          })
        })
        if (res.ok) {
          const data = await res.json()
          if (data.favorite && !data.alreadyExists) {
            setFavoriteMeals(prev => [data.favorite, ...prev])
          }
          setFavoritedMealKeys(prev => new Set([...prev, mealKey]))
        }
      }
    } catch (error) {
      console.error('Failed to toggle favorite:', error)
    } finally {
      setTogglingFavorite(null)
    }
  }

  const fetchUserData = async () => {
    if (!user?.id) return
    try {
      const response = await fetch(`/api/profile?userId=${user.id}`, { cache: 'no-store' })
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
          setIsPro(data.profile.isPro || false)
          generatePersonalizedPlan(data.profile)
        }
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error)
    }
  }

  const handleManageSubscription = async () => {
    setPortalLoading(true)
    try {
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
      })
      if (response.ok) {
        const { url } = await response.json()
        window.location.href = url
      }
    } catch (error) {
      console.error('Failed to open portal:', error)
    } finally {
      setPortalLoading(false)
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

  // Fetch meal logs for selected date
  const fetchMealLogs = async (date: string) => {
    if (!user?.id) return
    setLoadingMeals(true)
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      const response = await fetch(
        `/api/log-meal?userId=${user.id}&date=${date}&timezone=${encodeURIComponent(timezone)}`
      )
      if (response.ok) {
        const data = await response.json()
        setMealLogs(data.mealLogs || [])
      }
    } catch (error) {
      console.error('Failed to fetch meal logs:', error)
    } finally {
      setLoadingMeals(false)
    }
  }

  // Effect to load meals when date changes
  useEffect(() => {
    if (user?.id && selectedDate) {
      fetchMealLogs(selectedDate)
    }
  }, [user?.id, selectedDate])

  // Navigate date
  const changeDate = (days: number) => {
    const current = new Date(selectedDate)
    current.setDate(current.getDate() + days)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    // Don't allow future dates
    if (current <= today) {
      setSelectedDate(current.toISOString().split('T')[0])
    }
  }

  // Format date for display
  const formatDisplayDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00')
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (dateStr === today.toISOString().split('T')[0]) return 'Today'
    if (dateStr === yesterday.toISOString().split('T')[0]) return 'Yesterday'

    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  // Add a new meal via chat
  const handleAddMeal = async () => {
    if (!newMealInput.trim() || !user?.id || !addingMeal) return
    setSavingMeal(true)
    try {
      // First, parse the meal via chat-log-meal
      const parseResponse = await fetch('/api/chat-log-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          message: newMealInput,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        })
      })

      if (parseResponse.ok) {
        const parseData = await parseResponse.json()
        if (parseData.meal) {
          // Log the meal with the selected date and meal type
          const logResponse = await fetch('/api/log-meal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.id,
              foodCatalogItemId: parseData.meal.id || parseData.foodCatalogItemId,
              servings: 1,
              mealType: addingMeal
            })
          })

          if (logResponse.ok) {
            // Refresh meal logs
            await fetchMealLogs(selectedDate)
            setNewMealInput('')
            setAddingMeal(null)
          }
        }
      }
    } catch (error) {
      console.error('Failed to add meal:', error)
    } finally {
      setSavingMeal(false)
    }
  }

  // Save edited meal
  const handleSaveEdit = async () => {
    if (!editingMeal || !user?.id) return
    setSavingEdit(true)
    try {
      // Find the meal to get the foodCatalogItemId
      const meal = mealLogs.find(m => m.id === editingMeal.id)
      if (meal?.foodCatalogItem?.id) {
        await fetch('/api/food-catalog', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            foodCatalogItemId: meal.foodCatalogItem.id,
            calories: editingMeal.calories === '' ? 0 : parseInt(editingMeal.calories) || 0,
            protein: editingMeal.protein === '' ? 0 : parseInt(editingMeal.protein) || 0
          })
        })
        await fetchMealLogs(selectedDate)
      }
      setEditingMeal(null)
    } catch (error) {
      console.error('Failed to save edit:', error)
    } finally {
      setSavingEdit(false)
    }
  }

  // Delete a meal log
  const handleDeleteMeal = async (mealLogId: string) => {
    if (!user?.id) return
    try {
      const response = await fetch(
        `/api/log-meal?mealLogId=${mealLogId}&userId=${user.id}`,
        { method: 'DELETE' }
      )
      if (response.ok) {
        await fetchMealLogs(selectedDate)
      }
    } catch (error) {
      console.error('Failed to delete meal:', error)
    }
  }

  // Get meals by type
  const getMealsByType = (type: string) => {
    return mealLogs.filter(meal => meal.mealType === type)
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
          },
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
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
    purple: "bg-sky-500/10 text-sky-500 border-sky-500/20",
    orange: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    blue: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    green: "bg-green-500/10 text-green-500 border-green-500/20",
    red: "bg-red-500/10 text-red-500 border-red-500/20"
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-4xl px-6 py-10 space-y-6">

        {/* Header with User and Pro Status Side by Side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* User Card */}
          <div className="bg-card rounded-2xl p-5 border border-border/50">
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
                <button className="text-sm text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg bg-muted/50 hover:bg-muted border border-border/50 transition-all">
                  Sign Out
                </button>
              </SignOutButton>
            </div>
          </div>

          {/* Pro Status Card */}
          {isPro ? (
            <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-2xl p-5 border border-amber-500/30">
              <div className="flex items-center justify-between h-full">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                    <Crown className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Rovia Pro</h2>
                    <p className="text-sm text-muted-foreground">All features unlocked</p>
                  </div>
                </div>
                <button
                  onClick={handleManageSubscription}
                  disabled={portalLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-background/50 border border-amber-500/30 text-sm font-medium text-foreground hover:bg-background transition-colors disabled:opacity-50"
                >
                  {portalLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Settings className="h-4 w-4" />
                      Manage
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => router.push('/pro')}
              className="bg-gradient-to-br from-amber-500/15 to-orange-500/15 rounded-2xl p-5 border border-amber-500/40 hover:border-amber-500/60 hover:from-amber-500/20 hover:to-orange-500/20 transition-all text-left group"
            >
              <div className="flex items-center justify-between h-full">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-amber-500/30 to-orange-500/30 flex items-center justify-center group-hover:from-amber-500 group-hover:to-orange-500 transition-all">
                    <Crown className="h-7 w-7 text-amber-600 group-hover:text-white transition-colors" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Upgrade to Pro</h2>
                    <p className="text-sm text-amber-600/80">Unlock AI coach, insights & more</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-amber-600">$9.99/mo</span>
                  <ChevronRight className="h-5 w-5 text-amber-500 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </button>
          )}
        </div>

        {/* Meal History Section */}
        <div className="bg-card rounded-2xl p-5 border border-border/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Meal History</h2>
                <p className="text-xs text-muted-foreground">View and edit past meals</p>
              </div>
            </div>
          </div>

          {/* Date Navigator */}
          <div className="flex items-center justify-center gap-4 mb-5">
            <button
              onClick={() => changeDate(-1)}
              className="h-9 w-9 rounded-lg bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors"
            >
              <ChevronLeft className="h-5 w-5 text-muted-foreground" />
            </button>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="font-medium text-foreground min-w-[120px] text-center">
                {formatDisplayDate(selectedDate)}
              </span>
            </div>
            <button
              onClick={() => changeDate(1)}
              disabled={selectedDate === new Date().toISOString().split('T')[0]}
              className="h-9 w-9 rounded-lg bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>

          {/* Meal Sections */}
          {loadingMeals ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((mealType) => {
                const meals = getMealsByType(mealType)
                const isAdding = addingMeal === mealType

                return (
                  <div key={mealType} className="rounded-xl border border-border/50 overflow-hidden">
                    {/* Meal Type Header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
                      <span className="text-sm font-medium text-foreground capitalize">{mealType}</span>
                      <button
                        onClick={() => setAddingMeal(isAdding ? null : mealType)}
                        className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add
                      </button>
                    </div>

                    {/* Add Meal Input */}
                    {isAdding && (
                      <div className="px-4 py-3 border-b border-border/50 bg-primary/5">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={newMealInput}
                            onChange={(e) => setNewMealInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddMeal()}
                            placeholder={`What did you have for ${mealType}?`}
                            className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                            autoFocus
                          />
                          <button
                            onClick={handleAddMeal}
                            disabled={savingMeal || !newMealInput.trim()}
                            className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center text-primary-foreground disabled:opacity-50"
                          >
                            {savingMeal ? (
                              <div className="h-4 w-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            onClick={() => { setAddingMeal(null); setNewMealInput('') }}
                            className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Meal List */}
                    <div className="divide-y divide-border/30">
                      {meals.length === 0 ? (
                        <div className="px-4 py-4 text-center">
                          <p className="text-sm text-muted-foreground/60">No {mealType} logged</p>
                        </div>
                      ) : (
                        meals.map((meal) => {
                          const item = meal.orderTemplate || meal.foodCatalogItem
                          if (!item) return null

                          const name = 'title' in item ? item.title : item.name
                          const isEditing = editingMeal?.id === meal.id

                          return (
                            <div key={meal.id} className="px-4 py-3 flex items-center gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">{name}</p>
                                {isEditing ? (
                                  <div className="flex items-center gap-2 mt-1">
                                    <input
                                      type="text"
                                      value={editingMeal.calories}
                                      onChange={(e) => setEditingMeal({ ...editingMeal, calories: e.target.value })}
                                      placeholder="cal"
                                      className="w-16 px-2 py-1 rounded bg-muted border border-border text-xs text-foreground"
                                    />
                                    <span className="text-xs text-muted-foreground">cal</span>
                                    <input
                                      type="text"
                                      value={editingMeal.protein}
                                      onChange={(e) => setEditingMeal({ ...editingMeal, protein: e.target.value })}
                                      placeholder="pro"
                                      className="w-16 px-2 py-1 rounded bg-muted border border-border text-xs text-foreground"
                                    />
                                    <span className="text-xs text-muted-foreground">g pro</span>
                                  </div>
                                ) : (
                                  <p className="text-xs text-muted-foreground">
                                    {item.calories} cal · {item.protein}g protein
                                  </p>
                                )}
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-1">
                                {isEditing ? (
                                  <>
                                    <button
                                      onClick={handleSaveEdit}
                                      disabled={savingEdit}
                                      className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20"
                                    >
                                      {savingEdit ? (
                                        <div className="h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                                      ) : (
                                        <Check className="h-3.5 w-3.5" />
                                      )}
                                    </button>
                                    <button
                                      onClick={() => setEditingMeal(null)}
                                      className="h-7 w-7 rounded-md bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    {/* Favorite button */}
                                    {(() => {
                                      const isRestaurant = !!meal.orderTemplate
                                      const restaurant = isRestaurant ? meal.orderTemplate?.restaurantBrand : undefined
                                      const mealKey = `${name}|${restaurant || ''}`
                                      const isFavorited = favoritedMealKeys.has(mealKey)
                                      return (
                                        <button
                                          onClick={() => toggleFavorite({
                                            id: meal.id,
                                            name,
                                            calories: item.calories,
                                            protein: item.protein,
                                            carbs: item.carbs,
                                            fat: item.fat,
                                            restaurant,
                                            source: isRestaurant ? 'restaurant' : (meal.foodCatalogItem?.source || 'home')
                                          })}
                                          disabled={togglingFavorite === meal.id}
                                          className={`h-7 w-7 rounded-md flex items-center justify-center transition-all ${
                                            isFavorited
                                              ? 'text-rose-500 hover:text-rose-600'
                                              : 'text-muted-foreground hover:text-rose-400'
                                          } disabled:opacity-50`}
                                        >
                                          {togglingFavorite === meal.id ? (
                                            <div className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                          ) : (
                                            <Heart className={`h-3.5 w-3.5 ${isFavorited ? 'fill-current' : ''}`} />
                                          )}
                                        </button>
                                      )
                                    })()}
                                    {meal.foodCatalogItem && (
                                      <button
                                        onClick={() => setEditingMeal({
                                          id: meal.id,
                                          calories: String(item.calories),
                                          protein: String(item.protein)
                                        })}
                                        className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleDeleteMeal(meal.id)}
                                      className="h-7 w-7 rounded-md hover:bg-red-500/10 flex items-center justify-center text-muted-foreground hover:text-red-500"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Daily Total */}
          {mealLogs.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border/50">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Daily Total</span>
                <div className="flex items-center gap-4">
                  <span className="font-medium text-foreground">
                    {mealLogs.reduce((sum, m) => {
                      const item = m.orderTemplate || m.foodCatalogItem
                      return sum + (item?.calories || 0) * m.servings
                    }, 0)} cal
                  </span>
                  <span className="font-medium text-primary">
                    {mealLogs.reduce((sum, m) => {
                      const item = m.orderTemplate || m.foodCatalogItem
                      return sum + (item?.protein || 0) * m.servings
                    }, 0)}g protein
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Favorited Meals Section */}
        <div className="bg-card rounded-2xl p-5 border border-border/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-rose-500/10 flex items-center justify-center">
                <Heart className="h-5 w-5 text-rose-500" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Favorited Meals</h2>
                <p className="text-xs text-muted-foreground">Your saved meals for quick access</p>
              </div>
            </div>
            {favoriteMeals.length > 0 && (
              <span className="text-xs text-muted-foreground">{favoriteMeals.length} saved</span>
            )}
          </div>

          {loadingFavorites ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 rounded-full border-2 border-rose-500 border-t-transparent animate-spin" />
            </div>
          ) : favoriteMeals.length === 0 ? (
            <div className="text-center py-8">
              <Heart className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No favorited meals yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Tap the heart icon on any meal to save it here
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {favoriteMeals.map((meal) => (
                <div
                  key={meal.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{meal.name}</p>
                      {meal.restaurant && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">
                          {meal.restaurant}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {meal.calories} cal · {meal.protein}g protein
                    </p>
                  </div>
                  <button
                    onClick={() => toggleFavorite({
                      id: meal.id,
                      name: meal.name,
                      calories: meal.calories,
                      protein: meal.protein,
                      carbs: meal.carbs,
                      fat: meal.fat,
                      restaurant: meal.restaurant,
                      source: meal.source
                    })}
                    disabled={togglingFavorite === meal.id}
                    className="h-8 w-8 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-500 hover:bg-rose-500/20 transition-colors disabled:opacity-50"
                  >
                    {togglingFavorite === meal.id ? (
                      <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Heart className="h-4 w-4 fill-current" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
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

        {/* Delete Account Section */}
        <div className="pt-8 border-t border-border/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Delete account</p>
              <p className="text-xs text-muted-foreground/60">Permanently remove your account and all data</p>
            </div>
            {showDeleteConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Are you sure?</span>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-muted transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => user?.delete()}
                  className="px-3 py-1.5 rounded-lg text-xs text-white bg-red-500 hover:bg-red-600 transition-all"
                >
                  Yes, delete
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            )}
          </div>
        </div>

      </main>
    </div>
  )
}
