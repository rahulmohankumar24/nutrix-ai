'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import { ArrowLeft, Star, MapPin, Clock, Phone, ExternalLink } from 'lucide-react'

interface Restaurant {
  id: string
  name: string
  distance: number
  tags?: Record<string, string>
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
  aiScore?: number
  aiReasoning?: string
  buildInstructions?: string
  ingredients?: any[]
}

export default function RestaurantPage() {
  const params = useParams()
  const { user } = useUser()
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [meals, setMeals] = useState<MealTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [aiLoading, setAiLoading] = useState(false)

  useEffect(() => {
    if (params.id && user?.id) {
      loadRestaurantAndMeals()
    }
  }, [params.id, user?.id])

  const loadRestaurantAndMeals = async () => {
    try {
      // Get restaurant info from localStorage
      const restaurantData = localStorage.getItem(`restaurant_${params.id}`)
      if (restaurantData) {
        const restaurantInfo = JSON.parse(restaurantData)
        setRestaurant(restaurantInfo)

        // Load meals for this restaurant
        await generateMeals(restaurantInfo)
      }
    } catch (error) {
      console.error('Failed to load restaurant:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateMeals = async (restaurantInfo: Restaurant) => {
    setAiLoading(true)
    try {
      // Fetch user's macro progress
      const macroResponse = await fetch(`/api/macro-progress?userId=${user?.id}`)
      if (!macroResponse.ok) throw new Error('Failed to fetch macro progress')
      const macroProgress = await macroResponse.json()

      // Fetch user profile for schedule
      const profileResponse = await fetch(`/api/profile?userId=${user?.id}`)
      let userSchedule = null
      if (profileResponse.ok) {
        const profileData = await profileResponse.json()
        if (profileData.profile) {
          userSchedule = {
            wakeTime: profileData.profile.wakeTime,
            lunchTime: profileData.profile.lunchTime,
            dinnerTime: profileData.profile.dinnerTime
          }
        }
      }

      const timeOfDay = getCurrentTimeOfDay()
      const isCustomizable = isCustomizableRestaurant(restaurantInfo.name)

      // Check if restaurant has existing meal data
      let hasExistingData = false
      if (!isCustomizable) {
        try {
          const existingMealsResponse = await fetch(
            `/api/restaurant-meals?restaurantBrand=${encodeURIComponent(restaurantInfo.name)}`
          )
          if (existingMealsResponse.ok) {
            const existingData = await existingMealsResponse.json()
            hasExistingData = existingData.meals && existingData.meals.length > 0
          }
        } catch (error) {
          console.log('No existing meal data found')
        }
      }

      let response
      if (isCustomizable) {
        // Use AI meal builder for customizable restaurants
        response = await fetch('/api/ai-meal-builder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            restaurantBrand: restaurantInfo.name,
            userTargets: macroProgress,
            userId: user?.id,
            timeOfDay,
            userProfile: { goal: 'recomp', liftingDays: 4, stepsLevel: 'med' },
            useEnhancedAI: true,
            userSchedule
          })
        })

        if (response.ok) {
          const data = await response.json()
          if (data.customMeals) {
            const convertedMeals = data.customMeals.map((meal: any) => ({
              id: meal.id,
              title: meal.title,
              description: meal.buildInstructions || meal.description,
              calories: meal.totalCalories,
              protein: meal.totalProtein,
              carbs: meal.totalCarbs,
              fat: meal.totalFat,
              tags: meal.ingredients?.map((i: any) => i.name) || [],
              restaurantBrand: restaurantInfo.name,
              aiReasoning: meal.reasoning
            }))
            setMeals(convertedMeals)
          }
        }
      } else if (hasExistingData) {
        // Use unified AI coach for fixed-menu restaurants
        response = await fetch('/api/ai-unified-meal-coach', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            restaurantBrand: restaurantInfo.name,
            userTargets: macroProgress,
            userId: user?.id,
            timeOfDay,
            userProfile: { goal: 'recomp', liftingDays: 4, stepsLevel: 'med' },
            useAI: true,
            userSchedule
          })
        })

        if (response.ok) {
          const data = await response.json()
          if (data.meals) {
            setMeals(data.meals)
          }
        }
      } else {
        // Use estimation API for unknown restaurants
        response = await fetch('/api/estimate-restaurant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            restaurantName: restaurantInfo.name,
            userTargets: macroProgress.remaining,
            userId: user?.id,
            timeOfDay
          })
        })

        if (response.ok) {
          const data = await response.json()
          if (data.estimatedMeals) {
            setMeals(data.estimatedMeals)
          }
        }
      }
    } catch (error) {
      console.error('Failed to generate meals:', error)
    } finally {
      setAiLoading(false)
    }
  }

  const getCurrentTimeOfDay = () => {
    const hour = new Date().getHours()
    if (hour >= 5 && hour < 11) return 'breakfast'
    if (hour >= 11 && hour < 15) return 'lunch'
    if (hour >= 15 && hour < 18) return 'snack'
    if (hour >= 18 && hour < 22) return 'dinner'
    return 'snack'
  }

  const isCustomizableRestaurant = (restaurantName: string) => {
    const customizable = ['cava', 'chipotle', 'subway', 'sweetgreen', 'qdoba', "moe's", 'blaze pizza', 'mod pizza']
    return customizable.some(name => restaurantName.toLowerCase().includes(name.toLowerCase()))
  }

  const getRestaurantInfo = () => {
    if (!restaurant) return { rating: 4.5, type: 'Restaurant', address: '', hours: '', phone: '' }

    return {
      rating: 4.5 + (Math.random() * 0.5),
      type: restaurant.tags?.cuisine || 'Restaurant',
      address: `${restaurant.distance.toFixed(1)} miles away`,
      hours: 'Open now • Closes 10PM',
      phone: '(555) 123-4567'
    }
  }

  if (loading || !restaurant) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-2 border-primary border-t-transparent mx-auto"></div>
          <p className="mt-4 text-muted-foreground text-sm">Loading restaurant...</p>
        </div>
      </div>
    )
  }

  const restaurantInfo = getRestaurantInfo()

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Back Button */}
        <Link
          href="/restaurants"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to restaurants
        </Link>

        {/* Restaurant Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4 mb-3">
            <h1 className="text-3xl font-bold text-foreground">{restaurant.name}</h1>
            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold">
              95% match
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-4">
            <span className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              {restaurantInfo.rating.toFixed(1)}
              <span className="text-xs">(200+ reviews)</span>
            </span>
            <span>•</span>
            <span>{restaurantInfo.type}</span>
            <span>•</span>
            <span>$$</span>
          </div>

          <p className="text-muted-foreground mb-4">
            Great options for your nutrition goals
          </p>

          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              {restaurantInfo.address}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              {restaurantInfo.hours}
            </span>
            <span className="flex items-center gap-1.5">
              <Phone className="h-4 w-4" />
              {restaurantInfo.phone}
            </span>
          </div>
        </div>

        {/* Menu Section */}
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-4">Recommended Menu Items</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Items personalized for your nutrition goals
          </p>

          {aiLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary border-t-transparent mx-auto"></div>
                <p className="mt-4 text-sm text-muted-foreground">Generating personalized meals...</p>
              </div>
            </div>
          ) : meals.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No meal recommendations available</p>
            </div>
          ) : (
            <div className="space-y-4">
              {meals.map((item, idx) => (
                <div
                  key={idx}
                  className="p-5 rounded-xl border border-border bg-card hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground mb-1">{item.title}</h3>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                      {item.aiReasoning && (
                        <p className="text-xs text-primary mt-2">💡 {item.aiReasoning}</p>
                      )}
                    </div>
                    {item.aiScore && (
                      <span className="text-sm font-semibold text-primary whitespace-nowrap">
                        {item.aiScore}% match
                      </span>
                    )}
                  </div>

                  {item.tags && item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3 mb-4">
                      {item.tags.slice(0, 5).map((tag, tagIdx) => (
                        <span key={tagIdx} className="px-2 py-0.5 rounded-full bg-muted text-xs text-muted-foreground">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-4 gap-4 pt-3 border-t border-border">
                    <div className="text-center">
                      <p className="text-lg font-semibold text-foreground">{Math.round(item.calories)}</p>
                      <p className="text-xs text-muted-foreground">calories</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-semibold text-primary">{Math.round(item.protein)}g</p>
                      <p className="text-xs text-muted-foreground">protein</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-semibold text-foreground">{Math.round(item.carbs)}g</p>
                      <p className="text-xs text-muted-foreground">carbs</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-semibold text-foreground">{Math.round(item.fat)}g</p>
                      <p className="text-xs text-muted-foreground">fat</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Get Directions Button */}
        <div className="mt-8 pt-6 border-t border-border">
          <button
            onClick={() => window.open(`https://www.google.com/maps/search/${encodeURIComponent(restaurant.name)}`, '_blank')}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-neutral-900 text-white font-medium hover:bg-neutral-800 transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            Get Directions
          </button>
        </div>
      </div>
    </main>
  )
}
