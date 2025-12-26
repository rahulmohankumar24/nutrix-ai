'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { MacroProgress } from '@/lib/types'

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
  const { data: session, status } = useSession()
  const [macros, setMacros] = useState<MacroProgress | null>(null)
  const [mealLogs, setMealLogs] = useState<DailyMealLogs | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'loading') return

    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }

    if (session?.user?.id) {
      loadDashboardData(session.user.id)
    }

    setLoading(false)
  }, [session, status, router])

  const loadDashboardData = async (userId: string) => {
    try {
      // Load macro progress and meal logs in parallel
      const [macroResponse, mealLogResponse] = await Promise.all([
        fetch(`/api/macro-progress?userId=${userId}`),
        fetch(`/api/log-meal?userId=${userId}`)
      ])

      if (macroResponse.ok) {
        const macroData = await macroResponse.json()
        setMacros(macroData)
      } else if (macroResponse.status === 404) {
        // User hasn't completed onboarding - redirect them
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

  const getGreeting = () => {
    const timeOfDay = getTimeOfDay()
    const name = session?.user?.name?.split(' ')[0] || 'there'
    return `Good ${timeOfDay}, ${name}!`
  }

  const formatTime = (datetime: string) => {
    return new Date(datetime).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const getNextMealSuggestion = () => {
    const hour = new Date().getHours()
    if (hour < 11) return { meal: 'lunch', time: '12:00 PM' }
    if (hour < 15) return { meal: 'afternoon snack', time: '3:00 PM' }
    if (hour < 19) return { meal: 'dinner', time: '7:00 PM' }
    return { meal: 'tomorrow\'s breakfast', time: '8:00 AM' }
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

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="glass border-b border-gray-800/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-lg">M</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Mootra AI</h1>
                <p className="text-gray-400 text-sm">Your AI nutrition coach</p>
              </div>
            </div>
            <nav className="flex items-center space-x-6">
              <Link href="/restaurants" className="text-gray-400 hover:text-white transition-colors text-sm">
                Find Food
              </Link>
              <Link href="/profile" className="text-gray-400 hover:text-white transition-colors text-sm">
                Profile
              </Link>
              <button
                onClick={() => signOut()}
                className="text-gray-400 hover:text-white transition-colors text-sm"
              >
                Sign Out
              </button>
            </nav>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Greeting */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">{getGreeting()}</h2>
          <p className="text-gray-400">Here's how your nutrition is tracking today</p>
        </div>

        {/* Daily Goals Overview */}
        {macros && (
          <div className="glass rounded-2xl p-8 mb-8 card-hover">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Today's Nutrition Goals</h2>
              <p className="text-gray-400">Track your daily targets and see how you're progressing</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {(['calories', 'protein', 'carbs', 'fat'] as const).map((macro, index) => {
                const colors = ['blue', 'green', 'yellow', 'purple']
                const color = colors[index]
                const percentage = Math.min(100, (macros.current[macro] / macros.targets[macro]) * 100)
                const isOver = macros.current[macro] > macros.targets[macro]
                const isComplete = percentage >= 100

                return (
                  <div key={macro} className={`bg-${color}-900/20 rounded-xl p-6 border border-${color}-500/30 relative overflow-hidden`}>
                    <div className="text-center relative z-10">
                      <div className={`text-2xl font-bold text-${color}-400 mb-1`}>
                        {macros.targets[macro]}
                        <span className="text-sm text-gray-400 ml-1">{macro === 'calories' ? '' : 'g'}</span>
                      </div>
                      <div className="text-xs text-gray-300 uppercase tracking-wide mb-4">
                        Daily {macro} Goal
                      </div>

                      {/* Progress Circle */}
                      <div className="relative w-20 h-20 mx-auto mb-4">
                        <div className={`absolute inset-0 rounded-full border-4 border-${color}-900/30`}></div>
                        <div
                          className={`absolute inset-0 rounded-full border-4 border-${color}-400 transition-all duration-700`}
                          style={{
                            clipPath: `polygon(0 0, 0 ${100 - percentage}%, 100% ${100 - percentage}%, 100% 100%, 0 100%)`
                          }}
                        ></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className={`text-lg font-bold text-${color}-300`}>
                            {Math.round(percentage)}%
                          </span>
                        </div>
                      </div>

                      {/* Current Progress */}
                      <div className={`text-lg font-semibold text-${color}-300 mb-1`}>
                        {macros.current[macro]} / {macros.targets[macro]}
                      </div>

                      {/* Status */}
                      <div className="text-xs">
                        {isComplete ? (
                          <span className="text-green-400">✓ Goal achieved!</span>
                        ) : isOver ? (
                          <span className="text-red-400">Over by {macros.current[macro] - macros.targets[macro]}</span>
                        ) : (
                          <span className="text-gray-400">{macros.remaining[macro]} to go</span>
                        )}
                      </div>
                    </div>

                    {/* Background progress bar */}
                    <div className="absolute bottom-0 left-0 right-0 h-2">
                      <div className="w-full bg-gray-800 h-full">
                        <div
                          className={`h-full transition-all duration-700 ease-out ${
                            isComplete ? `bg-green-500` : `bg-gradient-to-r from-${color}-500 to-${color}-400`
                          }`}
                          style={{ width: `${Math.min(100, percentage)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Overall Progress Summary */}
            <div className="mt-6 pt-6 border-t border-gray-700/50">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white font-medium">Overall Progress</h3>
                  <p className="text-gray-400 text-sm">
                    {(['calories', 'protein', 'carbs', 'fat'] as const).filter(macro =>
                      (macros.current[macro] / macros.targets[macro]) >= 1
                    ).length} of 4 goals completed
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-white">
                    {Math.round(
                      (['calories', 'protein', 'carbs', 'fat'] as const).reduce((sum, macro) =>
                        sum + Math.min(100, (macros.current[macro] / macros.targets[macro]) * 100)
                      , 0) / 4
                    )}%
                  </div>
                  <p className="text-gray-400 text-xs">Average completion</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* What You've Eaten Today */}
          <div className="glass rounded-2xl p-8 card-hover">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">What You've Eaten Today</h3>
              <span className="text-sm text-gray-400">
                {mealLogs?.count || 0} meals logged
              </span>
            </div>

            {mealLogs && mealLogs.mealLogs.length > 0 ? (
              <div className="space-y-4">
                {mealLogs.mealLogs.map((log) => {
                  const item = log.orderTemplate || log.foodCatalogItem
                  if (!item) return null

                  const totalCals = Math.round(item.calories * log.servings)
                  const totalProtein = Math.round(item.protein * log.servings)

                  return (
                    <div key={log.id} className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-medium text-white text-sm">
                            {log.orderTemplate ? log.orderTemplate.title : log.foodCatalogItem?.name}
                          </h4>
                          {log.orderTemplate && (
                            <p className="text-gray-400 text-xs capitalize">
                              {log.orderTemplate.restaurantBrand}
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-gray-400">
                          {formatTime(log.datetime)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex space-x-4">
                          <span className="text-blue-400">{totalCals} cal</span>
                          <span className="text-green-400">{totalProtein}g protein</span>
                        </div>
                        {log.servings !== 1 && (
                          <span className="text-gray-500">{log.servings}x servings</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-gray-600 text-4xl mb-4">🍽️</div>
                <h4 className="text-lg font-medium text-white mb-2">No meals logged yet</h4>
                <p className="text-gray-400 text-sm mb-4">Start tracking your nutrition by logging your first meal</p>
                <Link
                  href="/restaurants"
                  className="inline-block bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all text-sm"
                >
                  Find Food to Log
                </Link>
              </div>
            )}
          </div>

          {/* What You Need */}
          <div className="glass rounded-2xl p-8 card-hover">
            <h3 className="text-xl font-bold text-white mb-6">What You Still Need</h3>

            {macros && (
              <div className="space-y-4">
                {(['calories', 'protein', 'carbs', 'fat'] as const).map((macro) => {
                  const remaining = macros.remaining[macro]
                  const isOver = macros.current[macro] > macros.targets[macro]
                  const colors = {
                    calories: 'blue',
                    protein: 'green',
                    carbs: 'yellow',
                    fat: 'purple'
                  }
                  const color = colors[macro]

                  return (
                    <div key={macro} className={`bg-${color}-900/20 rounded-lg p-4 border border-${color}-500/30`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={`text-${color}-300 font-medium capitalize`}>{macro}</p>
                          <p className="text-xs text-gray-400">
                            {isOver
                              ? `${Math.abs(remaining)} over target`
                              : remaining > 0
                                ? `${remaining}${macro === 'calories' ? '' : 'g'} remaining`
                                : 'Target reached!'
                            }
                          </p>
                        </div>
                        <div className={`text-2xl font-bold text-${color}-400`}>
                          {isOver ? '+' : ''}{isOver ? Math.abs(remaining) : remaining}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="mt-6 pt-6 border-t border-gray-700/50">
              <h4 className="text-white font-medium mb-3">Next Meal Suggestion</h4>
              <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-lg p-4 border border-purple-500/30">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-300 font-medium capitalize">
                      {getNextMealSuggestion().meal}
                    </p>
                    <p className="text-xs text-purple-400">
                      Suggested time: {getNextMealSuggestion().time}
                    </p>
                  </div>
                  <Link
                    href="/restaurants"
                    className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors text-sm"
                  >
                    Find Food
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="glass rounded-2xl p-8 mt-8 card-hover">
          <h3 className="text-xl font-bold text-white mb-6">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              href="/restaurants"
              className="bg-gradient-to-r from-blue-600 to-blue-500 text-white p-6 rounded-xl hover:from-blue-700 hover:to-blue-600 transition-all text-center group"
            >
              <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">🍽️</div>
              <h4 className="font-semibold mb-2">Find Restaurants</h4>
              <p className="text-blue-100 text-sm">Discover nearby options</p>
            </Link>

            <Link
              href="/meals"
              className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-6 rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all text-center group"
            >
              <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">🥗</div>
              <h4 className="font-semibold mb-2">Log Home Meal</h4>
              <p className="text-green-100 text-sm">Track what you cooked</p>
            </Link>

            <Link
              href="/profile"
              className="bg-gradient-to-r from-purple-600 to-purple-500 text-white p-6 rounded-xl hover:from-purple-700 hover:to-purple-600 transition-all text-center group"
            >
              <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">⚙️</div>
              <h4 className="font-semibold mb-2">Update Goals</h4>
              <p className="text-purple-100 text-sm">Adjust your targets</p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}