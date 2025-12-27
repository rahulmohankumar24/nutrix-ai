'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import { ArrowLeft, MapPin, Clock, Phone, ExternalLink, Check, ThumbsUp, ThumbsDown, MessageSquare, X } from 'lucide-react'

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
  const [showFeedbackFor, setShowFeedbackFor] = useState<string | null>(null)
  const [submittingFeedback, setSubmittingFeedback] = useState(false)

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
        setLoading(false) // Show restaurant info immediately

        // Load meals for this restaurant (this will show AI loading in the meals section)
        await generateMeals(restaurantInfo)
      } else {
        // No restaurant data found
        setLoading(false)
      }
    } catch (error) {
      console.error('Failed to load restaurant:', error)
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

      const timeInfo = getCurrentTimeOfDay()
      const { timeOfDay, currentTimeString, currentHour } = timeInfo
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
            currentTime: currentTimeString,
            currentHour,
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
            currentTime: currentTimeString,
            currentHour,
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
        // Use AI web search and menu analysis for unknown restaurants
        console.log(`🔍 Unknown restaurant detected: ${restaurantInfo.name}, using AI menu analysis`)
        response = await fetch('/api/analyze-unknown-restaurant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            restaurantName: restaurantInfo.name,
            userTargets: macroProgress,
            userId: user?.id,
            timeOfDay,
            currentTime: currentTimeString,
            currentHour,
            userProfile: { goal: 'recomp', liftingDays: 4, stepsLevel: 'med' }
          })
        })

        if (response.ok) {
          const data = await response.json()
          if (data.meals && data.meals.length > 0) {
            // Add a flag to show these are AI-analyzed meals
            const analyzedMeals = data.meals.map((meal: any) => ({
              ...meal,
              isAIAnalyzed: true,
              estimatedNutrition: meal.estimatedNutrition,
              source: meal.source
            }))
            setMeals(analyzedMeals)
            setCoachingAdvice(data.coaching?.overallAdvice || data.restaurantInfo?.generalAdvice || null)
          } else {
            // No menu found, show helpful message
            setCoachingAdvice(data.restaurantInfo?.generalAdvice || 'Menu information not available. Look for grilled proteins and vegetables.')
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
    // Get explicit current time to pass to AI
    const now = new Date()
    const hour = now.getHours()
    const minutes = now.getMinutes()
    const currentTimeString = `${hour}:${minutes.toString().padStart(2, '0')}`

    console.log(`\n🕐 EXPLICIT TIME DETECTION:`)
    console.log(`  Current time: ${currentTimeString}`)
    console.log(`  Hour: ${hour}`)

    // Determine meal type based on time windows (NO SNACKS)
    // Default to closest meal time
    let timeOfDay: 'breakfast' | 'lunch' | 'dinner'

    if (hour >= 5 && hour < 11) {
      timeOfDay = 'breakfast'
      console.log(`  ✓ Matched: breakfast (5am-11am)`)
    }
    else if (hour >= 11 && hour < 16) {
      timeOfDay = 'lunch'
      console.log(`  ✓ Matched: lunch (11am-4pm)`)
    }
    else if (hour >= 16 && hour < 23) {
      timeOfDay = 'dinner'
      console.log(`  ✓ Matched: dinner (4pm-11pm)`)
    }
    else {
      // Late night (11pm-5am) - default to dinner for last meal
      timeOfDay = 'dinner'
      console.log(`  ✓ Late night - defaulting to dinner`)
    }

    console.log(`  ⏰ FINAL RESULT: ${timeOfDay}`)
    console.log(`  📅 This explicit time will be passed to the AI\n`)

    return { timeOfDay, currentTimeString, currentHour: hour }
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

  const handleSubmitFeedback = async (mealId: string, feedbackType: string, suggestions?: any) => {
    if (!user?.id) return

    setSubmittingFeedback(true)

    try {
      const response = await fetch('/api/meal-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          aiGeneratedMealId: mealId,
          feedbackType,
          ...suggestions
        })
      })

      if (!response.ok) {
        throw new Error('Failed to submit feedback')
      }

      const data = await response.json()

      // Update the meal in the local state with the updated data
      setMeals(prevMeals =>
        prevMeals.map(meal => {
          if ((meal as any).aiGeneratedMealId === mealId) {
            return {
              ...meal,
              calories: data.updatedMeal.calories,
              protein: data.updatedMeal.protein,
              carbs: data.updatedMeal.carbs,
              fat: data.updatedMeal.fat,
              feedbackCount: data.updatedMeal.feedbackCount,
              confidenceScore: data.updatedMeal.confidenceScore
            }
          }
          return meal
        })
      )

      setShowFeedbackFor(null)
      alert('Thank you for your feedback! This helps improve our recommendations.')
    } catch (error) {
      console.error('Failed to submit feedback:', error)
      alert('Failed to submit feedback. Please try again.')
    } finally {
      setSubmittingFeedback(false)
    }
  }

  const getRestaurantInfo = () => {
    if (!restaurant) return { type: 'Restaurant', address: '', hours: '', phone: '' }

    return {
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
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Back Button */}
        <Link
          href="/restaurants"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to restaurants
        </Link>

        {/* Restaurant Header with AI Coach */}
        <div className="mb-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Restaurant Info */}
          <div>
            <div className="mb-3">
              <h1 className="text-3xl font-bold text-foreground">{restaurant.name}</h1>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-4">
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

          {/* AI Coaching Advice */}
          {coachingAdvice && (
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 shadow-lg h-fit">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
              <div className="relative p-5">
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-2xl">🎯</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-base font-bold text-foreground">AI Nutrition Coach</h3>
                      <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-semibold">Live</span>
                    </div>
                    <p className="text-xs text-muted-foreground/80">
                      Based on your current progress
                    </p>
                  </div>
                </div>
                <div className="bg-background/60 backdrop-blur-sm rounded-xl p-3 border border-primary/10">
                  <p className="text-sm leading-relaxed text-foreground">
                    {coachingAdvice}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Menu Section */}
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-4">Recommended Menu Items</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Items personalized for your nutrition goals
          </p>

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
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
                    className={`p-5 rounded-xl border transition-all flex flex-col ${
                      item.fitBadge === 'PERFECT MATCH' || item.fitBadge === 'HIGHLY RECOMMENDED'
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border bg-card hover:border-primary/30'
                    }`}
                  >
                    {/* Content wrapper - flex-1 to push button to bottom */}
                    <div className="flex-1 flex flex-col">
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

                    {/* Show AI analysis badge for unknown restaurants */}
                    {(item as any).isAIAnalyzed && (
                      <div className="mt-3 mb-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                        <div className="flex items-start gap-2 mb-3">
                          <span className="text-blue-600 text-xs">🤖</span>
                          <div className="flex-1">
                            <p className="text-xs font-medium text-blue-700">AI Menu Analysis</p>
                            <p className="text-xs text-blue-600 mt-0.5">
                              {(item as any).estimatedNutrition
                                ? 'Nutrition estimated based on typical ingredients'
                                : 'Found from online menu'}
                            </p>
                            {(item as any).source && (
                              <p className="text-xs text-blue-500 mt-1">Source: {(item as any).source}</p>
                            )}
                            {(item as any).feedbackCount > 0 && (
                              <p className="text-xs text-green-600 mt-1 font-medium">
                                ✓ Refined by {(item as any).feedbackCount} user feedback{(item as any).feedbackCount > 1 ? 's' : ''}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Feedback UI */}
                        {showFeedbackFor === item.id ? (
                          <div className="space-y-2 pt-2 border-t border-blue-500/20">
                            <p className="text-xs font-medium text-foreground">How accurate is this nutrition info?</p>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={() => handleSubmitFeedback((item as any).aiGeneratedMealId, 'accurate')}
                                disabled={submittingFeedback}
                                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-green-500/20 text-green-700 hover:bg-green-500/30 transition-colors text-xs font-medium disabled:opacity-50"
                              >
                                <ThumbsUp className="h-3.5 w-3.5" />
                                Accurate
                              </button>
                              <button
                                onClick={() => handleSubmitFeedback((item as any).aiGeneratedMealId, 'too_high')}
                                disabled={submittingFeedback}
                                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-orange-500/20 text-orange-700 hover:bg-orange-500/30 transition-colors text-xs font-medium disabled:opacity-50"
                              >
                                <ThumbsDown className="h-3.5 w-3.5" />
                                Too High
                              </button>
                              <button
                                onClick={() => handleSubmitFeedback((item as any).aiGeneratedMealId, 'too_low')}
                                disabled={submittingFeedback}
                                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-orange-500/20 text-orange-700 hover:bg-orange-500/30 transition-colors text-xs font-medium disabled:opacity-50"
                              >
                                <ThumbsDown className="h-3.5 w-3.5" />
                                Too Low
                              </button>
                              <button
                                onClick={() => setShowFeedbackFor(null)}
                                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gray-500/20 text-gray-700 hover:bg-gray-500/30 transition-colors text-xs font-medium"
                              >
                                <X className="h-3.5 w-3.5" />
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowFeedbackFor(item.id)}
                            className="flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-lg bg-blue-500/20 text-blue-700 hover:bg-blue-500/30 transition-colors text-xs font-medium"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                            Help Improve This
                          </button>
                        )}
                      </div>
                    )}
                    </div>

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
