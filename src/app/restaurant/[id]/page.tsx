'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import { ArrowLeft, MapPin, Clock, ExternalLink, Check, ThumbsUp, ThumbsDown, MessageSquare, X, Sparkles, Trophy, ChevronRight, Calendar, RefreshCw } from 'lucide-react'

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

interface MacroProgress {
  targets: { calories: number; protein: number; carbs: number; fat: number }
  current: { calories: number; protein: number; carbs: number; fat: number }
  remaining: { calories: number; protein: number; carbs: number; fat: number }
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
  const [coachingNote, setCoachingNote] = useState<string | null>(null)
  const [loggingMealId, setLoggingMealId] = useState<string | null>(null)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'assistant', content: string}[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [loggedMealId, setLoggedMealId] = useState<string | null>(null)
  const [showFeedbackFor, setShowFeedbackFor] = useState<string | null>(null)
  const [submittingFeedback, setSubmittingFeedback] = useState(false)
  const [feedbackData, setFeedbackData] = useState<{
    caloriesFeedback: 'accurate' | 'too_high' | 'too_low' | null
    proteinFeedback: 'accurate' | 'too_high' | 'too_low' | null
    suggestedCalories: string
    suggestedProtein: string
  }>({
    caloriesFeedback: null,
    proteinFeedback: null,
    suggestedCalories: '',
    suggestedProtein: ''
  })
  const [macroProgress, setMacroProgress] = useState<MacroProgress | null>(null)
  const [selectedMealType, setSelectedMealType] = useState<string>(() => {
    const hour = new Date().getHours()
    if (hour < 11) return 'breakfast'
    if (hour < 16) return 'lunch'
    return 'dinner'
  })
  // Scheduled meal time - allows users to plan for a future meal
  const [scheduledMealTime, setScheduledMealTime] = useState<'now' | 'breakfast' | 'lunch' | 'dinner'>('now')
  const [isRegenerating, setIsRegenerating] = useState(false)

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

  const generateMeals = async (restaurantInfo: Restaurant, scheduledTime?: 'breakfast' | 'lunch' | 'dinner') => {
    setAiLoading(true)
    try {
      // Fetch FRESH user's macro progress (no cache)
      const macroResponse = await fetch(`/api/macro-progress?userId=${user?.id}&timezone=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      })
      if (!macroResponse.ok) throw new Error('Failed to fetch macro progress')
      const macroData = await macroResponse.json()

      // Store macro progress for display
      setMacroProgress(macroData)

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

      // Use scheduled time if provided, otherwise detect from current time
      const timeInfo = getCurrentTimeOfDay(scheduledTime)
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
      let usedMealBuilder = false

      if (isCustomizable) {
        // Try AI meal builder first for customizable restaurants
        response = await fetch('/api/ai-meal-builder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            restaurantBrand: restaurantInfo.name,
            userTargets: macroData,
            userId: user?.id,
            timeOfDay,
            currentTime: currentTimeString,
            currentHour,
            userProfile: { goal: 'recomp', liftingDays: 4, stepsLevel: 'med' },
            useEnhancedAI: true,
            userSchedule,
            bypassCache: false
          })
        })

        if (response.ok) {
          const data = await response.json()
          if (data.customMeals) {
            usedMealBuilder = true
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
            setCoachingNote(data.coaching?.coachingNote || null)
          }
        }
      }

      // Fall back to unified meal coach if meal builder failed/not used, and restaurant has existing data
      if (!usedMealBuilder && (hasExistingData || isCustomizable)) {
        // Use unified AI coach for fixed-menu restaurants or as fallback for customizable ones
        response = await fetch('/api/ai-unified-meal-coach', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            restaurantBrand: restaurantInfo.name,
            userTargets: macroData,
            userId: user?.id,
            timeOfDay,
            currentTime: currentTimeString,
            currentHour,
            userProfile: { goal: 'recomp', liftingDays: 4, stepsLevel: 'med' },
            useAI: true,
            userSchedule,
            bypassCache: false
          })
        })

        if (response.ok) {
          const data = await response.json()
          if (data.meals) {
            const mealsWithBrand = data.meals.map((meal: any) => ({
              ...meal,
              restaurantBrand: restaurantInfo.name
            }))
            setMeals(mealsWithBrand)
            setCoachingAdvice(data.coaching?.overallAdvice || null)
            setCoachingNote(data.coaching?.coachingNote || null)
          }
        }
      }

      // Use AI web search for truly unknown restaurants (no existing data and not customizable)
      if (!usedMealBuilder && !hasExistingData && !isCustomizable) {
        response = await fetch('/api/analyze-unknown-restaurant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            restaurantName: restaurantInfo.name,
            userTargets: macroData,
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
            setCoachingNote(data.coaching?.coachingNote || null)
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

  const getCurrentTimeOfDay = (overrideMealTime?: 'breakfast' | 'lunch' | 'dinner') => {
    // Get explicit current time to pass to AI
    const now = new Date()
    const hour = now.getHours()
    const minutes = now.getMinutes()
    const currentTimeString = `${hour}:${minutes.toString().padStart(2, '0')}`

    console.log(`\n🕐 EXPLICIT TIME DETECTION:`)
    console.log(`  Current time: ${currentTimeString}`)
    console.log(`  Hour: ${hour}`)

    // If override is provided (scheduled meal), use that
    if (overrideMealTime) {
      console.log(`  📅 SCHEDULED MEAL: ${overrideMealTime}`)
      // Calculate a simulated hour for the scheduled meal
      const scheduledHour = overrideMealTime === 'breakfast' ? 8
        : overrideMealTime === 'lunch' ? 12
        : 18
      const scheduledTimeString = `${scheduledHour}:00`
      console.log(`  ⏰ Using scheduled time: ${scheduledTimeString}\n`)
      return { timeOfDay: overrideMealTime, currentTimeString: scheduledTimeString, currentHour: scheduledHour }
    }

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

  // Handle scheduled meal time change
  const handleScheduleChange = async (newSchedule: 'now' | 'breakfast' | 'lunch' | 'dinner') => {
    if (newSchedule === scheduledMealTime || !restaurant) return

    setScheduledMealTime(newSchedule)
    setIsRegenerating(true)

    // Regenerate meals with the new scheduled time
    const scheduledTime = newSchedule === 'now' ? undefined : newSchedule
    await generateMeals(restaurant, scheduledTime)
    setIsRegenerating(false)
  }

  // Get the display label for current meal time
  const getCurrentMealLabel = () => {
    if (scheduledMealTime !== 'now') {
      return scheduledMealTime.charAt(0).toUpperCase() + scheduledMealTime.slice(1)
    }
    const hour = new Date().getHours()
    if (hour < 11) return 'Breakfast'
    if (hour < 16) return 'Lunch'
    return 'Dinner'
  }

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim() || chatLoading || !restaurant) return

    const userMessage = chatInput.trim()
    setChatInput('')
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setChatLoading(true)

    try {
      const response = await fetch('/api/restaurant-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          restaurantName: restaurant.name,
          meals: meals.map(m => ({
            title: m.title,
            description: m.description,
            calories: m.calories,
            protein: m.protein,
            carbs: m.carbs,
            fat: m.fat,
            fitBadge: m.fitBadge
          })),
          conversationHistory: chatMessages
        })
      })

      if (response.ok) {
        const data = await response.json()
        setChatMessages(prev => [...prev, { role: 'assistant', content: data.response }])
      } else {
        setChatMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I had trouble answering that. Please try again.' }])
      }
    } catch (error) {
      console.error('Chat error:', error)
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }])
    } finally {
      setChatLoading(false)
    }
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
          customizations: meal.customizations,
          mealType: selectedMealType
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

  const handleSubmitFeedback = async (mealId: string) => {
    if (!user?.id) return

    // Determine overall feedback type based on individual feedbacks
    let feedbackType = 'accurate'
    if (feedbackData.caloriesFeedback === 'too_high' || feedbackData.proteinFeedback === 'too_high') {
      feedbackType = 'too_high'
    } else if (feedbackData.caloriesFeedback === 'too_low' || feedbackData.proteinFeedback === 'too_low') {
      feedbackType = 'too_low'
    }

    setSubmittingFeedback(true)

    try {
      const response = await fetch('/api/meal-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          aiGeneratedMealId: mealId,
          feedbackType,
          caloriesFeedback: feedbackData.caloriesFeedback,
          proteinFeedback: feedbackData.proteinFeedback,
          suggestedCalories: feedbackData.suggestedCalories ? parseInt(feedbackData.suggestedCalories) : null,
          suggestedProtein: feedbackData.suggestedProtein ? parseInt(feedbackData.suggestedProtein) : null
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
              calories: data.updatedMeal?.calories || meal.calories,
              protein: data.updatedMeal?.protein || meal.protein,
              carbs: data.updatedMeal?.carbs || meal.carbs,
              fat: data.updatedMeal?.fat || meal.fat,
              feedbackCount: data.updatedMeal?.feedbackCount,
              confidenceScore: data.updatedMeal?.confidenceScore
            }
          }
          return meal
        })
      )

      // Reset feedback state
      setShowFeedbackFor(null)
      setFeedbackData({
        caloriesFeedback: null,
        proteinFeedback: null,
        suggestedCalories: '',
        suggestedProtein: ''
      })
    } catch (error) {
      console.error('Failed to submit feedback:', error)
    } finally {
      setSubmittingFeedback(false)
    }
  }

  const resetFeedback = () => {
    setShowFeedbackFor(null)
    setFeedbackData({
      caloriesFeedback: null,
      proteinFeedback: null,
      suggestedCalories: '',
      suggestedProtein: ''
    })
  }

  const getRestaurantInfo = () => {
    if (!restaurant) return { type: 'Restaurant', address: '', hours: '', isCustomSearch: false }

    const isCustomSearch = (restaurant as any).isCustomSearch === true

    return {
      type: restaurant.tags?.cuisine || 'Restaurant',
      address: restaurant.distance != null ? `${restaurant.distance.toFixed(1)} mi away` : 'Search result',
      hours: isCustomSearch ? '' : 'Open now',
      isCustomSearch
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

        {/* Remaining Macros Card - Sticky on desktop */}
        {macroProgress && (
          <div className="mb-6 lg:fixed lg:top-24 lg:right-8 lg:w-64 lg:z-40">
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Remaining Today</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Calories</span>
                  <span className="text-lg font-semibold text-foreground">{Math.round(macroProgress.remaining.calories)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Protein</span>
                  <span className="text-lg font-semibold text-primary">{Math.round(macroProgress.remaining.protein)}g</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Carbs</span>
                  <span className="text-lg font-semibold text-foreground">{Math.round(macroProgress.remaining.carbs)}g</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Fat</span>
                  <span className="text-lg font-semibold text-foreground">{Math.round(macroProgress.remaining.fat)}g</span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-border">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Today's progress</span>
                  <span>{Math.round((macroProgress.current.calories / macroProgress.targets.calories) * 100)}%</span>
                </div>
                <div className="mt-1.5 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${Math.min(100, (macroProgress.current.calories / macroProgress.targets.calories) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Restaurant Header */}
        <div className="mb-4 lg:pr-72">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-semibold text-foreground">{restaurant.name}</h1>
            {restaurantInfo.isCustomSearch && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-sky-500/10 to-blue-500/10 border border-sky-500/20">
                <Sparkles className="h-3.5 w-3.5 text-sky-500" />
                <span className="text-xs font-medium text-sky-600">AI Analysis</span>
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span>{restaurantInfo.type}</span>
            {!restaurantInfo.isCustomSearch && (
              <>
                <span>•</span>
                <span>$$</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {restaurantInfo.address}
                </span>
                {restaurantInfo.hours && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {restaurantInfo.hours}
                    </span>
                  </>
                )}
              </>
            )}
            {restaurantInfo.isCustomSearch && (
              <span>Real-time menu analysis powered by AI</span>
            )}
          </div>
        </div>

        {/* Meal Time Scheduler */}
        <div className="mb-6 lg:pr-72">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Planning for:</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleScheduleChange('now')}
                disabled={aiLoading || isRegenerating}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  scheduledMealTime === 'now'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                } disabled:opacity-50`}
              >
                Now ({getCurrentMealLabel()})
              </button>
              <button
                onClick={() => handleScheduleChange('breakfast')}
                disabled={aiLoading || isRegenerating}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  scheduledMealTime === 'breakfast'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                } disabled:opacity-50`}
              >
                Breakfast
              </button>
              <button
                onClick={() => handleScheduleChange('lunch')}
                disabled={aiLoading || isRegenerating}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  scheduledMealTime === 'lunch'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                } disabled:opacity-50`}
              >
                Lunch
              </button>
              <button
                onClick={() => handleScheduleChange('dinner')}
                disabled={aiLoading || isRegenerating}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  scheduledMealTime === 'dinner'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                } disabled:opacity-50`}
              >
                Dinner
              </button>
            </div>
            {isRegenerating && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Updating recommendations...</span>
              </div>
            )}
          </div>
          {scheduledMealTime !== 'now' && (
            <p className="mt-2 text-xs text-muted-foreground">
              Showing meal recommendations optimized for {scheduledMealTime}. Calorie distribution adjusted accordingly.
            </p>
          )}
        </div>

        {/* Nutrition Coach + Top Pick Side by Side */}
        <div className="mb-8 grid grid-cols-1 lg:grid-cols-2 gap-5 lg:pr-72">
          {/* AI Coaching Advice */}
          {(coachingAdvice || coachingNote) && (
            <div className="rounded-2xl bg-sky-500/5 border border-sky-500/20 p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 h-10 w-10 rounded-xl bg-sky-500/10 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-sky-500" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-base font-semibold text-foreground">Nutrition Coach</h3>
                    <span className="px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-500 text-xs font-medium">Live</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {coachingAdvice}
                  </p>
                  {coachingNote && (
                    <p className="text-sm text-sky-500 font-medium mt-3 pt-3 border-t border-sky-500/10">
                      💡 {coachingNote}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Top Pick */}
          {!aiLoading && meals.length > 0 && (() => {
            const topPick = meals.reduce((best, current) => {
              const currentScore = current.fitScore || 0
              const bestScore = best?.fitScore || 0
              if (current.fitBadge === 'PERFECT MATCH') return current
              if (best?.fitBadge === 'PERFECT MATCH') return best
              return currentScore > bestScore ? current : best
            }, meals[0])

            if (!topPick) return null

            return (
              <div className="rounded-2xl border-2 border-primary bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 relative overflow-hidden">
                {/* Top Pick Badge */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary text-primary-foreground">
                      <Trophy className="h-4 w-4" />
                      <span className="text-sm font-bold">Top Pick</span>
                    </div>
                    {topPick.fitScore !== undefined && (
                      <span className="text-sm font-semibold text-primary">{topPick.fitScore}/100 match</span>
                    )}
                  </div>
                </div>

                {/* Meal Title & Reason */}
                <h3 className="text-lg font-bold text-foreground mb-2">{topPick.title}</h3>
                {(topPick.fitReasoning || topPick.aiReasoning) && (
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {topPick.fitReasoning || topPick.aiReasoning}
                  </p>
                )}

                {/* Macros Grid */}
                <div className="grid grid-cols-4 gap-2 mb-4">
                  <div className="text-center p-2 rounded-lg bg-card/50">
                    <p className="text-lg font-bold text-foreground">{Math.round(topPick.calories)}</p>
                    <p className="text-[10px] text-muted-foreground">cal</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-primary/10">
                    <p className="text-lg font-bold text-primary">{Math.round(topPick.protein)}g</p>
                    <p className="text-[10px] text-muted-foreground">protein</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-card/50">
                    <p className="text-lg font-bold text-foreground">{Math.round(topPick.carbs)}g</p>
                    <p className="text-[10px] text-muted-foreground">carbs</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-card/50">
                    <p className="text-lg font-bold text-foreground">{Math.round(topPick.fat)}g</p>
                    <p className="text-[10px] text-muted-foreground">fat</p>
                  </div>
                </div>

                {/* Meal Type + Log Button */}
                <div className="flex items-center gap-3">
                  <select
                    value={selectedMealType}
                    onChange={(e) => setSelectedMealType(e.target.value)}
                    className="px-3 py-2.5 rounded-xl bg-card border border-border text-sm font-medium focus:outline-none"
                  >
                    <option value="breakfast">Breakfast</option>
                    <option value="lunch">Lunch</option>
                    <option value="dinner">Dinner</option>
                    <option value="snack">Snack</option>
                  </select>
                  <button
                    onClick={() => handleLogMeal(topPick)}
                    disabled={loggingMealId === topPick.id || loggedMealId === topPick.id}
                    className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                      loggedMealId === topPick.id
                        ? 'bg-green-500 text-white'
                        : loggingMealId === topPick.id
                        ? 'bg-muted text-muted-foreground cursor-wait'
                        : 'bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] shadow-md shadow-primary/20'
                    }`}
                  >
                    {loggedMealId === topPick.id ? (
                      <span className="flex items-center justify-center gap-2">
                        <Check className="h-4 w-4" />
                        Logged!
                      </span>
                    ) : loggingMealId === topPick.id ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="h-4 w-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                        Logging...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        Log This Meal
                        <ChevronRight className="h-4 w-4" />
                      </span>
                    )}
                  </button>
                </div>
              </div>
            )
          })()}
        </div>

        {/* Menu Section */}
        <div className="lg:pr-72">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-medium text-foreground">Other Options</h2>
          </div>

          {aiLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="relative">
                  <div className="animate-spin rounded-full h-12 w-12 border-2 border-sky-500/20 border-t-sky-500 mx-auto"></div>
                  <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-5 w-5 text-sky-500" />
                </div>
                <p className="mt-4 text-sm font-medium text-foreground">
                  {restaurantInfo.isCustomSearch ? 'Analyzing menu with AI...' : 'Finding your best meal options...'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {restaurantInfo.isCustomSearch ? 'Searching menus and calculating nutrition' : 'Personalizing recommendations for you'}
                </p>
              </div>
            </div>
          ) : meals.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No meal recommendations available</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {meals.filter((item, idx) => {
                // Find top pick to exclude it
                const topPick = meals.reduce((best, current) => {
                  const currentScore = current.fitScore || 0
                  const bestScore = best?.fitScore || 0
                  if (current.fitBadge === 'PERFECT MATCH') return current
                  if (best?.fitBadge === 'PERFECT MATCH') return best
                  return currentScore > bestScore ? current : best
                }, meals[0])
                return item.id !== topPick?.id
              }).map((item, idx) => {
                const getBadgeColor = (badge: string | null | undefined) => {
                  switch (badge) {
                    case 'PERFECT MATCH': return 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30'
                    case 'HIGHLY RECOMMENDED': return 'bg-primary/20 text-primary border-primary/30'
                    case 'GOOD FIT': return 'bg-primary/15 text-primary/90 border-primary/25'
                    case 'OKAY': return 'bg-gray-500/20 text-gray-600 dark:text-gray-400 border-gray-500/30'
                    default: return 'bg-primary/10 text-primary border-primary/20'
                  }
                }

                return (
                  <div
                    key={idx}
                    className={`p-5 rounded-xl border transition-all flex flex-col ${
                      item.fitBadge === 'PERFECT MATCH' || item.fitBadge === 'HIGHLY RECOMMENDED'
                        ? 'border-primary/50 bg-primary/5'
                        : 'border-border bg-card hover:border-primary/30'
                    }`}
                  >
                    {/* Content wrapper */}
                    <div className="flex-1 flex flex-col">
                      {/* Fit Badge */}
                      {item.fitBadge && (
                        <div className="flex items-center gap-2 mb-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getBadgeColor(item.fitBadge)}`}>
                            {item.fitBadge}
                          </span>
                          {item.fitScore !== undefined && (
                            <span className="text-xs font-semibold text-muted-foreground">
                              {item.fitScore}/100
                            </span>
                          )}
                        </div>
                      )}

                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground mb-1">{item.title}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>

                        {/* AI Insight - Purple themed */}
                        {item.fitReasoning && (
                          <div className="mt-3 p-3 rounded-lg bg-sky-500/5 border border-sky-500/10">
                            <p className="text-xs text-muted-foreground">
                              <span className="font-medium text-sky-500">Why this works: </span>
                              {item.fitReasoning}
                            </p>
                          </div>
                        )}

                        {/* Customizations */}
                        {item.customizations && item.customizations.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-3">
                            {item.customizations.slice(0, 3).map((customization: string, custIdx: number) => (
                              <span key={custIdx} className="text-xs text-primary">
                                +{customization}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                    {/* Show AI analysis badge for unknown restaurants */}
                    {(item as any).isAIAnalyzed && (
                      <div className="mt-3 p-2.5 rounded-lg bg-sky-500/5 border border-sky-500/10 flex items-center gap-2">
                        <Sparkles className="h-3.5 w-3.5 text-sky-500" />
                        <span className="text-xs text-sky-500 font-medium">AI estimated</span>
                        {(item as any).feedbackCount > 0 && (
                          <span className="text-xs text-muted-foreground">• {(item as any).feedbackCount} refinements</span>
                        )}
                      </div>
                    )}
                    </div>

                    {/* Macros */}
                    <div className="flex items-center justify-between pt-3 mt-3 border-t border-border text-sm">
                      <span className="font-semibold text-foreground">{Math.round(item.calories)} cal</span>
                      <span className="font-bold text-primary">{Math.round(item.protein)}g pro</span>
                      <span className="text-muted-foreground">{Math.round(item.carbs)}g carbs</span>
                      <span className="text-muted-foreground">{Math.round(item.fat)}g fat</span>
                    </div>

                    {/* Log Button */}
                    <div className="flex items-center gap-2 mt-3">
                      <select
                        value={selectedMealType}
                        onChange={(e) => setSelectedMealType(e.target.value)}
                        className="px-2.5 py-2 rounded-lg bg-muted border-0 text-xs font-medium focus:outline-none"
                      >
                        <option value="breakfast">Breakfast</option>
                        <option value="lunch">Lunch</option>
                        <option value="dinner">Dinner</option>
                        <option value="snack">Snack</option>
                      </select>
                      <button
                        onClick={() => handleLogMeal(item)}
                        disabled={loggingMealId === item.id || loggedMealId === item.id}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                          loggedMealId === item.id
                            ? 'bg-green-500 text-white'
                            : loggingMealId === item.id
                            ? 'bg-muted text-muted-foreground cursor-wait'
                            : 'bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98]'
                        }`}
                      >
                        {loggedMealId === item.id ? (
                          <span className="flex items-center justify-center gap-1.5">
                            <Check className="h-4 w-4" />
                            Logged!
                          </span>
                        ) : loggingMealId === item.id ? (
                          <span className="flex items-center justify-center gap-1.5">
                            <div className="h-3.5 w-3.5 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                          </span>
                        ) : (
                          'Log This Meal'
                        )}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
            </>
          )}
        </div>

        {/* Get Directions Button */}
        <div className="mt-6 pt-5 border-t border-border">
          <button
            onClick={() => window.open(`https://www.google.com/maps/search/${encodeURIComponent(restaurant.name)}`, '_blank')}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            Get Directions
          </button>
        </div>
      </div>

      {/* Floating Chat Button */}
      <button
        onClick={() => setChatOpen(!chatOpen)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-2xl bg-sky-500/10 border border-sky-500/20 shadow-lg hover:bg-sky-500/20 transition-all flex items-center justify-center z-50"
      >
        {chatOpen ? (
          <X className="h-5 w-5 text-sky-500" />
        ) : (
          <Sparkles className="h-5 w-5 text-sky-500" />
        )}
      </button>

      {/* Chat Panel */}
      {chatOpen && (
        <div className="fixed bottom-24 right-6 w-96 max-w-[calc(100vw-3rem)] h-[500px] max-h-[calc(100vh-8rem)] bg-card border border-border/50 rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden">
          {/* Chat Header */}
          <div className="p-4 border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-sky-500/10 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-sky-500" />
              </div>
              <div>
                <h3 className="text-base font-medium text-foreground">Menu Assistant</h3>
                <p className="text-xs text-muted-foreground">Ask me anything about {restaurant.name}</p>
              </div>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {chatMessages.length === 0 && (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-xl bg-sky-500/10 flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="h-8 w-8 text-sky-500" />
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Ask me about the menu, nutrition, or what to order!
                </p>
                <div className="space-y-2">
                  {[
                    "What's the highest protein option?",
                    "What should I avoid if I'm cutting carbs?",
                    "What's a good balanced meal here?"
                  ].map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setChatInput(suggestion)
                      }}
                      className="block w-full text-left px-3 py-2 rounded-lg bg-sky-500/5 hover:bg-sky-500/10 text-sm text-sky-500 transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {chatMessages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                    msg.role === 'user'
                      ? 'bg-sky-500 text-white'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl px-4 py-2.5">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-sky-500 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 rounded-full bg-sky-500 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 rounded-full bg-sky-500 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Chat Input */}
          <form onSubmit={handleChatSubmit} className="p-4 border-t border-border/50">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask about the menu..."
                className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:border-sky-500"
                disabled={chatLoading}
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || chatLoading}
                className="px-4 py-2.5 rounded-xl bg-sky-500 text-white text-sm font-medium hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Send
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  )
}
