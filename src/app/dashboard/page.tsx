'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { MacroProgress } from '@/lib/types'
import { DashboardHeader } from "@/components/dashboard-header"
import { NutritionStatsCards } from "@/components/nutrition-stats-cards"
import { PathwayVisualization } from "@/components/pathway-visualization"
import { FoodSuggestionsCard } from "@/components/action-cards"
import { WeekSummary } from "@/components/week-summary"

interface MealLogEntry {
  id: string
  datetime: string
  servings: number
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

export default function DashboardPage() {
  const router = useRouter()
  const { user, isLoaded, isSignedIn } = useUser()
  const [macros, setMacros] = useState<MacroProgress | null>(null)
  const [mealLogs, setMealLogs] = useState<DailyMealLogs | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingMeal, setEditingMeal] = useState<string | null>(null)
  const [editServings, setEditServings] = useState<number>(1)

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

  const getTimeOfDay = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'morning'
    if (hour < 17) return 'afternoon'
    return 'evening'
  }

  const formatTime = (datetime: string) => {
    return new Date(datetime).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const deleteMeal = async (mealLogId: string) => {
    if (!user?.id) return

    try {
      const response = await fetch(`/api/log-meal?mealLogId=${mealLogId}&userId=${user.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await loadDashboardData(user.id)
      }
    } catch (error) {
      console.error('Failed to delete meal:', error)
    }
  }

  const updateMealServings = async (mealLogId: string, servings: number) => {
    if (!user?.id) return

    try {
      const response = await fetch('/api/log-meal', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mealLogId,
          userId: user.id,
          servings
        })
      })

      if (response.ok) {
        await loadDashboardData(user.id)
        setEditingMeal(null)
      }
    } catch (error) {
      console.error('Failed to update meal:', error)
    }
  }

  const clearAllMeals = async () => {
    if (!user?.id || !mealLogs?.mealLogs.length) return

    const confirmClear = confirm('Are you sure you want to delete all meals for today? This cannot be undone.')
    if (!confirmClear) return

    try {
      await Promise.all(
        mealLogs.mealLogs.map(log =>
          fetch(`/api/log-meal?mealLogId=${log.id}&userId=${user.id}`, {
            method: 'DELETE'
          })
        )
      )

      await loadDashboardData(user.id)
    } catch (error) {
      console.error('Failed to clear all meals:', error)
    }
  }

  // Convert meal logs to pathway visualization format
  const getDailyMealPath = () => {
    if (!mealLogs || !macros) return []

    const mealsByTime = {
      breakfast: [] as MealLogEntry[],
      lunch: [] as MealLogEntry[],
      dinner: [] as MealLogEntry[]
    }

    // Categorize meals by time
    mealLogs.mealLogs.forEach(log => {
      const hour = new Date(log.datetime).getHours()
      if (hour < 11) {
        mealsByTime.breakfast.push(log)
      } else if (hour < 16) {
        mealsByTime.lunch.push(log)
      } else {
        mealsByTime.dinner.push(log)
      }
    })

    const calculateMealMacros = (meals: MealLogEntry[]) => {
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

    const currentHour = new Date().getHours()

    return [
      {
        time: 'Breakfast',
        percentage: mealsByTime.breakfast.length > 0
          ? Math.round((calculateMealMacros(mealsByTime.breakfast).calories / macros.targets.calories) * 100)
          : 0,
        isCompleted: mealsByTime.breakfast.length > 0,
        isCurrent: currentHour < 11 && mealsByTime.breakfast.length === 0,
        details: {
          items: mealsByTime.breakfast.map(m =>
            (m.orderTemplate?.title || m.foodCatalogItem?.name || 'Unknown') +
            (m.servings > 1 ? ` (${m.servings}x)` : '')
          ),
          summary: mealsByTime.breakfast.length > 0
            ? `${Math.round(calculateMealMacros(mealsByTime.breakfast).protein)}g protein`
            : 'Not yet logged'
        }
      },
      {
        time: 'Lunch',
        percentage: mealsByTime.lunch.length > 0
          ? Math.round((calculateMealMacros(mealsByTime.lunch).calories / macros.targets.calories) * 100)
          : 0,
        isCompleted: mealsByTime.lunch.length > 0,
        isCurrent: currentHour >= 11 && currentHour < 16 && mealsByTime.lunch.length === 0,
        details: {
          items: mealsByTime.lunch.map(m =>
            (m.orderTemplate?.title || m.foodCatalogItem?.name || 'Unknown') +
            (m.servings > 1 ? ` (${m.servings}x)` : '')
          ),
          summary: mealsByTime.lunch.length > 0
            ? `${Math.round(calculateMealMacros(mealsByTime.lunch).protein)}g protein`
            : 'Not yet logged'
        }
      },
      {
        time: 'Dinner',
        percentage: mealsByTime.dinner.length > 0
          ? Math.round((calculateMealMacros(mealsByTime.dinner).calories / macros.targets.calories) * 100)
          : 0,
        isCompleted: mealsByTime.dinner.length > 0,
        isCurrent: currentHour >= 16 && mealsByTime.dinner.length === 0,
        details: {
          items: mealsByTime.dinner.map(m =>
            (m.orderTemplate?.title || m.foodCatalogItem?.name || 'Unknown') +
            (m.servings > 1 ? ` (${m.servings}x)` : '')
          ),
          summary: mealsByTime.dinner.length > 0
            ? `${Math.round(calculateMealMacros(mealsByTime.dinner).protein)}g protein`
            : 'Not yet logged'
        }
      }
    ]
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-2 border-blue-500 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-400 text-sm">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  const userName = user?.firstName || user?.fullName?.split(' ')[0] || 'there'
  const overallProgress = macros ? Math.round(
    (['calories', 'protein', 'carbs', 'fat'] as const).reduce((sum, macro) =>
      sum + Math.min(100, (macros.current[macro] / macros.targets[macro]) * 100)
    , 0) / 4
  ) : 0

  return (
    <div className="min-h-screen bg-background">
      <main>
        <div className="mx-auto max-w-6xl space-y-6 p-6 sm:p-8 lg:p-12">
          <DashboardHeader
            userName={userName}
            message={`Steady momentum ${getTimeOfDay()}.`}
            progressPercentage={overallProgress}
          />

          <FoodSuggestionsCard />

          <div className="grid gap-6 md:grid-cols-2">
            <PathwayVisualization
              title="Today's Journey"
              dailyData={getDailyMealPath()}
            />

            {macros && (
              <NutritionStatsCards
                protein={{ label: "Protein", current: macros.current.protein, target: macros.targets.protein, unit: "g" }}
                fat={{ label: "Fat", current: macros.current.fat, target: macros.targets.fat, unit: "g" }}
                carbs={{ label: "Carbs", current: macros.current.carbs, target: macros.targets.carbs, unit: "g" }}
                calories={{ label: "Calories", current: macros.current.calories, target: macros.targets.calories, unit: "" }}
              />
            )}
          </div>

          <WeekSummary />

          {/* Meal Log Details */}
          {mealLogs && mealLogs.mealLogs.length > 0 && (
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Today's Meals</h2>
                <button
                  onClick={clearAllMeals}
                  className="text-red-400 hover:text-red-300 text-sm transition-colors"
                >
                  Clear All
                </button>
              </div>
              <div className="space-y-3">
                {mealLogs.mealLogs.map((log) => {
                  const meal = log.orderTemplate || log.foodCatalogItem
                  if (!meal) return null

                  return (
                    <div key={log.id} className="bg-gray-800/50 rounded-xl p-4 flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <span className="text-gray-400 text-sm">{formatTime(log.datetime)}</span>
                          <h3 className="text-white font-medium">
                            {log.orderTemplate?.title || log.foodCatalogItem?.name}
                          </h3>
                          {log.orderTemplate && (
                            <span className="text-xs bg-blue-900/30 text-blue-400 px-2 py-1 rounded">
                              {log.orderTemplate.restaurantBrand}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 text-sm text-gray-400 space-x-4">
                          <span>{Math.round(meal.calories * log.servings)} cal</span>
                          <span>{Math.round(meal.protein * log.servings)}g protein</span>
                          <span>{Math.round(meal.carbs * log.servings)}g carbs</span>
                          <span>{Math.round(meal.fat * log.servings)}g fat</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        {editingMeal === log.id ? (
                          <>
                            <input
                              type="number"
                              min="0.5"
                              step="0.5"
                              value={editServings}
                              onChange={(e) => setEditServings(parseFloat(e.target.value))}
                              className="w-20 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm"
                            />
                            <button
                              onClick={() => updateMealServings(log.id, editServings)}
                              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingMeal(null)}
                              className="px-3 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg text-white text-sm"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => {
                                setEditingMeal(log.id)
                                setEditServings(log.servings)
                              }}
                              className="text-blue-400 hover:text-blue-300 text-sm"
                            >
                              {log.servings}x servings
                            </button>
                            <button
                              onClick={() => deleteMeal(log.id)}
                              className="text-red-400 hover:text-red-300 text-sm"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
