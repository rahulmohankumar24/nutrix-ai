'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'

interface Food {
  id: string
  name: string
  source: string
  calories: number
  protein: number
  carbs: number
  fat: number
  tags: string[]
  aiApproved?: boolean
  reasoning?: string
  preparationTips?: string
  macroImpact?: string
}

interface MacroTargets {
  targets: { calories: number; protein: number; carbs: number; fat: number }
  current: { calories: number; protein: number; carbs: number; fat: number }
  remaining: { calories: number; protein: number; carbs: number; fat: number }
}

export default function SnacksPage() {
  const router = useRouter()
  const { user, isLoaded, isSignedIn } = useUser()
  const [foods, setFoods] = useState<Food[]>([])
  const [userTargets, setUserTargets] = useState<MacroTargets | null>(null)
  const [loading, setLoading] = useState(true)
  const [aiLoading, setAiLoading] = useState(false)
  const [selectedSource, setSelectedSource] = useState<string>('all')
  const [coachingData, setCoachingData] = useState<any>(null)

  useEffect(() => {
    if (!isLoaded) return

    if (!isSignedIn) {
      router.push('/auth/signin')
      return
    }

    if (user?.id) {
      loadUserTargets()
    }
  }, [user, isLoaded, isSignedIn, router])

  useEffect(() => {
    if (userTargets) {
      loadFoodItems()
    }
  }, [userTargets, selectedSource])

  const getCurrentTimeOfDay = () => {
    const hour = new Date().getHours()
    if (hour >= 5 && hour < 11) return 'breakfast'
    if (hour >= 11 && hour < 15) return 'lunch'
    if (hour >= 15 && hour < 18) return 'snack'
    if (hour >= 18 && hour < 22) return 'dinner'
    return 'snack'
  }

  const loadUserTargets = async () => {
    try {
      const response = await fetch(`/api/macro-progress?userId=${user?.id}&timezone=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`)
      if (response.ok) {
        const data = await response.json()
        setUserTargets(data)
      } else if (response.status === 404) {
        router.push('/onboarding')
        return
      }
    } catch (error) {
      console.error('Failed to load user targets:', error)
    }
  }

  const loadFoodItems = async () => {
    if (!userTargets) return

    setLoading(true)
    try {
      const timeOfDay = getCurrentTimeOfDay()
      const userTargetsString = encodeURIComponent(JSON.stringify(userTargets))

      let url = `/api/food-catalog?userTargets=${userTargetsString}&timeOfDay=${timeOfDay}`
      if (selectedSource !== 'all') {
        url += `&source=${selectedSource}`
      }

      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setFoods(data.foods || [])

        // Automatically get AI coaching for these foods
        await getAICoaching(data.foods)
      }
    } catch (error) {
      console.error('Failed to load food items:', error)
    } finally {
      setLoading(false)
    }
  }

  const getAICoaching = async (foodItems?: Food[]) => {
    if (!userTargets || aiLoading) return

    setAiLoading(true)
    try {
      const timeOfDay = getCurrentTimeOfDay()

      const response = await fetch('/api/ai-food-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: selectedSource !== 'all' ? selectedSource : undefined,
          userTargets,
          timeOfDay,
          userProfile: {
            goal: 'recomp',
            liftingDays: 4,
            stepsLevel: 'med'
          }
        })
      })

      if (response.ok) {
        const data = await response.json()
        setCoachingData(data.coaching)
        // Replace foods with only AI-approved ones
        if (data.approvedFoods) {
          setFoods(data.approvedFoods)
        }
      }
    } catch (error) {
      console.error('Failed to get AI coaching:', error)
    } finally {
      setAiLoading(false)
    }
  }

  const logFood = async (food: Food) => {
    if (!user?.id) return

    try {
      const response = await fetch('/api/log-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          foodCatalogItemId: food.id,
          servings: 1
        })
      })

      if (response.ok) {
        // Optionally reload user targets to update progress
        await loadUserTargets()
        alert(`${food.name} logged successfully!`)
      }
    } catch (error) {
      console.error('Failed to log food:', error)
      alert('Failed to log food')
    }
  }

  if (loading && !foods.length) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-2 border-green-500 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-400 text-sm">Finding perfect foods for you...</p>
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
              <h1 className="text-xl font-semibold text-white">Smart Food Finder</h1>
            </div>
            <nav className="flex items-center space-x-6">
              <Link href="/dashboard" className="text-gray-400 hover:text-white transition-colors text-sm">
                Dashboard
              </Link>
              <Link href="/restaurants" className="text-gray-400 hover:text-white transition-colors text-sm">
                Restaurants
              </Link>
              <Link href="/profile" className="text-gray-400 hover:text-white transition-colors text-sm">
                Profile
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Filters */}
        <div className="glass rounded-2xl p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-4">Food Sources</h2>
          <div className="flex space-x-4">
            {[
              { value: 'all', label: 'All Foods' },
              { value: 'home', label: 'Home Foods' },
              { value: 'grocery', label: 'Grocery Items' },
              { value: 'restaurant', label: 'Restaurant' }
            ].map(source => (
              <button
                key={source.value}
                onClick={() => setSelectedSource(source.value)}
                className={`px-4 py-2 rounded-xl text-sm transition-all ${
                  selectedSource === source.value
                    ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {source.label}
              </button>
            ))}
          </div>
        </div>

        {/* AI Status */}
        {aiLoading && (
          <div className="glass rounded-xl p-4 mb-6 border border-green-500/30">
            <div className="flex items-center space-x-3">
              <div className="animate-pulse w-3 h-3 bg-green-500 rounded-full"></div>
              <p className="text-green-300 text-sm">AI is analyzing foods for your nutrition goals...</p>
            </div>
          </div>
        )}

        {/* AI Approved Foods */}
        {foods.length > 0 && (
          <div className="glass rounded-2xl p-8 mb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white">AI Recommended Foods</h2>
                <p className="text-gray-400 text-sm">
                  {foods.length} foods selected based on your current nutrition targets
                </p>
              </div>
              <div className="text-green-400 text-sm">
                Optimized for {getCurrentTimeOfDay()}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {foods.map((food) => (
                <div key={food.id} className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50 hover:border-green-500/30 transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-white text-lg">{food.name}</h3>
                      <p className="text-gray-400 text-sm capitalize">{food.source}</p>
                      {food.aiApproved && (
                        <span className="inline-block mt-2 px-2 py-1 bg-green-900/50 text-green-300 text-xs rounded-md border border-green-500/30">
                          Recommended
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Nutrition Info */}
                  <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                    <div className="text-blue-400">{food.calories} cal</div>
                    <div className="text-green-400">{food.protein}g protein</div>
                    <div className="text-yellow-400">{food.carbs}g carbs</div>
                    <div className="text-sky-400">{food.fat}g fat</div>
                  </div>

                  {/* AI Reasoning */}
                  {food.reasoning && (
                    <div className="bg-green-900/20 rounded-lg p-3 mb-4 border border-green-500/20">
                      <p className="text-green-200 text-xs">{food.reasoning}</p>
                    </div>
                  )}

                  {/* Preparation Tips */}
                  {food.preparationTips && (
                    <div className="bg-blue-900/20 rounded-lg p-3 mb-4 border border-blue-500/20">
                      <p className="text-blue-200 text-xs">{food.preparationTips}</p>
                    </div>
                  )}

                  {/* Log Button */}
                  <button
                    onClick={() => logFood(food)}
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-2 px-4 rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all text-sm font-medium"
                  >
                    Log This Food
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No Foods Found */}
        {!loading && foods.length === 0 && (
          <div className="glass rounded-2xl p-16 text-center">
            <h3 className="text-xl font-semibold text-white mb-3">No suitable foods found</h3>
            <p className="text-gray-400">Try selecting a different food source or check your nutrition targets.</p>
          </div>
        )}
      </div>
    </div>
  )
}