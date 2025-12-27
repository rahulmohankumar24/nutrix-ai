'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import { ArrowLeft, Star, MapPin, Clock, Phone, ExternalLink, Check } from 'lucide-react'

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
  customizations?: string[]
  macroImpact?: string
  baseCalories?: number
  baseProtein?: number
  baseCarbs?: number
  baseFat?: number
  fitScore?: number
  fitBadge?: 'PERFECT MATCH' | 'HIGHLY RECOMMENDED' | 'GOOD FIT' | 'OKAY' | null
  fitReasoning?: string
  caloriesFit?: number
  proteinFit?: number
}

export default function RestaurantPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useUser()
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [meals, setMeals] = useState<MealTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [aiLoading, setAiLoading] = useState(false)
  const [coachingAdvice, setCoachingAdvice] = useState<string | null>(null)
  const [loggingMealId, setLoggingMealId] = useState<string | null>(null)
  const [loggedMealId, setLoggedMealId] = useState<string | null>(null)

  useEffect(() => {
    if (params.id && user?.id) {
      // Check if we're coming from a fresh restaurant click
      const isGenerating = sessionStorage.getItem('generatingMeals')
      if (isGenerating === 'true') {
        setAiLoading(true) // Show loading immediately
        sessionStorage.removeItem('generatingMeals') // Clear flag
      }

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
      // Fetch FRESH user's macro progress (no cache)
      const macroResponse = await fetch(`/api/macro-progress?userId=${user?.id}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      })
      if (!macroResponse.ok) throw new Error('Failed to fetch macro progress')
      const macroProgress = await macroResponse.json()

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('🎯 RESTAURANT PAGE - User Macro Progress')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('  Targets:', macroProgress.targets)
      console.log('  Current:', macroProgress.current)
      console.log('  Remaining:', macroProgress.remaining)
      console.log(`  Progress: ${macroProgress.current.calories}/${macroProgress.targets.calories} cal (${Math.round(macroProgress.current.calories/macroProgress.targets.calories*100)}%)`)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('')
      console.log('⚠️ CHECK: Is this data correct? Does the "Remaining" match what you expect?')
      console.log('')

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
            userSchedule,
            bypassCache: false // Set to true to bypass cache for fresh calculations
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
              aiReasoning: meal.reasoning,
              fitScore: meal.fitScore,
              fitBadge: meal.fitBadge,
              fitReasoning: meal.fitReasoning,
              caloriesFit: meal.caloriesFit,
              proteinFit: meal.proteinFit,
              ingredients: meal.ingredients,
              buildInstructions: meal.buildInstructions,
              customizations: meal.customizations
            }))
            setMeals(convertedMeals)
            setCoachingAdvice(data.coaching?.overallAdvice || null)
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
            userSchedule,
            bypassCache: false // Set to true to bypass cache for fresh calculations
          })
        })

        if (response.ok) {
          const data = await response.json()
          if (data.meals) {
            // Ensure each meal has the restaurantBrand set
            const mealsWithBrand = data.meals.map((meal: any) => ({
              ...meal,
              restaurantBrand: restaurantInfo.name
            }))
            setMeals(mealsWithBrand)
            setCoachingAdvice(data.coaching?.overallAdvice || null)
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
            setCoachingAdvice(data.coaching?.overallAdvice || null)
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
    const now = new Date()
    const hour = now.getHours()
    const minutes = now.getMinutes()

    console.log(`\n🕐 CLIENT TIME DETECTION:`)
    console.log(`  Current time: ${hour}:${minutes.toString().padStart(2, '0')}`)
    console.log(`  Testing conditions:`)
    console.log(`    hour >= 5 && hour < 11? ${hour >= 5 && hour < 11} (breakfast)`)
    console.log(`    hour >= 11 && hour < 15? ${hour >= 11 && hour < 15} (lunch)`)
    console.log(`    hour >= 15 && hour < 18? ${hour >= 15 && hour < 18} (snack)`)
    console.log(`    hour >= 18 && hour < 22? ${hour >= 18 && hour < 22} (dinner)`)

    let timeOfDay = 'snack'
    if (hour >= 5 && hour < 11) {
      timeOfDay = 'breakfast'
      console.log(`  ✓ Matched: breakfast`)
    }
    else if (hour >= 11 && hour < 15) {
      timeOfDay = 'lunch'
      console.log(`  ✓ Matched: lunch`)
    }
    else if (hour >= 15 && hour < 17) {
      timeOfDay = 'snack'
      console.log(`  ✓ Matched: snack (3pm-5pm)`)
    }
    else if (hour >= 17 && hour < 22) {
      timeOfDay = 'dinner'
      console.log(`  ✓ Matched: dinner (5pm-10pm)`)
    }
    else {
      console.log(`  ✓ Default: snack (late night)`)
    }

    console.log(`  ⏰ FINAL RESULT: ${timeOfDay}\n`)

    return timeOfDay
  }

  const isCustomizableRestaurant = (restaurantName: string) => {
    const customizable = ['cava', 'chipotle', 'subway', 'sweetgreen', 'qdoba', "moe's", 'blaze pizza', 'mod pizza']
    return customizable.some(name => restaurantName.toLowerCase().includes(name.toLowerCase()))
  }

  const handleLogMeal = async (meal: MealTemplate) => {
    if (!user?.id || !restaurant) return

    setLoggingMealId(meal.id)

    try {
      // Save and log the custom meal
      const response = await fetch('/api/save-custom-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          restaurantBrand: restaurant.name,
          title: meal.title,
          description: meal.description,
          calories: meal.calories,
          protein: meal.protein,
          carbs: meal.carbs,
          fat: meal.fat,
          ingredients: meal.ingredients,
          buildInstructions: meal.buildInstructions || meal.description,
          customizations: meal.customizations
        })
      })

      if (!response.ok) {
        throw new Error('Failed to log meal')
      }

      const data = await response.json()
      console.log('Meal logged successfully:', data)

      // Show success state
      setLoggedMealId(meal.id)
      setLoggingMealId(null)

      // Wait 1 second to show success, then navigate to dashboard
      setTimeout(() => {
        router.push('/log')
      }, 1000)

    } catch (error) {
      console.error('Failed to log meal:', error)
      alert('Failed to log meal. Please try again.')
      setLoggingMealId(null)
    }
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
          <p className="text-sm text-muted-foreground mb-4">
            Items personalized for your nutrition goals
          </p>

          {/* AI Coaching Advice */}
          {coachingAdvice && (
            <div className="mb-6 p-4 rounded-xl bg-primary/10 border border-primary/20">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🎯</span>
                <div className="flex-1">
                  <p className="font-medium text-foreground mb-1">AI Nutrition Coach</p>
                  <p className="text-sm text-muted-foreground">{coachingAdvice}</p>
                </div>
              </div>
            </div>
          )}

          {aiLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center max-w-md">
                <div className="relative">
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary/20 border-t-primary mx-auto"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl">🍽️</span>
                  </div>
                </div>
                <h3 className="mt-6 text-lg font-semibold text-foreground">Generating Your Personalized Meals</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Analyzing your macro targets and creating the perfect meal options for you...
                </p>
                <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <div className="h-1.5 w-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="h-1.5 w-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="h-1.5 w-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          ) : meals.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No meal recommendations available</p>
            </div>
          ) : (
            <div className="space-y-4">
              {meals.map((item, idx) => {
                const getBadgeColor = (badge: string | null | undefined) => {
                  switch (badge) {
                    case 'PERFECT MATCH': return 'bg-green-500/20 text-green-700 border-green-500/30'
                    case 'HIGHLY RECOMMENDED': return 'bg-blue-500/20 text-blue-700 border-blue-500/30'
                    case 'GOOD FIT': return 'bg-purple-500/20 text-purple-700 border-purple-500/30'
                    case 'OKAY': return 'bg-gray-500/20 text-gray-700 border-gray-500/30'
                    default: return 'bg-primary/10 text-primary border-primary/20'
                  }
                }

                return (
                  <div
                    key={idx}
                    className={`p-5 rounded-xl border transition-all ${
                      item.fitBadge === 'PERFECT MATCH' || item.fitBadge === 'HIGHLY RECOMMENDED'
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border bg-card hover:border-primary/30'
                    }`}
                  >
                    {/* Fit Badge */}
                    {item.fitBadge && (
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getBadgeColor(item.fitBadge)}`}>
                          {item.fitBadge}
                        </span>
                        {item.fitScore !== undefined && (
                          <span className="text-xs font-semibold text-muted-foreground">
                            {item.fitScore}/100 match
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground mb-1">{item.title}</h3>
                        <p className="text-sm text-muted-foreground">{item.description}</p>

                        {/* Fit Reasoning - show why this meal is recommended */}
                        {item.fitReasoning && (
                          <div className="mt-2 p-2 rounded-lg bg-primary/5 border border-primary/10">
                            <p className="text-xs text-foreground">
                              <span className="font-medium">🎯 Why this works: </span>
                              {item.fitReasoning}
                            </p>
                          </div>
                        )}

                        {/* AI Reasoning - show only if different from fit reasoning */}
                        {item.aiReasoning && item.aiReasoning !== item.fitReasoning && (
                          <div className="mt-2 p-2 rounded-lg bg-muted">
                            <p className="text-xs text-muted-foreground">
                              <span className="font-medium">💡 </span>
                              {item.aiReasoning}
                            </p>
                            {item.macroImpact && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {item.macroImpact}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Customizations */}
                        {item.customizations && item.customizations.length > 0 && (
                          <div className="mt-3 space-y-1.5">
                            <p className="text-xs font-medium text-foreground uppercase tracking-wide">Recommended Add-ons:</p>
                            {item.customizations.map((customization: string, custIdx: number) => (
                              <div key={custIdx} className="flex items-start gap-2 text-xs">
                                <span className="text-primary mt-0.5">+</span>
                                <span className="text-muted-foreground">{customization}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
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

                    <div className="grid grid-cols-4 gap-4 pt-3 border-t border-border mb-4">
                      <div className="text-center">
                        <p className="text-lg font-semibold text-foreground">{Math.round(item.calories)}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.customizations && item.customizations.length > 0 ? 'total calories' : 'calories'}
                        </p>
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

                    {/* Log Meal Button */}
                    <button
                      onClick={() => handleLogMeal(item)}
                      disabled={loggingMealId === item.id || loggedMealId === item.id}
                      className={`w-full py-3 rounded-xl font-medium transition-all ${
                        loggedMealId === item.id
                          ? 'bg-green-500 text-white'
                          : loggingMealId === item.id
                          ? 'bg-muted text-muted-foreground cursor-wait'
                          : 'bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98]'
                      }`}
                    >
                      {loggedMealId === item.id ? (
                        <span className="flex items-center justify-center gap-2">
                          <Check className="h-5 w-5" />
                          Logged! Redirecting...
                        </span>
                      ) : loggingMealId === item.id ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="h-4 w-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                          Logging meal...
                        </span>
                      ) : (
                        'Log This Meal'
                      )}
                    </button>
                  </div>
                )
              })}
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
