'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { MacroProgress } from '@/lib/types'
import { PathwayVisualization } from '@/components/pathway-visualization'
import Link from 'next/link'
import { Utensils, MessageCircle, TrendingUp, Plus, Send, Check, X } from 'lucide-react'

interface MealLogEntry {
  id: string
  datetime: string
  servings: number
  mealType?: string
  orderTemplate?: {
    title: string
    restaurantBrand: string
    calories: number
    protein: number
    carbs: number
    fat: number
  }
  foodCatalogItem?: {
    name: string
    source: string
    calories: number
    protein: number
    carbs: number
    fat: number
  }
}

interface DailyMealLogs {
  mealLogs: MealLogEntry[]
  totals: {
    calories: number
    protein: number
    carbs: number
    fat: number
  }
  count: number
}

interface PendingMeal {
  name: string
  calories: number
  protein: number
  carbs: number
  fat: number
  servings: number
}

export default function DashboardPage() {
  const router = useRouter()
  const { user, isLoaded, isSignedIn } = useUser()
  const [macros, setMacros] = useState<MacroProgress | null>(null)
  const [mealLogs, setMealLogs] = useState<DailyMealLogs | null>(null)
  const [loading, setLoading] = useState(true)

  // Inline chat state
  const [showChatInput, setShowChatInput] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [pendingMeal, setPendingMeal] = useState<PendingMeal | null>(null)
  const [selectedMealType, setSelectedMealType] = useState<string>(() => {
    const hour = new Date().getHours()
    if (hour < 11) return 'breakfast'
    if (hour < 16) return 'lunch'
    return 'dinner'
  })
  const [isLogging, setIsLogging] = useState(false)

  useEffect(() => {
    if (!isLoaded) return

    if (!isSignedIn) {
      router.push('/auth/signin')
      return
    }

    if (user?.id) {
      syncAndLoadData(user.id)
    }

    setLoading(false)
  }, [user, isLoaded, isSignedIn, router])

  const syncAndLoadData = async (userId: string) => {
    try {
      await fetch('/api/sync-user', { method: 'POST' })
      await loadDashboardData(userId)
    } catch (error) {
      console.error('Failed to sync user:', error)
      setLoading(false)
    }
  }

  const loadDashboardData = async (userId: string) => {
    try {
      const [macroResponse, mealLogResponse] = await Promise.all([
        fetch(`/api/macro-progress?userId=${userId}`),
        fetch(`/api/log-meal?userId=${userId}`)
      ])

      if (macroResponse.ok) {
        const macroData = await macroResponse.json()
        setMacros(macroData)
      } else if (macroResponse.status === 404) {
        router.push('/onboarding')
        return
      }

      if (mealLogResponse.ok) {
        const mealLogData = await mealLogResponse.json()
        setMealLogs(mealLogData)
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  // Build pathway data from meal logs
  const getDailyMealPath = () => {
    if (!mealLogs || !macros) {
      const currentHour = new Date().getHours()
      return [
        {
          time: 'Breakfast',
          percentage: 0,
          isCompleted: false,
          isCurrent: currentHour < 11,
          macros: { calories: 0, protein: 0, carbs: 0, fat: 0 }
        },
        {
          time: 'Lunch',
          percentage: 0,
          isCompleted: false,
          isCurrent: currentHour >= 11 && currentHour < 16,
          macros: { calories: 0, protein: 0, carbs: 0, fat: 0 }
        },
        {
          time: 'Dinner',
          percentage: 0,
          isCompleted: false,
          isCurrent: currentHour >= 16,
          macros: { calories: 0, protein: 0, carbs: 0, fat: 0 }
        }
      ]
    }

    const mealsByTime = {
      breakfast: [] as MealLogEntry[],
      lunch: [] as MealLogEntry[],
      dinner: [] as MealLogEntry[]
    }

    mealLogs.mealLogs.forEach(log => {
      if (log.mealType) {
        if (log.mealType === 'breakfast') {
          mealsByTime.breakfast.push(log)
        } else if (log.mealType === 'lunch') {
          mealsByTime.lunch.push(log)
        } else if (log.mealType === 'dinner' || log.mealType === 'snack') {
          mealsByTime.dinner.push(log)
        }
      } else {
        const hour = new Date(log.datetime).getHours()
        if (hour < 11) {
          mealsByTime.breakfast.push(log)
        } else if (hour < 16) {
          mealsByTime.lunch.push(log)
        } else {
          mealsByTime.dinner.push(log)
        }
      }
    })

    const calculateMealMacros = (meals: MealLogEntry[]) => {
      return meals.reduce((sum, meal) => {
        const item = meal.orderTemplate || meal.foodCatalogItem
        if (!item) return sum
        return {
          calories: sum.calories + (item.calories * meal.servings),
          protein: sum.protein + (item.protein * meal.servings)
        }
      }, { calories: 0, protein: 0 })
    }

    const currentHour = new Date().getHours()

    const calculateFullMacros = (meals: MealLogEntry[]) => {
      return meals.reduce((sum, meal) => {
        const item = meal.orderTemplate || meal.foodCatalogItem
        if (!item) return sum
        return {
          calories: sum.calories + (item.calories * meal.servings),
          protein: sum.protein + (item.protein * meal.servings),
          carbs: sum.carbs + (item.carbs * meal.servings),
          fat: sum.fat + (item.fat * meal.servings)
        }
      }, { calories: 0, protein: 0, carbs: 0, fat: 0 })
    }

    const breakfastMacros = calculateFullMacros(mealsByTime.breakfast)
    const lunchMacros = calculateFullMacros(mealsByTime.lunch)
    const dinnerMacros = calculateFullMacros(mealsByTime.dinner)

    return [
      {
        time: 'Breakfast',
        percentage: mealsByTime.breakfast.length > 0
          ? Math.round((breakfastMacros.calories / macros.targets.calories) * 100)
          : 0,
        isCompleted: mealsByTime.breakfast.length > 0,
        isCurrent: currentHour < 11 && mealsByTime.breakfast.length === 0,
        macros: {
          calories: Math.round(breakfastMacros.calories),
          protein: Math.round(breakfastMacros.protein),
          carbs: Math.round(breakfastMacros.carbs),
          fat: Math.round(breakfastMacros.fat)
        }
      },
      {
        time: 'Lunch',
        percentage: mealsByTime.lunch.length > 0
          ? Math.round((lunchMacros.calories / macros.targets.calories) * 100)
          : 0,
        isCompleted: mealsByTime.lunch.length > 0,
        isCurrent: currentHour >= 11 && currentHour < 16 && mealsByTime.lunch.length === 0,
        macros: {
          calories: Math.round(lunchMacros.calories),
          protein: Math.round(lunchMacros.protein),
          carbs: Math.round(lunchMacros.carbs),
          fat: Math.round(lunchMacros.fat)
        }
      },
      {
        time: 'Dinner',
        percentage: mealsByTime.dinner.length > 0
          ? Math.round((dinnerMacros.calories / macros.targets.calories) * 100)
          : 0,
        isCompleted: mealsByTime.dinner.length > 0,
        isCurrent: currentHour >= 16 && mealsByTime.dinner.length === 0,
        macros: {
          calories: Math.round(dinnerMacros.calories),
          protein: Math.round(dinnerMacros.protein),
          carbs: Math.round(dinnerMacros.carbs),
          fat: Math.round(dinnerMacros.fat)
        }
      }
    ]
  }

  // Get meals grouped by type
  const getMealsByType = () => {
    if (!mealLogs || mealLogs.mealLogs.length === 0) return { breakfast: [], lunch: [], dinner: [] }

    const grouped: { breakfast: typeof meals; lunch: typeof meals; dinner: typeof meals } = {
      breakfast: [],
      lunch: [],
      dinner: []
    }

    const meals = mealLogs.mealLogs.map(log => ({
      id: log.id,
      name: log.orderTemplate?.title || log.foodCatalogItem?.name || 'Unknown',
      source: log.orderTemplate?.restaurantBrand || log.foodCatalogItem?.source || '',
      calories: Math.round((log.orderTemplate?.calories || log.foodCatalogItem?.calories || 0) * log.servings),
      protein: Math.round((log.orderTemplate?.protein || log.foodCatalogItem?.protein || 0) * log.servings),
      mealType: log.mealType || 'meal',
      datetime: log.datetime
    }))

    meals.forEach(meal => {
      if (meal.mealType === 'breakfast') {
        grouped.breakfast.push(meal)
      } else if (meal.mealType === 'lunch') {
        grouped.lunch.push(meal)
      } else {
        // dinner, snack, or unknown goes to dinner
        grouped.dinner.push(meal)
      }
    })

    return grouped
  }

  // Handle inline chat submission
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim() || !user?.id || pendingMeal) return

    setIsProcessing(true)

    try {
      const response = await fetch('/api/nutrition-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: chatInput,
          userId: user.id
        })
      })

      if (!response.ok) throw new Error('Failed to process')

      const data = await response.json()

      if (data.mealParsed && data.parsedMeal) {
        setPendingMeal({
          name: data.parsedMeal.name,
          calories: data.parsedMeal.calories,
          protein: data.parsedMeal.protein,
          carbs: data.parsedMeal.carbs,
          fat: data.parsedMeal.fat,
          servings: data.parsedMeal.servings || 1
        })
        setChatInput('')
      }
    } catch (error) {
      console.error('Failed to process:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const confirmMeal = async () => {
    if (!pendingMeal || !user?.id) return

    setIsLogging(true)

    try {
      const response = await fetch('/api/log-meal-direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          name: pendingMeal.name,
          calories: pendingMeal.calories,
          protein: pendingMeal.protein,
          carbs: pendingMeal.carbs,
          fat: pendingMeal.fat,
          servings: pendingMeal.servings,
          mealType: selectedMealType
        })
      })

      if (!response.ok) throw new Error('Failed to log meal')

      // Refresh data
      await loadDashboardData(user.id)
      setPendingMeal(null)
      setShowChatInput(false)
      setChatInput('')
    } catch (error) {
      console.error('Failed to log meal:', error)
    } finally {
      setIsLogging(false)
    }
  }

  const cancelMeal = () => {
    setPendingMeal(null)
    setChatInput('')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  const userName = user?.firstName || 'there'

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-6xl px-6 py-8 space-y-6">

        {/* Header with Remaining Summary */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              {getGreeting()}, {userName}
            </h1>
            <p className="text-base text-muted-foreground mt-1">Let's find your path today</p>
          </div>

          {/* Remaining Summary Pill */}
          {macros && macros.remaining.calories > 0 && (
            <div className="bg-primary/10 rounded-full px-5 py-2.5 flex items-center gap-4 text-base">
              <div className="flex items-center gap-2">
                <span className="text-primary font-semibold text-lg">{macros.remaining.calories}</span>
                <span className="text-muted-foreground">cal</span>
              </div>
              <div className="w-px h-5 bg-border" />
              <div className="flex items-center gap-2">
                <span className="text-primary font-semibold text-lg">{macros.remaining.protein}g</span>
                <span className="text-muted-foreground">protein</span>
              </div>
              <span className="text-muted-foreground">left</span>
            </div>
          )}
        </div>

        {/* Pathway - Hero Section */}
        <PathwayVisualization dailyData={getDailyMealPath()} />

        {/* Side by Side: Today's Total + Meals Logged */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Today's Total */}
          {macros && (
            <div className="bg-card rounded-2xl p-6 border border-border/50 flex flex-col h-full">
              <p className="text-base font-medium text-muted-foreground mb-5">Today's Total</p>
              <div className="grid grid-cols-2 gap-6 flex-1 place-items-center">
                {/* Calories */}
                <div className="flex flex-col items-center">
                  <div className="relative w-20 h-20">
                    <svg className="w-20 h-20 -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted" />
                      <circle
                        cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8"
                        className="text-primary transition-all duration-500"
                        strokeLinecap="round"
                        strokeDasharray={`${Math.min(100, (macros.current.calories / macros.targets.calories) * 100) * 2.64} 264`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-base font-semibold text-foreground">{Math.round((macros.current.calories / macros.targets.calories) * 100)}%</span>
                    </div>
                  </div>
                  <p className="text-base font-medium text-foreground mt-2">{macros.current.calories}</p>
                  <p className="text-sm text-muted-foreground">of {macros.targets.calories} cal</p>
                </div>

                {/* Protein */}
                <div className="flex flex-col items-center">
                  <div className="relative w-20 h-20">
                    <svg className="w-20 h-20 -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted" />
                      <circle
                        cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8"
                        className="text-primary transition-all duration-500"
                        strokeLinecap="round"
                        strokeDasharray={`${Math.min(100, (macros.current.protein / macros.targets.protein) * 100) * 2.64} 264`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-base font-semibold text-foreground">{Math.round((macros.current.protein / macros.targets.protein) * 100)}%</span>
                    </div>
                  </div>
                  <p className="text-base font-medium text-foreground mt-2">{macros.current.protein}g</p>
                  <p className="text-sm text-muted-foreground">of {macros.targets.protein}g pro</p>
                </div>

                {/* Carbs */}
                <div className="flex flex-col items-center">
                  <div className="relative w-20 h-20">
                    <svg className="w-20 h-20 -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted" />
                      <circle
                        cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8"
                        className="text-primary/60 transition-all duration-500"
                        strokeLinecap="round"
                        strokeDasharray={`${Math.min(100, (macros.current.carbs / macros.targets.carbs) * 100) * 2.64} 264`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-base font-semibold text-foreground">{Math.round((macros.current.carbs / macros.targets.carbs) * 100)}%</span>
                    </div>
                  </div>
                  <p className="text-base font-medium text-foreground mt-2">{macros.current.carbs}g</p>
                  <p className="text-sm text-muted-foreground">of {macros.targets.carbs}g carbs</p>
                </div>

                {/* Fat */}
                <div className="flex flex-col items-center">
                  <div className="relative w-20 h-20">
                    <svg className="w-20 h-20 -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted" />
                      <circle
                        cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8"
                        className="text-primary/40 transition-all duration-500"
                        strokeLinecap="round"
                        strokeDasharray={`${Math.min(100, (macros.current.fat / macros.targets.fat) * 100) * 2.64} 264`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-base font-semibold text-foreground">{Math.round((macros.current.fat / macros.targets.fat) * 100)}%</span>
                    </div>
                  </div>
                  <p className="text-base font-medium text-foreground mt-2">{macros.current.fat}g</p>
                  <p className="text-sm text-muted-foreground">of {macros.targets.fat}g fat</p>
                </div>
              </div>
            </div>
          )}

          {/* Meals Logged */}
          <div className="bg-card rounded-2xl p-6 border border-border/50 flex flex-col">
            {/* Add Meal Button - Always visible at top */}
            {!showChatInput && !pendingMeal && (
              <button
                onClick={() => setShowChatInput(true)}
                className="w-full mb-4 flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 transition-all group"
              >
                <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center group-hover:bg-primary/30 transition-colors">
                  <Plus className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="text-sm font-medium text-primary">Add a meal</span>
              </button>
            )}

            {/* Inline Chat Input */}
            {showChatInput && !pendingMeal && (
              <div className="mb-4 pb-4 border-b border-border/50">
                <form onSubmit={handleChatSubmit}>
                  <div className="flex items-center gap-2 rounded-lg bg-muted/50 border border-border px-3 py-1.5 focus-within:border-primary/50 transition-colors">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="I had a chicken salad..."
                      className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={!chatInput.trim() || isProcessing}
                      className={`rounded-md p-1.5 transition-all ${
                        chatInput.trim() && !isProcessing
                          ? 'bg-primary text-primary-foreground hover:opacity-90'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {isProcessing ? (
                        <div className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowChatInput(false)
                        setChatInput('')
                      }}
                      className="rounded-md p-1.5 bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Pending Meal Confirmation */}
            {pendingMeal && (
              <div className="mb-4 pb-4 border-b border-border/50">
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="font-medium text-foreground text-sm">{pendingMeal.name}</p>
                  <div className="flex gap-2 mt-1.5 text-xs text-muted-foreground">
                    <span>{pendingMeal.calories} cal</span>
                    <span>{pendingMeal.protein}g pro</span>
                    <span>{pendingMeal.carbs}g carbs</span>
                    <span>{pendingMeal.fat}g fat</span>
                  </div>

                  {/* Meal type selector */}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => setSelectedMealType(type)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all capitalize ${
                          selectedMealType === type
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={confirmMeal}
                      disabled={isLogging}
                      className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
                    >
                      {isLogging ? (
                        <div className="h-3 w-3 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Check className="h-3 w-3" />
                      )}
                      Log
                    </button>
                    <button
                      onClick={cancelMeal}
                      disabled={isLogging}
                      className="px-2.5 py-1.5 rounded-md bg-muted text-muted-foreground text-xs hover:bg-muted/80 transition-colors disabled:opacity-50"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Meals Logged Header */}
            <p className="text-base font-medium text-muted-foreground mb-4">Meals Logged</p>

            {(() => {
              const mealsByType = getMealsByType()
              const MAX_VISIBLE = 2

              return (
                <div className="space-y-4 flex-1">
                  {/* Breakfast */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-foreground uppercase tracking-wider">Breakfast</p>
                      {mealsByType.breakfast.length > 0 && (
                        <span className="text-sm text-primary font-medium">{mealsByType.breakfast.length}</span>
                      )}
                    </div>
                    {mealsByType.breakfast.length > 0 ? (
                      <div className="space-y-2">
                        {mealsByType.breakfast.slice(0, MAX_VISIBLE).map((meal) => (
                          <div key={meal.id} className="flex items-center justify-between py-2.5 px-3 bg-muted/30 rounded-lg">
                            <p className="text-sm text-foreground truncate flex-1">{meal.name}</p>
                            <div className="flex items-center gap-2 text-sm ml-2">
                              <span className="text-muted-foreground">{meal.calories}</span>
                              <span className="text-primary font-medium">{meal.protein}g</span>
                            </div>
                          </div>
                        ))}
                        {mealsByType.breakfast.length > MAX_VISIBLE && (
                          <Link href="/meals" className="text-sm text-primary hover:text-primary/80 transition-colors">
                            +{mealsByType.breakfast.length - MAX_VISIBLE} more
                          </Link>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground/40 py-1">No meals logged</p>
                    )}
                  </div>

                  <div className="border-t border-border/30" />

                  {/* Lunch */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-foreground uppercase tracking-wider">Lunch</p>
                      {mealsByType.lunch.length > 0 && (
                        <span className="text-sm text-primary font-medium">{mealsByType.lunch.length}</span>
                      )}
                    </div>
                    {mealsByType.lunch.length > 0 ? (
                      <div className="space-y-2">
                        {mealsByType.lunch.slice(0, MAX_VISIBLE).map((meal) => (
                          <div key={meal.id} className="flex items-center justify-between py-2.5 px-3 bg-muted/30 rounded-lg">
                            <p className="text-sm text-foreground truncate flex-1">{meal.name}</p>
                            <div className="flex items-center gap-2 text-sm ml-2">
                              <span className="text-muted-foreground">{meal.calories}</span>
                              <span className="text-primary font-medium">{meal.protein}g</span>
                            </div>
                          </div>
                        ))}
                        {mealsByType.lunch.length > MAX_VISIBLE && (
                          <Link href="/meals" className="text-sm text-primary hover:text-primary/80 transition-colors">
                            +{mealsByType.lunch.length - MAX_VISIBLE} more
                          </Link>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground/40 py-1">No meals logged</p>
                    )}
                  </div>

                  <div className="border-t border-border/30" />

                  {/* Dinner */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-foreground uppercase tracking-wider">Dinner</p>
                      {mealsByType.dinner.length > 0 && (
                        <span className="text-sm text-primary font-medium">{mealsByType.dinner.length}</span>
                      )}
                    </div>
                    {mealsByType.dinner.length > 0 ? (
                      <div className="space-y-2">
                        {mealsByType.dinner.slice(0, MAX_VISIBLE).map((meal) => (
                          <div key={meal.id} className="flex items-center justify-between py-2.5 px-3 bg-muted/30 rounded-lg">
                            <p className="text-sm text-foreground truncate flex-1">{meal.name}</p>
                            <div className="flex items-center gap-2 text-sm ml-2">
                              <span className="text-muted-foreground">{meal.calories}</span>
                              <span className="text-primary font-medium">{meal.protein}g</span>
                            </div>
                          </div>
                        ))}
                        {mealsByType.dinner.length > MAX_VISIBLE && (
                          <Link href="/meals" className="text-sm text-primary hover:text-primary/80 transition-colors">
                            +{mealsByType.dinner.length - MAX_VISIBLE} more
                          </Link>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground/40 py-1">No meals logged</p>
                    )}
                  </div>
                </div>
              )
            })()}
          </div>
        </div>

        {/* Quick Actions - Bottom */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            href="/coach"
            className="bg-card rounded-xl p-4 border border-border/50 hover:border-primary/30 transition-all hover:shadow-sm group"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <MessageCircle className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Log a meal</p>
                <p className="text-sm text-muted-foreground">Chat with your coach</p>
              </div>
            </div>
          </Link>

          <Link
            href="/restaurants"
            className="bg-card rounded-xl p-4 border border-border/50 hover:border-primary/30 transition-all hover:shadow-sm group"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Utensils className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Find food nearby</p>
                <p className="text-sm text-muted-foreground">Restaurant suggestions</p>
              </div>
            </div>
          </Link>

          <Link
            href="/profile"
            className="bg-card rounded-xl p-4 border border-border/50 hover:border-primary/30 transition-all hover:shadow-sm group"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Your progress</p>
                <p className="text-sm text-muted-foreground">View weekly trends</p>
              </div>
            </div>
          </Link>
        </div>

      </main>
    </div>
  )
}
