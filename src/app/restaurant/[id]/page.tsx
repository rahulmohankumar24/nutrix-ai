'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

interface Restaurant {
  id: string
  name: string
  distance: number
  tags: Record<string, string>
  isKnown: boolean
}

interface MealTemplate {
  id: string
  restaurantBrand: string
  title: string
  description: string
  calories: number
  protein: number
  carbs: number
  fat: number
  tags: string[]
  keywordsForDeliverySearch: string
  aiDescription?: string
  macroFitScore?: number
  personalizedNote?: string
}

interface DailyTargets {
  calories: number
  protein: number
  carbs: number
  fat: number
}

export default function RestaurantPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [meals, setMeals] = useState<MealTemplate[]>([])
  const [userTargets, setUserTargets] = useState<DailyTargets | null>(null)
  const [loading, setLoading] = useState(true)
  const [aiLoading, setAiLoading] = useState(false)

  useEffect(() => {
    if (params.id && session?.user?.id) {
      loadRestaurantData()
      loadUserTargets()
    }
  }, [params.id, session?.user?.id])

  const loadRestaurantData = async () => {
    try {
      // Get restaurant info from localStorage (passed from dashboard)
      const restaurantData = localStorage.getItem(`restaurant_${params.id}`)
      let restaurantInfo = null
      if (restaurantData) {
        restaurantInfo = JSON.parse(restaurantData)
        setRestaurant(restaurantInfo)
      }

      // Load meals for this restaurant
      if (restaurantInfo?.name) {
        const mealsResponse = await fetch(`/api/restaurant-meals?restaurantBrand=${encodeURIComponent(restaurantInfo.name)}`)
        if (mealsResponse.ok) {
          const mealsData = await mealsResponse.json()
          setMeals(mealsData.meals || [])
        }
      }
    } catch (error) {
      console.error('Failed to load restaurant data:', error)
    }
  }

  const loadUserTargets = async () => {
    try {
      const response = await fetch(`/api/macro-progress?userId=${session?.user?.id}`)
      if (response.ok) {
        const data = await response.json()
        setUserTargets(data.remaining)
      }
    } catch (error) {
      console.error('Failed to load user targets:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateAIInsights = async () => {
    if (!userTargets || aiLoading) return

    setAiLoading(true)
    try {
      const response = await fetch('/api/ai-meal-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meals,
          userTargets,
          restaurantName: restaurant?.name
        })
      })

      if (response.ok) {
        const data = await response.json()
        setMeals(data.enhancedMeals)
      }
    } catch (error) {
      console.error('Failed to generate AI insights:', error)
    } finally {
      setAiLoading(false)
    }
  }

  const openDeliveryApp = (mealTitle: string, keywords: string) => {
    const searchQuery = encodeURIComponent(`${restaurant?.name} ${keywords}`)
    const doordashUrl = `https://www.doordash.com/store-search/?query=${searchQuery}`
    window.open(doordashUrl, '_blank')
  }

  const getMacroFitColor = (score: number) => {
    if (score >= 90) return 'text-green-400 bg-green-900/30 border-green-500/30'
    if (score >= 70) return 'text-yellow-400 bg-yellow-900/30 border-yellow-500/30'
    return 'text-red-400 bg-red-900/30 border-red-500/30'
  }

  const calculateFitScore = (meal: MealTemplate) => {
    if (!userTargets) return 0

    const targetCalories = userTargets.calories * 0.35 // 35% of remaining
    const targetProtein = userTargets.protein * 0.35

    const caloriesDiff = Math.abs(meal.calories - targetCalories) / targetCalories
    const proteinDiff = Math.abs(meal.protein - targetProtein) / targetProtein

    return Math.max(0, 100 - (caloriesDiff * 50) - (proteinDiff * 30))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-2 border-blue-500 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-400 text-sm">Loading restaurant menu...</p>
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
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.back()}
                className="text-gray-400 hover:text-white transition-colors flex items-center space-x-2"
              >
                <span>←</span>
                <span className="text-sm">Back</span>
              </button>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
                  <span className="text-white text-sm">🍽️</span>
                </div>
                <h1 className="text-xl font-semibold text-white">
                  {restaurant?.name || 'Restaurant Menu'}
                </h1>
              </div>
            </div>
            <nav className="flex items-center space-x-6">
              <a href="/dashboard" className="text-gray-400 hover:text-white transition-colors text-sm">Dashboard</a>
              <a href="/profile" className="text-gray-400 hover:text-white transition-colors text-sm">Profile</a>
            </nav>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Restaurant Info */}
        {restaurant && (
          <div className="glass rounded-2xl p-8 mb-8 card-hover">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">{restaurant.name}</h2>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <p className="text-gray-400 text-sm">{restaurant.distance.toFixed(1)} miles away</p>
                </div>
              </div>
              <button
                onClick={generateAIInsights}
                disabled={aiLoading}
                className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-xl hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 transition-all flex items-center space-x-2"
              >
                <span>🤖</span>
                <span>{aiLoading ? 'Analyzing...' : 'Get AI Insights'}</span>
              </button>
            </div>

            {userTargets && (
              <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-xl p-6 border border-blue-500/30">
                <h3 className="font-semibold text-blue-300 mb-4 text-lg">Your Remaining Daily Targets</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-400 mb-1">{userTargets.calories}</div>
                    <div className="text-xs text-gray-400 uppercase tracking-wide">calories</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-400 mb-1">{userTargets.protein}g</div>
                    <div className="text-xs text-gray-400 uppercase tracking-wide">protein</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-400 mb-1">{userTargets.carbs}g</div>
                    <div className="text-xs text-gray-400 uppercase tracking-wide">carbs</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-400 mb-1">{userTargets.fat}g</div>
                    <div className="text-xs text-gray-400 uppercase tracking-wide">fat</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Meals */}
        <div>
          <div className="flex items-center space-x-3 mb-8">
            <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm">🍔</span>
            </div>
            <h2 className="text-2xl font-bold text-white">Available Meals</h2>
          </div>

          {meals.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {meals.map((meal) => {
                const fitScore = calculateFitScore(meal)
                return (
                  <div key={meal.id} className="glass rounded-xl p-6 card-hover">
                    <div className="flex items-start justify-between mb-4">
                      <h3 className="font-semibold text-white text-lg">{meal.title}</h3>
                      {userTargets && (
                        <span className={`px-3 py-1 rounded-lg text-xs font-semibold border ${getMacroFitColor(fitScore)}`}>
                          {fitScore.toFixed(0)}% fit
                        </span>
                      )}
                    </div>

                    <p className="text-gray-400 text-sm mb-6 leading-relaxed">{meal.description}</p>

                    {meal.aiDescription && (
                      <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-lg p-4 mb-4 border border-purple-500/30">
                        <div className="flex items-start space-x-3">
                          <div className="w-6 h-6 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-white text-xs">🤖</span>
                          </div>
                          <p className="text-purple-300 text-sm leading-relaxed">{meal.aiDescription}</p>
                        </div>
                      </div>
                    )}

                    {meal.personalizedNote && (
                      <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 rounded-lg p-4 mb-4 border border-green-500/30">
                        <div className="flex items-start space-x-3">
                          <div className="w-6 h-6 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-white text-xs">💡</span>
                          </div>
                          <p className="text-green-300 text-sm leading-relaxed">{meal.personalizedNote}</p>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-4 gap-3 mb-6">
                      <div className="bg-gray-900/50 rounded-lg py-3 text-center">
                        <div className="font-semibold text-blue-400 text-sm">{meal.calories}</div>
                        <div className="text-gray-500 text-xs">cal</div>
                      </div>
                      <div className="bg-gray-900/50 rounded-lg py-3 text-center">
                        <div className="font-semibold text-green-400 text-sm">{meal.protein}g</div>
                        <div className="text-gray-500 text-xs">protein</div>
                      </div>
                      <div className="bg-gray-900/50 rounded-lg py-3 text-center">
                        <div className="font-semibold text-yellow-400 text-sm">{meal.carbs}g</div>
                        <div className="text-gray-500 text-xs">carbs</div>
                      </div>
                      <div className="bg-gray-900/50 rounded-lg py-3 text-center">
                        <div className="font-semibold text-purple-400 text-sm">{meal.fat}g</div>
                        <div className="text-gray-500 text-xs">fat</div>
                      </div>
                    </div>

                    {meal.tags && meal.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-6">
                        {meal.tags.map((tag, index) => (
                          <span key={index} className="px-2 py-1 bg-gray-800/50 text-gray-300 text-xs rounded-md border border-gray-700/50">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex space-x-3">
                      <button className="flex-1 bg-gray-700/50 text-gray-300 text-sm py-3 rounded-lg hover:bg-gray-700 transition-all">
                        Add to Log
                      </button>
                      <button
                        onClick={() => openDeliveryApp(meal.title, meal.keywordsForDeliverySearch)}
                        className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 text-white text-sm py-3 rounded-lg hover:from-blue-700 hover:to-blue-600 transition-all"
                      >
                        Order Now
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="glass rounded-2xl p-16 text-center">
              <div className="text-gray-600 text-6xl mb-6">🍽️</div>
              <h3 className="text-xl font-semibold text-white mb-3">No meals found</h3>
              <p className="text-gray-400">We don't have nutrition data for this restaurant yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}