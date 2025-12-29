'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import { Sparkles, MapPin, Check, Utensils, Home, ExternalLink, Clock, Target } from 'lucide-react'

interface MealSuggestion {
  id: string
  name: string
  description: string
  restaurant: string
  calories: number
  protein: number
  carbs: number
  fat: number
  distance?: number | null
  estimatedPrice?: number | null
  personalizedReason?: string | null
  isPersonalized?: boolean
  aiReasoning?: string | null
  isAIScored?: boolean
  isFinalResort?: boolean
  comboItems?: Array<{ id: string; title: string; restaurantBrand: string; calories: number; protein: number }>
  calorieFit?: number
  proteinFit?: number
}

interface HomeMeal {
  name: string
  description: string
  prepTime: string
  calories: number
  protein: number
  carbs: number
  fat: number
  ingredients: string[]
}

interface ReadyToEatItem {
  name: string
  portion: string
  calories: number
  protein: number
}

export default function AIPicksPage() {
  const router = useRouter()
  const { user, isLoaded, isSignedIn } = useUser()
  const [mealSource, setMealSource] = useState<'restaurant' | 'home'>('restaurant')
  const [suggestions, setSuggestions] = useState<MealSuggestion[]>([])
  const [homeMeals, setHomeMeals] = useState<HomeMeal[]>([])
  const [readyToEat, setReadyToEat] = useState<ReadyToEatItem[]>([])
  const [homeMessage, setHomeMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loggingMealId, setLoggingMealId] = useState<string | null>(null)
  const [loggedMealIds, setLoggedMealIds] = useState<Set<string>>(new Set())
  const [flippedCardId, setFlippedCardId] = useState<string | null>(null)
  const [remaining, setRemaining] = useState<{ calories: number; protein: number; carbs: number; fat: number } | null>(null)
  const [isFinalResortMode, setIsFinalResortMode] = useState(false)
  const [agentType, setAgentType] = useState<'breakfast' | 'lunch' | 'dinner'>('lunch')
  const [urgencyLevel, setUrgencyLevel] = useState<'low' | 'moderate' | 'high' | 'critical'>('moderate')
  const [targetForMeal, setTargetForMeal] = useState<{ calories: number; protein: number } | null>(null)
  const [suggestionMessage, setSuggestionMessage] = useState<string | null>(null)
  const hasFetchedRestaurant = useRef(false)
  const hasFetchedHome = useRef(false)

  useEffect(() => {
    if (!isLoaded) return

    if (!isSignedIn) {
      router.push('/auth/signin')
      return
    }

    if (user?.id) {
      if (mealSource === 'restaurant' && !hasFetchedRestaurant.current) {
        hasFetchedRestaurant.current = true
        loadSuggestions(user.id)
      } else if (mealSource === 'home' && !hasFetchedHome.current) {
        hasFetchedHome.current = true
        loadHomeMeals(user.id)
      }
    }
  }, [user?.id, isLoaded, isSignedIn, router, mealSource])

  const handleSourceChange = (source: 'restaurant' | 'home') => {
    setMealSource(source)
    setFlippedCardId(null)

    if (source === 'restaurant' && !hasFetchedRestaurant.current && user?.id) {
      hasFetchedRestaurant.current = true
      loadSuggestions(user.id)
    } else if (source === 'home' && !hasFetchedHome.current && user?.id) {
      hasFetchedHome.current = true
      loadHomeMeals(user.id)
    }
  }

  const loadSuggestions = async (userId: string, finalResort: boolean = false) => {
    setLoading(true)
    try {
      const tz = encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)
      const hour = new Date().getHours()

      // Try to get user location
      let url = `/api/meal-suggestions?userId=${userId}&size=regular&dining=takeout&travel=drive&timezone=${tz}&currentHour=${hour}&limit=12`

      if (navigator.geolocation) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
          })
          url += `&lat=${position.coords.latitude}&lng=${position.coords.longitude}`
        } catch {
          // Location denied, continue without it
        }
      }

      // Add final resort mode
      if (finalResort) {
        url += '&finalResort=true'
      }

      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setSuggestions(data.suggestions || [])
        setRemaining(data.remaining || null)
        setIsFinalResortMode(data.isFinalResortMode || false)
        // Set agent-specific data
        setAgentType(data.agentType || 'lunch')
        setUrgencyLevel(data.urgencyLevel || 'moderate')
        setTargetForMeal(data.targetForMeal || null)
        setSuggestionMessage(data.message || null)
      }
    } catch (error) {
      console.error('Failed to load suggestions:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFinalResort = () => {
    if (!user?.id) return
    loadSuggestions(user.id, true)
  }

  const handleExitFinalResort = () => {
    if (!user?.id) return
    setIsFinalResortMode(false)
    hasFetchedRestaurant.current = false
    loadSuggestions(user.id, false)
  }

  const loadHomeMeals = async (userId: string) => {
    setLoading(true)
    try {
      const response = await fetch('/api/pantry/suggest-meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      })
      if (response.ok) {
        const data = await response.json()
        setHomeMeals(data.meals || [])
        setReadyToEat(data.readyToEat || [])
        setHomeMessage(data.message || null)
      }

      // Also get remaining macros
      const macroResponse = await fetch(`/api/macro-progress?userId=${userId}`)
      if (macroResponse.ok) {
        const macroData = await macroResponse.json()
        setRemaining(macroData.remaining || null)
      }
    } catch (error) {
      console.error('Failed to load home meals:', error)
    } finally {
      setLoading(false)
    }
  }

  const logMeal = async (suggestion: MealSuggestion) => {
    if (!user?.id || loggingMealId) return

    setLoggingMealId(suggestion.id)

    try {
      const hour = new Date().getHours()
      const mealType = hour < 11 ? 'breakfast' : hour < 16 ? 'lunch' : 'dinner'

      const response = await fetch('/api/log-meal-direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          name: suggestion.name,
          calories: suggestion.calories,
          protein: suggestion.protein,
          carbs: suggestion.carbs,
          fat: suggestion.fat,
          servings: 1,
          mealType
        })
      })

      if (response.ok) {
        setLoggedMealIds(prev => new Set(prev).add(suggestion.id))
      }
    } catch (error) {
      console.error('Failed to log meal:', error)
    } finally {
      setLoggingMealId(null)
    }
  }

  const logHomeMeal = async (meal: HomeMeal | ReadyToEatItem, mealId: string) => {
    if (!user?.id || loggingMealId) return

    setLoggingMealId(mealId)

    try {
      const hour = new Date().getHours()
      const mealType = hour < 11 ? 'breakfast' : hour < 16 ? 'lunch' : 'dinner'

      const response = await fetch('/api/log-meal-direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          name: meal.name,
          calories: meal.calories,
          protein: meal.protein,
          carbs: 'carbs' in meal ? meal.carbs : 0,
          fat: 'fat' in meal ? meal.fat : 0,
          servings: 1,
          mealType
        })
      })

      if (response.ok) {
        setLoggedMealIds(prev => new Set(prev).add(mealId))
      }
    } catch (error) {
      console.error('Failed to log meal:', error)
    } finally {
      setLoggingMealId(null)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-sky-100 to-blue-50 border-b border-sky-200/50">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-sky-500/20 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-sky-500" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-foreground">AI Meal Picks</h1>
                <p className="text-muted-foreground">Personalized recommendations optimized for your macros & goals</p>
              </div>
            </div>

            {/* Source Toggle & Hit Targets */}
            <div className="flex items-center gap-3">
              <div className="flex items-center bg-white/60 rounded-xl p-1">
                <button
                  onClick={() => handleSourceChange('restaurant')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    mealSource === 'restaurant'
                      ? 'bg-white text-sky-600 shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Utensils className="h-4 w-4" />
                  Restaurants
                </button>
                <button
                  onClick={() => handleSourceChange('home')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    mealSource === 'home'
                      ? 'bg-white text-green-600 shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Home className="h-4 w-4" />
                  From Pantry
                </button>
              </div>

              {/* Hit Targets Button - Only show for restaurant mode */}
              {mealSource === 'restaurant' && (
                <button
                  onClick={isFinalResortMode ? handleExitFinalResort : handleFinalResort}
                  disabled={loading}
                  className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium transition-all ${
                    isFinalResortMode
                      ? 'bg-amber-500 text-white shadow-md'
                      : 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-2 border-amber-500/30 hover:border-amber-500/50'
                  } disabled:opacity-50`}
                >
                  <Target className="h-4 w-4" />
                  {isFinalResortMode ? 'Exit Combos' : 'Hit Targets'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Agent Context - Meal Target Display */}
      {mealSource === 'restaurant' && !loading && targetForMeal && (
        <div className="max-w-6xl mx-auto px-6 pt-6">
          <div className={`p-4 rounded-xl border ${
            urgencyLevel === 'critical' ? 'bg-red-50 border-red-200' :
            urgencyLevel === 'high' ? 'bg-amber-50 border-amber-200' :
            'bg-sky-50 border-sky-200'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-semibold uppercase tracking-wider px-3 py-1 rounded ${
                  agentType === 'breakfast' ? 'bg-orange-500/20 text-orange-600' :
                  agentType === 'lunch' ? 'bg-sky-500/20 text-sky-600' :
                  'bg-indigo-500/20 text-indigo-600'
                }`}>
                  {agentType}
                </span>
                {urgencyLevel === 'critical' && (
                  <span className="text-sm font-semibold text-red-600 bg-red-100 px-3 py-1 rounded">
                    Last chance to hit targets!
                  </span>
                )}
                {urgencyLevel === 'high' && (
                  <span className="text-sm font-semibold text-amber-600 bg-amber-100 px-3 py-1 rounded">
                    Getting late - prioritize hitting targets
                  </span>
                )}
              </div>
            </div>
            <p className="text-base text-foreground">
              Target for this meal: <span className="font-semibold">{targetForMeal.calories} cal</span> and{' '}
              <span className="font-semibold">{targetForMeal.protein}g protein</span>
            </p>
            {suggestionMessage && (
              <p className="text-sm text-muted-foreground mt-1">{suggestionMessage}</p>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className={`h-12 w-12 rounded-xl flex items-center justify-center mb-4 animate-pulse ${
              isFinalResortMode ? 'bg-amber-500/20' : mealSource === 'restaurant' ? 'bg-sky-500/20' : 'bg-green-500/20'
            }`}>
              {isFinalResortMode ? (
                <Target className="h-6 w-6 text-amber-500" />
              ) : mealSource === 'restaurant' ? (
                <Sparkles className="h-6 w-6 text-sky-500" />
              ) : (
                <Home className="h-6 w-6 text-green-500" />
              )}
            </div>
            <p className="text-lg font-medium text-foreground mb-2">
              {isFinalResortMode ? 'Finding target-hitting combos...' : 'AI meals generating...'}
            </p>
            <p className="text-sm text-muted-foreground">
              {isFinalResortMode
                ? 'Analyzing meal combinations to hit 95%+ of your remaining macros'
                : mealSource === 'restaurant'
                ? 'Finding the best restaurant options for your goals'
                : 'Creating recipes from your pantry items'}
            </p>

            {/* Skeleton grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full mt-8">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                <div key={i} className="p-4 rounded-xl border border-border bg-card animate-pulse">
                  <div className="h-4 w-1/3 bg-muted rounded mb-2" />
                  <div className="h-5 w-2/3 bg-muted rounded mb-3" />
                  <div className="grid grid-cols-4 gap-1 mb-3">
                    {[1, 2, 3, 4].map((j) => (
                      <div key={j} className="h-10 bg-muted rounded-lg" />
                    ))}
                  </div>
                  <div className="h-8 bg-muted rounded-lg" />
                </div>
              ))}
            </div>
          </div>
        ) : mealSource === 'restaurant' && suggestions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {suggestions.map((suggestion) => {
              const isLogging = loggingMealId === suggestion.id
              const isLogged = loggedMealIds.has(suggestion.id)
              const isFlipped = flippedCardId === suggestion.id

              // Generate AI insights for this meal
              const proteinPercent = remaining ? Math.round((suggestion.protein / remaining.protein) * 100) : 0
              const caloriePercent = remaining ? Math.round((suggestion.calories / remaining.calories) * 100) : 0
              const insights: string[] = []

              if (proteinPercent >= 40 && proteinPercent <= 60) {
                insights.push(`Provides ${proteinPercent}% of your remaining protein - ideal for this meal`)
              } else if (proteinPercent > 60) {
                insights.push(`High protein option - covers ${proteinPercent}% of remaining needs`)
              }

              if (caloriePercent >= 30 && caloriePercent <= 50) {
                insights.push(`Well-balanced calories for your remaining budget`)
              }

              if (suggestion.protein / suggestion.calories > 0.04) {
                insights.push(`Excellent protein-to-calorie ratio for muscle building`)
              }

              if (suggestion.estimatedPrice && suggestion.protein > 30) {
                const costPerProtein = suggestion.estimatedPrice / suggestion.protein
                if (costPerProtein < 0.5) {
                  insights.push(`Great value: ~$${costPerProtein.toFixed(2)} per gram of protein`)
                }
              }

              if (suggestion.personalizedReason) {
                insights.push(suggestion.personalizedReason)
              }

              if (insights.length === 0) {
                insights.push('Fits within your remaining macro budget')
              }

              return (
                <div
                  key={suggestion.id}
                  className="relative h-[280px] [perspective:1000px]"
                >
                  <div
                    className={`relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d] ${
                      isFlipped ? '[transform:rotateY(180deg)]' : ''
                    }`}
                  >
                    {/* Front of card */}
                    <div
                      className="absolute inset-0 p-5 rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-md transition-all cursor-pointer [backface-visibility:hidden] flex flex-col"
                      onClick={() => setFlippedCardId(suggestion.id)}
                    >
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-1 rounded-md uppercase tracking-wide">
                          {suggestion.restaurant}
                        </span>
                        {suggestion.isFinalResort && suggestion.comboItems && suggestion.comboItems.length > 1 && (
                          <span className="text-xs font-semibold text-amber-600 bg-amber-500/10 px-2 py-1 rounded-md uppercase tracking-wide">
                            COMBO
                          </span>
                        )}
                        {suggestion.calorieFit && suggestion.proteinFit && (
                          <span className="text-xs font-semibold text-green-600 bg-green-500/10 px-2 py-1 rounded-md">
                            {Math.round((suggestion.calorieFit + suggestion.proteinFit) / 2)}% fit
                          </span>
                        )}
                        {suggestion.estimatedPrice && (
                          <span className="text-xs font-semibold text-emerald-600 bg-emerald-500/10 px-2 py-1 rounded-md">
                            ~${suggestion.estimatedPrice.toFixed(0)}
                          </span>
                        )}
                        {suggestion.distance && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
                            <MapPin className="h-3 w-3" />
                            {suggestion.distance} mi
                          </span>
                        )}
                      </div>

                      <h3 className="font-semibold text-foreground text-base mb-2 line-clamp-2">
                        {suggestion.name}
                      </h3>

                      {/* Show combo items if this is a combo */}
                      {suggestion.isFinalResort && suggestion.comboItems && suggestion.comboItems.length > 1 ? (
                        <div className="text-xs text-muted-foreground mb-3">
                          {suggestion.comboItems.map((item, idx) => (
                            <span key={item.id}>
                              {item.title}{idx < suggestion.comboItems!.length - 1 ? ' + ' : ''}
                            </span>
                          ))}
                        </div>
                      ) : suggestion.description && (
                        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                          {suggestion.description}
                        </p>
                      )}

                      <div className="grid grid-cols-4 gap-2 text-center flex-1">
                        <div className="p-3 rounded-xl bg-muted/50 flex flex-col justify-center">
                          <p className="text-lg font-bold text-foreground">{suggestion.calories}</p>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">cal</p>
                        </div>
                        <div className="p-3 rounded-xl bg-primary/10 flex flex-col justify-center">
                          <p className="text-lg font-bold text-primary">{suggestion.protein}g</p>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">protein</p>
                        </div>
                        <div className="p-3 rounded-xl bg-muted/50 flex flex-col justify-center">
                          <p className="text-lg font-bold text-foreground">{suggestion.carbs}g</p>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">carbs</p>
                        </div>
                        <div className="p-3 rounded-xl bg-muted/50 flex flex-col justify-center">
                          <p className="text-lg font-bold text-foreground">{suggestion.fat}g</p>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">fat</p>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                        <p className="text-xs text-sky-600 flex items-center gap-1">
                          <Sparkles className="h-3 w-3" />
                          Tap to see why AI picked this
                        </p>
                        <div className="h-6 w-6 rounded-full bg-sky-500/10 flex items-center justify-center">
                          <Sparkles className="h-3 w-3 text-sky-500" />
                        </div>
                      </div>
                    </div>

                    {/* Back of card - AI Insights */}
                    <div
                      className={`absolute inset-0 p-5 rounded-xl border [backface-visibility:hidden] [transform:rotateY(180deg)] flex flex-col ${
                        suggestion.isFinalResort
                          ? 'border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50'
                          : 'border-sky-200 bg-gradient-to-br from-sky-50 to-blue-50'
                      }`}
                      onClick={() => setFlippedCardId(null)}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                          suggestion.isFinalResort ? 'bg-amber-500/20' : 'bg-sky-500/20'
                        }`}>
                          {suggestion.isFinalResort ? (
                            <Target className="h-4 w-4 text-amber-500" />
                          ) : (
                            <Sparkles className="h-4 w-4 text-sky-500" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {suggestion.isFinalResort ? 'Target Match Analysis' : 'AI Insights'}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {suggestion.isFinalResort ? 'How this combo hits your macros' : 'Why this meal fits your goals'}
                          </p>
                        </div>
                      </div>

                      {/* Show calorie/protein fit for final resort meals */}
                      {suggestion.isFinalResort && suggestion.calorieFit && suggestion.proteinFit && (
                        <div className="flex gap-2 mb-3">
                          <div className="flex-1 bg-white/60 rounded-lg p-2 text-center">
                            <p className="text-lg font-bold text-amber-600">{suggestion.calorieFit}%</p>
                            <p className="text-[10px] text-muted-foreground">Calorie Fit</p>
                          </div>
                          <div className="flex-1 bg-white/60 rounded-lg p-2 text-center">
                            <p className="text-lg font-bold text-amber-600">{suggestion.proteinFit}%</p>
                            <p className="text-[10px] text-muted-foreground">Protein Fit</p>
                          </div>
                        </div>
                      )}

                      <div className="flex-1 space-y-2 overflow-y-auto">
                        {/* Show AI reasoning for final resort meals */}
                        {suggestion.isFinalResort && suggestion.aiReasoning ? (
                          <div className="flex items-start gap-2 text-xs text-foreground">
                            <Check className={`h-3.5 w-3.5 mt-0.5 flex-shrink-0 ${suggestion.isFinalResort ? 'text-amber-500' : 'text-sky-500'}`} />
                            <span>{suggestion.aiReasoning}</span>
                          </div>
                        ) : (
                          insights.map((insight, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs text-foreground">
                              <Check className="h-3.5 w-3.5 text-sky-500 mt-0.5 flex-shrink-0" />
                              <span>{insight}</span>
                            </div>
                          ))
                        )}
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          logMeal(suggestion)
                        }}
                        disabled={isLogging || isLogged}
                        className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 mt-3 ${
                          isLogged
                            ? 'bg-emerald-500 text-white'
                            : suggestion.isFinalResort
                            ? 'bg-amber-500 text-white hover:bg-amber-600'
                            : 'bg-sky-500 text-white hover:bg-sky-600'
                        } disabled:opacity-70`}
                      >
                        {isLogging ? (
                          <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : isLogged ? (
                          <>
                            <Check className="h-4 w-4" />
                            Logged
                          </>
                        ) : suggestion.isFinalResort && suggestion.comboItems && suggestion.comboItems.length > 1 ? (
                          'Log This Combo'
                        ) : (
                          'Log This Meal'
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : mealSource === 'home' && (homeMeals.length > 0 || readyToEat.length > 0) ? (
          <div className="space-y-8">
            {/* AI Message */}
            {homeMessage && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="h-4 w-4 text-green-600" />
                </div>
                <p className="text-sm text-green-800">{homeMessage}</p>
              </div>
            )}

            {/* Cooked Meals */}
            {homeMeals.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Utensils className="h-5 w-5 text-green-600" />
                  Meals You Can Make
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {homeMeals.map((meal, index) => {
                    const mealId = `home-${index}`
                    const isLogging = loggingMealId === mealId
                    const isLogged = loggedMealIds.has(mealId)
                    const isFlipped = flippedCardId === mealId

                    return (
                      <div key={mealId} className="relative h-[300px] [perspective:1000px]">
                        <div
                          className={`relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d] ${
                            isFlipped ? '[transform:rotateY(180deg)]' : ''
                          }`}
                        >
                          {/* Front */}
                          <div
                            className="absolute inset-0 p-5 rounded-xl border border-green-200 bg-card hover:border-green-400 hover:shadow-md transition-all cursor-pointer [backface-visibility:hidden] flex flex-col"
                            onClick={() => setFlippedCardId(mealId)}
                          >
                            <div className="flex items-center gap-2 mb-3">
                              <span className="text-xs font-semibold text-green-600 bg-green-500/10 px-2 py-1 rounded-md uppercase tracking-wide">
                                Homemade
                              </span>
                              <span className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
                                <Clock className="h-3 w-3" />
                                {meal.prepTime}
                              </span>
                            </div>

                            <h3 className="font-semibold text-foreground text-base mb-2 line-clamp-2">
                              {meal.name}
                            </h3>

                            {meal.description && (
                              <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                                {meal.description}
                              </p>
                            )}

                            <div className="grid grid-cols-4 gap-2 text-center flex-1">
                              <div className="p-3 rounded-xl bg-muted/50 flex flex-col justify-center">
                                <p className="text-lg font-bold text-foreground">{meal.calories}</p>
                                <p className="text-[10px] text-muted-foreground uppercase">cal</p>
                              </div>
                              <div className="p-3 rounded-xl bg-green-500/10 flex flex-col justify-center">
                                <p className="text-lg font-bold text-green-600">{meal.protein}g</p>
                                <p className="text-[10px] text-muted-foreground uppercase">protein</p>
                              </div>
                              <div className="p-3 rounded-xl bg-muted/50 flex flex-col justify-center">
                                <p className="text-lg font-bold text-foreground">{meal.carbs}g</p>
                                <p className="text-[10px] text-muted-foreground uppercase">carbs</p>
                              </div>
                              <div className="p-3 rounded-xl bg-muted/50 flex flex-col justify-center">
                                <p className="text-lg font-bold text-foreground">{meal.fat}g</p>
                                <p className="text-[10px] text-muted-foreground uppercase">fat</p>
                              </div>
                            </div>

                            <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                              <p className="text-xs text-green-600 flex items-center gap-1">
                                <Sparkles className="h-3 w-3" />
                                Tap for ingredients & insights
                              </p>
                            </div>
                          </div>

                          {/* Back */}
                          <div
                            className="absolute inset-0 p-5 rounded-xl border border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 [backface-visibility:hidden] [transform:rotateY(180deg)] flex flex-col cursor-pointer"
                            onClick={() => setFlippedCardId(null)}
                          >
                            <div className="flex items-center gap-2 mb-3">
                              <div className="h-8 w-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                                <Sparkles className="h-4 w-4 text-green-600" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-foreground">Ingredients</p>
                                <p className="text-[10px] text-muted-foreground">From your pantry</p>
                              </div>
                            </div>

                            <div className="flex-1 space-y-1.5 overflow-y-auto">
                              {meal.ingredients.map((ingredient, i) => (
                                <div key={i} className="flex items-center gap-2 text-xs text-foreground">
                                  <Check className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                                  <span>{ingredient}</span>
                                </div>
                              ))}
                            </div>

                            <div className="flex gap-2 mt-3">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  logHomeMeal(meal, mealId)
                                }}
                                disabled={isLogging || isLogged}
                                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                                  isLogged
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-green-600 text-white hover:bg-green-700'
                                } disabled:opacity-70`}
                              >
                                {isLogging ? (
                                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : isLogged ? (
                                  <>
                                    <Check className="h-4 w-4" />
                                    Logged
                                  </>
                                ) : (
                                  'Log Meal'
                                )}
                              </button>
                              <a
                                href={`https://www.google.com/search?q=${encodeURIComponent(meal.name + ' recipe')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="px-3 py-2.5 rounded-lg border border-green-300 hover:bg-white transition-colors flex items-center gap-1 text-xs text-green-700"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                Recipe
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Ready to Eat */}
            {readyToEat.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-600" />
                  Ready to Eat
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {readyToEat.map((item, index) => {
                    const itemId = `ready-${index}`
                    const isLogging = loggingMealId === itemId
                    const isLogged = loggedMealIds.has(itemId)

                    return (
                      <div key={itemId} className="p-4 rounded-xl border border-green-200 bg-card hover:border-green-400 transition-all">
                        <h3 className="font-medium text-foreground mb-1">{item.name}</h3>
                        <p className="text-xs text-muted-foreground mb-3">{item.portion}</p>
                        <div className="flex items-center gap-3 mb-3">
                          <div className="text-center">
                            <p className="text-sm font-bold text-foreground">{item.calories}</p>
                            <p className="text-[10px] text-muted-foreground">cal</p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-bold text-green-600">{item.protein}g</p>
                            <p className="text-[10px] text-muted-foreground">protein</p>
                          </div>
                        </div>
                        <button
                          onClick={() => logHomeMeal(item, itemId)}
                          disabled={isLogging || isLogged}
                          className={`w-full py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-2 ${
                            isLogged
                              ? 'bg-emerald-500 text-white'
                              : 'bg-green-600 text-white hover:bg-green-700'
                          } disabled:opacity-70`}
                        >
                          {isLogging ? (
                            <div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : isLogged ? (
                            <>
                              <Check className="h-3 w-3" />
                              Logged
                            </>
                          ) : (
                            'Log'
                          )}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20">
            <div className={`h-12 w-12 rounded-xl flex items-center justify-center mb-4 ${
              mealSource === 'restaurant' ? 'bg-sky-500/10' : 'bg-green-500/10'
            }`}>
              {mealSource === 'restaurant' ? (
                <Sparkles className="h-6 w-6 text-sky-400" />
              ) : (
                <Home className="h-6 w-6 text-green-400" />
              )}
            </div>
            <p className="text-lg font-medium text-foreground mb-2">
              {mealSource === 'restaurant' ? 'No restaurant suggestions available' : 'No pantry items found'}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              {mealSource === 'restaurant'
                ? 'Try again later or adjust your preferences'
                : 'Add items to your pantry to get meal suggestions'}
            </p>
            {mealSource === 'home' && (
              <Link
                href="/pantry"
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
              >
                Go to Pantry
              </Link>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
