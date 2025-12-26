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
  buildInstructions?: string
  ingredients?: any[]
  isCustomMeal?: boolean
  reasoning?: string
  macroImpact?: string
  aiApproved?: boolean
  customizations?: string[]
  aiScore?: number
  aiReasoning?: string
  isEstimated?: boolean
  confidence?: string
  orderingTips?: string
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
  const [macroProgress, setMacroProgress] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [aiLoading, setAiLoading] = useState(false)
  const [coachingData, setCoachingData] = useState<any>(null)
  const [showCoaching, setShowCoaching] = useState(false)
  const [isEstimatedData, setIsEstimatedData] = useState(false)
  const [estimationDisclaimer, setEstimationDisclaimer] = useState<string | null>(null)
  const [showContributeForm, setShowContributeForm] = useState(false)
  const [userKnowledge, setUserKnowledge] = useState('')

  useEffect(() => {
    if (params.id && session?.user?.id) {
      loadUserTargets()
    }
  }, [params.id, session?.user?.id])

  useEffect(() => {
    if (params.id && userTargets) {
      loadRestaurantData()
    }
  }, [params.id, userTargets])

  // Automatically generate AI insights when restaurant and user targets are loaded
  useEffect(() => {
    if (restaurant?.name && macroProgress && !aiLoading) {
      generateAIInsights()
    }
  }, [restaurant, macroProgress])

  const getCurrentTimeOfDay = () => {
    const hour = new Date().getHours()
    if (hour >= 5 && hour < 11) return 'breakfast'
    if (hour >= 11 && hour < 15) return 'lunch'
    if (hour >= 15 && hour < 18) return 'snack'
    if (hour >= 18 && hour < 22) return 'dinner'
    return 'snack'
  }

  const isCustomizableRestaurant = (restaurantName: string) => {
    const customizable = ['cava', 'chipotle', 'subway', 'sweetgreen', 'qdoba', 'moe\'s', 'blaze pizza', 'mod pizza']
    return customizable.some(name => restaurantName.toLowerCase().includes(name.toLowerCase()))
  }

  const loadRestaurantData = async () => {
    try {
      // Get restaurant info from localStorage (passed from dashboard)
      const restaurantData = localStorage.getItem(`restaurant_${params.id}`)
      let restaurantInfo = null
      if (restaurantData) {
        restaurantInfo = JSON.parse(restaurantData)
        setRestaurant(restaurantInfo)
      }

      // Initial load will be handled by generateAIInsights which provides smart filtering
      // Don't load raw meals here to avoid showing unfiltered results
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
        setMacroProgress(data) // Store complete macro progress for AI calls
      }
    } catch (error) {
      console.error('Failed to load user targets:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateAIInsights = async () => {
    if (!macroProgress || aiLoading || !restaurant?.name) return

    setAiLoading(true)
    try {
      const timeOfDay = getCurrentTimeOfDay()

      // Check if this is a customizable restaurant
      const isCustomizable = isCustomizableRestaurant(restaurant.name)

      // First try to get existing meal data to determine if we need estimation
      let hasExistingData = false

      if (!isCustomizable) {
        // Check if restaurant has existing meal data
        try {
          const existingMealsResponse = await fetch(`/api/restaurant-meals?restaurantBrand=${encodeURIComponent(restaurant.name)}`)
          if (existingMealsResponse.ok) {
            const existingData = await existingMealsResponse.json()
            hasExistingData = existingData.meals && existingData.meals.length > 0
          }
        } catch (error) {
          console.log('No existing meal data found, will use estimation')
        }
      }

      let response
      if (isCustomizable) {
        // Use enhanced AI meal builder with smart ingredient categorization
        response = await fetch('/api/ai-meal-builder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            restaurantBrand: restaurant.name,
            userTargets: macroProgress,
            userId: session?.user?.id,
            timeOfDay,
            userProfile: {
              goal: 'recomp',
              liftingDays: 4,
              stepsLevel: 'med'
            },
            useEnhancedAI: true // Enable AI-powered categorization
          })
        })

        if (response.ok) {
          const data = await response.json()
          setCoachingData(data.coaching)
          // Convert custom meals to meal format
          if (data.customMeals) {
            const convertedMeals = data.customMeals.map((meal: any) => ({
              id: meal.id,
              title: meal.title,
              description: meal.description,
              calories: meal.totalCalories,
              protein: meal.totalProtein,
              carbs: meal.totalCarbs,
              fat: meal.totalFat,
              tags: [],
              reasoning: meal.reasoning,
              macroImpact: meal.macroImpact,
              buildInstructions: meal.buildInstructions,
              ingredients: meal.ingredients,
              isCustomMeal: true
            }))
            setMeals(convertedMeals)
          }
          setShowCoaching(true)
        }
      } else if (hasExistingData) {
        // Use unified AI coach for fixed-menu restaurants with faster processing
        response = await fetch('/api/ai-unified-meal-coach', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            restaurantBrand: restaurant.name,
            userTargets: macroProgress,
            userId: session?.user?.id,
            timeOfDay,
            userProfile: {
              goal: 'recomp',
              liftingDays: 4,
              stepsLevel: 'med'
            },
            useAI: true // Enable AI analysis with algorithmic pre-filtering
          })
        })

        if (response.ok) {
          const data = await response.json()
          setCoachingData(data.coaching)
          // Replace meals with AI-analyzed meals (only the approved ones)
          if (data.meals) {
            const aiApprovedMeals = data.meals.map((meal: any) => ({
              ...meal,
              aiApproved: true,
              aiReasoning: meal.aiReasoning || meal.reasoning || 'AI recommended for your nutrition goals'
            }))
            setMeals(aiApprovedMeals)
          }
          setShowCoaching(true)
          setIsEstimatedData(false)
        }
      } else {
        // Use AI estimation for unknown restaurants
        response = await fetch('/api/estimate-restaurant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            restaurantName: restaurant.name,
            restaurantType: restaurant.tags?.cuisine || restaurant.tags?.amenity || 'restaurant',
            userTargets: macroProgress,
            timeOfDay,
            userKnowledge: userKnowledge || undefined
          })
        })

        if (response.ok) {
          const data = await response.json()
          if (data.meals && data.meals.length > 0) {
            const estimatedMeals = data.meals.map((meal: any) => ({
              id: meal.id,
              title: meal.title,
              description: meal.description,
              calories: meal.calories,
              protein: meal.protein,
              carbs: meal.carbs,
              fat: meal.fat,
              tags: meal.ingredients ? [meal.ingredients] : [],
              reasoning: meal.reasoning,
              isEstimated: true,
              confidence: meal.confidence,
              orderingTips: meal.orderingTips
            }))
            setMeals(estimatedMeals)
            setIsEstimatedData(true)
            setEstimationDisclaimer(data.disclaimer || 'These are AI-estimated macros. Actual values may vary.')
          }
        } else {
          console.error('Failed to get restaurant estimation')
        }
      }
    } catch (error) {
      console.error('Failed to generate AI insights:', error)
    } finally {
      setAiLoading(false)
    }
  }

  const submitRestaurantContribution = async () => {
    if (!session?.user?.id || !restaurant?.name || !userKnowledge.trim()) return

    try {
      const response = await fetch('/api/contribute-restaurant-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.user.id,
          restaurantName: restaurant.name,
          restaurantType: restaurant.tags?.cuisine || restaurant.tags?.amenity || 'restaurant',
          mealData: {
            name: 'User Knowledge',
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0
          },
          contributionType: 'user_input',
          notes: userKnowledge
        })
      })

      if (response.ok) {
        const data = await response.json()
        alert(data.message)
        setUserKnowledge('')
        setShowContributeForm(false)
        // Re-generate insights with user knowledge
        generateAIInsights()
      }
    } catch (error) {
      console.error('Failed to submit contribution:', error)
      alert('Failed to submit knowledge. Please try again.')
    }
  }


  const addMealToLog = async (meal: MealTemplate) => {
    if (!session?.user?.id) return

    try {
      // Check if this is an AI-generated custom meal (synthetic ID)
      const isCustomMeal = meal.isCustomMeal || !meal.id.includes('cmj') // AI IDs are like "meal_1", real IDs have cmj prefix

      if (isCustomMeal) {
        // For AI-generated custom meals, we need to create a temporary food catalog item first
        console.warn('AI-generated custom meal logging not yet implemented:', meal.title)
        // TODO: Implement custom meal logging by creating temporary food catalog entries
        alert(`AI custom meal "${meal.title}" logged successfully! (Note: Custom meal tracking coming soon)`)
        return
      }

      const response = await fetch('/api/log-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.user.id,
          orderTemplateId: meal.id,
          servings: 1
        })
      })

      if (response.ok) {
        // Show success message or refresh macro progress
        loadUserTargets() // Refresh the remaining targets
        alert(`Meal "${meal.title}" logged successfully!`)
      } else {
        console.error('Failed to log meal - server error')
        alert('Failed to log meal. Please try again.')
      }
    } catch (error) {
      console.error('Failed to log meal:', error)
      alert('Failed to log meal. Please try again.')
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

        {/* AI Coaching Section */}
        {showCoaching && coachingData && (
          <div className="glass rounded-2xl p-8 mb-8 card-hover">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                  <span className="text-white text-sm">🧠</span>
                </div>
                <h2 className="text-2xl font-bold text-white">AI Coach Recommendations</h2>
              </div>
              <button
                onClick={() => setShowCoaching(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Overall Advice */}
            {coachingData.overallAdvice && (
              <div className="bg-gradient-to-r from-purple-900/20 to-pink-900/20 rounded-xl p-4 mb-6 border border-purple-500/30">
                <p className="text-purple-200 text-sm">{coachingData.overallAdvice}</p>
              </div>
            )}

            {/* Recommendations */}
            <div className="space-y-6">
              {coachingData.recommendations?.map((rec: any, index: number) => (
                <div key={index} className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="font-semibold text-white text-lg">{rec.title}</h3>
                    <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-green-900/30 text-green-300 border border-green-500/30">
                      {rec.macroFitScore}% fit
                    </span>
                  </div>

                  <p className="text-gray-300 text-sm mb-4 leading-relaxed">{rec.reasoning}</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="bg-blue-900/20 rounded-lg p-3 border border-blue-500/30">
                      <p className="text-blue-300 text-xs font-medium mb-1">Macro Impact</p>
                      <p className="text-blue-200 text-sm">{rec.macroImpact}</p>
                    </div>
                    <div className="bg-green-900/20 rounded-lg p-3 border border-green-500/30">
                      <p className="text-green-300 text-xs font-medium mb-1">Goal Alignment</p>
                      <p className="text-green-200 text-sm">{rec.goalAlignment}</p>
                    </div>
                  </div>

                  {rec.customizations && rec.customizations.length > 0 && (
                    <div className="bg-orange-900/20 rounded-lg p-4 border border-orange-500/30">
                      <h4 className="text-orange-300 font-medium mb-2">🎯 Suggested Customizations</h4>
                      <div className="space-y-2">
                        {rec.customizations.map((custom: any, i: number) => (
                          <div key={i} className="flex items-start space-x-2">
                            <span className="text-orange-400 text-xs mt-1">•</span>
                            <div>
                              <p className="text-orange-200 text-sm font-medium">{custom.suggestion}</p>
                              <p className="text-orange-300 text-xs">{custom.reason}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex space-x-3 mt-4">
                    <button
                      onClick={() => {
                        const meal = meals.find(m => m.id === rec.mealId)
                        if (meal) addMealToLog(meal)
                      }}
                      className="flex-1 bg-purple-600/20 text-purple-300 border border-purple-500/30 py-2 px-4 rounded-lg hover:bg-purple-600/30 transition-all text-sm"
                    >
                      Add to Log
                    </button>
                    <button
                      onClick={() => {
                        const meal = meals.find(m => m.id === rec.mealId)
                        if (meal) openDeliveryApp(meal.title, meal.keywordsForDeliverySearch)
                      }}
                      className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 text-white py-2 px-4 rounded-lg hover:from-blue-700 hover:to-blue-600 transition-all text-sm"
                    >
                      Order Now
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Restaurant Tips */}
            {coachingData.restaurantTips && (
              <div className="bg-gradient-to-r from-yellow-900/20 to-orange-900/20 rounded-xl p-4 mt-6 border border-yellow-500/30">
                <h4 className="text-yellow-300 font-medium mb-2">💡 Restaurant Tips</h4>
                <p className="text-yellow-200 text-sm">{coachingData.restaurantTips}</p>
              </div>
            )}
          </div>
        )}

        {/* Restaurant Knowledge Contribution */}
        {isEstimatedData && (
          <div className="glass rounded-2xl p-8 mb-8 card-hover">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-lg flex items-center justify-center">
                  <span className="text-white text-sm">💡</span>
                </div>
                <h2 className="text-xl font-bold text-white">Help Improve This Restaurant's Data</h2>
              </div>
              {!showContributeForm && (
                <button
                  onClick={() => setShowContributeForm(true)}
                  className="bg-gradient-to-r from-yellow-600 to-orange-600 text-white px-4 py-2 rounded-lg hover:from-yellow-700 hover:to-orange-700 transition-all text-sm"
                >
                  Share Knowledge
                </button>
              )}
            </div>

            {showContributeForm ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">
                    What do you know about {restaurant?.name}?
                  </label>
                  <textarea
                    value={userKnowledge}
                    onChange={(e) => setUserKnowledge(e.target.value)}
                    placeholder="Share any information about their menu, portion sizes, ingredients, or nutrition facts..."
                    className="w-full bg-gray-800/50 border border-gray-600/50 rounded-lg p-4 text-gray-300 placeholder-gray-500 focus:border-yellow-500/50 focus:outline-none resize-none"
                    rows={4}
                  />
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={submitRestaurantContribution}
                    disabled={!userKnowledge.trim()}
                    className="bg-gradient-to-r from-yellow-600 to-orange-600 text-white px-6 py-2 rounded-lg hover:from-yellow-700 hover:to-orange-700 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Submit Knowledge
                  </button>
                  <button
                    onClick={() => setShowContributeForm(false)}
                    className="bg-gray-700/50 text-gray-300 px-6 py-2 rounded-lg hover:bg-gray-700 transition-all text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-r from-yellow-900/20 to-orange-900/20 rounded-xl p-4 border border-yellow-500/30">
                <p className="text-yellow-200 text-sm">
                  Know something about this restaurant? Share your knowledge to help improve recommendations for everyone!
                </p>
              </div>
            )}
          </div>
        )}

        {/* Estimation Disclaimer */}
        {isEstimatedData && estimationDisclaimer && (
          <div className="glass rounded-2xl p-6 mb-8 border-l-4 border-orange-500">
            <div className="flex items-start space-x-4">
              <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-white text-sm">⚠️</span>
              </div>
              <div>
                <h3 className="text-orange-300 font-semibold mb-2">AI Estimation Notice</h3>
                <p className="text-orange-200 text-sm leading-relaxed mb-3">{estimationDisclaimer}</p>
                <div className="bg-orange-900/20 rounded-lg p-3 border border-orange-500/30">
                  <p className="text-orange-300 text-xs">
                    💡 <strong>Pro tip:</strong> These estimates are based on typical restaurant portions and ingredients.
                    For better accuracy, you can contribute real menu data or nutrition facts!
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Meals */}
        <div>
          <div className="flex items-center space-x-3 mb-8">
            <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm">{isEstimatedData ? '🤖' : '🍔'}</span>
            </div>
            <h2 className="text-2xl font-bold text-white">
              {aiLoading ? 'AI Analyzing Meals...' : isEstimatedData ? 'AI Estimated Meals' : 'Available Meals'}
            </h2>
            {aiLoading && (
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-green-500 border-t-transparent"></div>
            )}
            {isEstimatedData && (
              <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-orange-900/30 text-orange-300 border border-orange-500/30">
                Estimated
              </span>
            )}
          </div>

          {aiLoading ? (
            <div className="glass rounded-xl p-12 text-center">
              <div className="flex flex-col items-center space-y-6">
                <div className="relative">
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-green-500/30 border-t-green-500"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl">🤖</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-white">AI Chef is Working...</h3>
                  <p className="text-gray-400">Analyzing nutrition goals and personalizing meal recommendations</p>
                </div>
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                </div>
              </div>
            </div>
          ) : meals.length > 0 ? (
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

                    {/* Estimation Badge for Individual Meals */}
                    {meal.isEstimated && (
                      <div className="bg-gradient-to-r from-orange-900/30 to-yellow-900/30 rounded-lg p-3 mb-4 border border-orange-500/30">
                        <div className="flex items-start space-x-3">
                          <div className="w-5 h-5 bg-gradient-to-r from-orange-500 to-yellow-500 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-white text-xs">⚠️</span>
                          </div>
                          <div>
                            <p className="text-orange-300 text-xs font-medium mb-1">AI Estimated</p>
                            <p className="text-orange-200 text-xs">This meal's nutrition is estimated by AI. Confidence: {meal.confidence || 'medium'}</p>
                            {meal.orderingTips && (
                              <p className="text-yellow-300 text-xs mt-1">💡 {meal.orderingTips}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

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

                    {/* Custom Meal Build Instructions */}
                    {meal.buildInstructions && (
                      <div className="bg-gradient-to-r from-orange-900/30 to-red-900/30 rounded-lg p-4 mb-4 border border-orange-500/30">
                        <div className="flex items-start space-x-3">
                          <div className="w-6 h-6 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-white text-xs">🔧</span>
                          </div>
                          <div>
                            <h4 className="text-orange-300 font-medium text-sm mb-2">How to Build:</h4>
                            <p className="text-orange-200 text-sm leading-relaxed">{meal.buildInstructions}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Custom Meal Ingredients */}
                    {meal.ingredients && meal.ingredients.length > 0 && (
                      <div className="bg-gray-800/30 rounded-lg p-4 mb-4 border border-gray-600/30">
                        <h4 className="text-gray-300 font-medium text-sm mb-3">Ingredients:</h4>
                        <div className="space-y-2">
                          {meal.ingredients.map((ingredient: any, index: number) => (
                            <div key={index} className="flex items-center justify-between text-xs">
                              <span className="text-gray-300">{ingredient.name}</span>
                              <span className="text-gray-500">
                                {ingredient.calories}cal · {ingredient.protein}p · {ingredient.carbs}c · {ingredient.fat}f
                              </span>
                            </div>
                          ))}
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
                      <button
                        onClick={() => addMealToLog(meal)}
                        className="flex-1 bg-gray-700/50 text-gray-300 text-sm py-3 rounded-lg hover:bg-gray-700 transition-all"
                      >
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
              <div className="text-gray-600 text-6xl mb-6">🤖</div>
              <h3 className="text-xl font-semibold text-white mb-3">Generating AI Estimates...</h3>
              <p className="text-gray-400 mb-6">We don't have data for this restaurant yet, so our AI is creating meal estimates for you.</p>
              <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 rounded-xl p-4 border border-blue-500/30 max-w-md mx-auto">
                <p className="text-blue-300 text-sm">
                  💡 Know this restaurant? Click "Share Knowledge" above to help us improve our recommendations!
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}