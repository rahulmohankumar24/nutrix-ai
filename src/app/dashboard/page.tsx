'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { MacroProgress } from '@/lib/types'
import { PathwayVisualization } from '@/components/pathway-visualization'
import Link from 'next/link'
import { Utensils, MessageCircle, TrendingUp, Plus, Send, Check, X, Trash2, Sparkles, ChevronRight, MapPin, DollarSign, Home, ExternalLink, RefreshCw, Car, Footprints } from 'lucide-react'
import { ChatWidget } from '@/components/chat-widget'

// Cache utilities - avoid redundant AI calls
const CACHE_TTL = 30 * 60 * 1000 // 30 minutes

function getTimePeriod(): string {
  const hour = new Date().getHours()
  if (hour < 11) return 'morning'
  if (hour < 16) return 'afternoon'
  return 'evening'
}

function getCacheKey(type: string, userId: string, extras: Record<string, any> = {}): string {
  const date = new Date().toISOString().split('T')[0]
  const timePeriod = getTimePeriod()
  return `rovia_cache_${type}_${userId}_${date}_${timePeriod}_${JSON.stringify(extras)}`
}

function getCache<T>(key: string): T | null {
  try {
    const cached = localStorage.getItem(key)
    if (!cached) return null
    const { data, timestamp, mealCount } = JSON.parse(cached)
    // Check if expired
    if (Date.now() - timestamp > CACHE_TTL) {
      localStorage.removeItem(key)
      return null
    }
    // Return data and mealCount for validation
    return { ...data, _cachedMealCount: mealCount } as T
  } catch {
    return null
  }
}

function setCache(key: string, data: any, mealCount: number): void {
  try {
    localStorage.setItem(key, JSON.stringify({
      data,
      timestamp: Date.now(),
      mealCount
    }))
  } catch {
    // localStorage full or unavailable
  }
}

function invalidateCache(userId: string): void {
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(`rovia_cache_`) && k.includes(userId))
    keys.forEach(k => localStorage.removeItem(k))
  } catch {}
}

interface MealLogEntry {
  id: string
  datetime: string
  servings: number
  mealType?: string
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

interface PendingMeal {
  name: string
  calories: number
  protein: number
  carbs: number
  fat: number
  servings: number
}

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
}

interface HomeMealSuggestion {
  name: string
  description: string
  prepTime: string
  ingredients: string[]
  instructions: string
  calories: number
  protein: number
  carbs: number
  fat: number
}

interface ReadyToEatItem {
  name: string
  portion: string
  calories: number
  protein: number
  note?: string
}

interface DailyInsights {
  status: 'on_track' | 'needs_attention' | 'great_job'
  headline: string
  insights: string[]
  loading?: boolean
}

interface PatternInsight {
  id: string
  headline: string
  body: string
  tone: 'positive' | 'neutral' | 'curious'
  category: string
}

export default function DashboardPage() {
  const router = useRouter()
  const { user, isLoaded, isSignedIn } = useUser()
  const [macros, setMacros] = useState<MacroProgress | null>(null)
  const [mealLogs, setMealLogs] = useState<DailyMealLogs | null>(null)
  const [suggestions, setSuggestions] = useState<MealSuggestion[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(true)
  const [suggestionMealTime, setSuggestionMealTime] = useState<string>('lunch')
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [insights, setInsights] = useState<DailyInsights | null>(null)
  const [mealSize, setMealSize] = useState<'light' | 'regular' | 'hearty'>('regular')
  const [diningMode, setDiningMode] = useState<'takeout' | 'dine-in'>('takeout')
  const [travelMode, setTravelMode] = useState<'walk' | 'drive'>('drive')
  const [suggestionMessage, setSuggestionMessage] = useState<string | null>(null)
  const [isNearGoal, setIsNearGoal] = useState(false)
  const [goalAchieved, setGoalAchieved] = useState(false)
  const [flippedCardIndex, setFlippedCardIndex] = useState<number | null>(null)
  const [patternInsight, setPatternInsight] = useState<PatternInsight | null>(null)
  const [patternProgress, setPatternProgress] = useState<{ daysLogged: number; hasPatterns: boolean }>({ daysLogged: 0, hasPatterns: false })
  const [hasPersonalizedSuggestions, setHasPersonalizedSuggestions] = useState(false)
  const [unlockCelebration, setUnlockCelebration] = useState<{ show: boolean; message: string } | null>(null)

  // Home meals state
  const [mealSource, setMealSource] = useState<'restaurant' | 'home'>('restaurant')
  const [homeMeals, setHomeMeals] = useState<HomeMealSuggestion[]>([])
  const [readyToEat, setReadyToEat] = useState<ReadyToEatItem[]>([])
  const [homeMessage, setHomeMessage] = useState<string | null>(null)
  const [pantryCount, setPantryCount] = useState(0)

  // Inline chat state
  const [showChatInput, setShowChatInput] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [pendingMeal, setPendingMeal] = useState<PendingMeal | null>(null)
  const [selectedMealType, setSelectedMealType] = useState<string>(() => {
    const hour = new Date().getHours()
    if (hour < 11) return 'breakfast'
    if (hour < 16) return 'lunch'
    return 'dinner'
  })
  const [isLogging, setIsLogging] = useState(false)
  const [deletingMealId, setDeletingMealId] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoaded) return

    if (!isSignedIn) {
      router.push('/auth/signin')
      return
    }

    // Stop showing full-page loader immediately so layout renders
    setLoading(false)

    if (user?.id) {
      // Load dashboard data FIRST (quick, no AI), then load AI-powered features
      // This ensures mealLogs is populated before cache checks happen
      const initializeDashboard = async () => {
        // Sync user and load meal data in parallel
        const results = await Promise.all([
          fetch('/api/sync-user', { method: 'POST' }).catch(() => {}),
          loadDashboardData(user.id)
        ])
        const mealCount = results[1] as number // Get meal count for cache validation
        // NOW load AI-powered features (with valid mealCount for cache checks)
        getUserLocationAndSuggestions(user.id, mealCount)
        loadInsights(user.id, false, mealCount)
        loadPatternInsight(user.id)
      }
      initializeDashboard()
    }
  }, [user, isLoaded, isSignedIn, router])

  const getUserLocationAndSuggestions = async (userId: string, mealCount?: number) => {
    setLoadingSuggestions(true)

    // Try to get user's location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = { lat: position.coords.latitude, lng: position.coords.longitude }
          setUserLocation(loc)
          loadSuggestions(userId, loc, 'regular', 'takeout', 'drive', false, mealCount)
        },
        () => {
          // Location denied, load suggestions without location
          loadSuggestions(userId, null, 'regular', 'takeout', 'drive', false, mealCount)
        },
        { timeout: 5000 }
      )
    } else {
      loadSuggestions(userId, null, 'regular', 'takeout', 'drive', false, mealCount)
    }
  }

  const loadSuggestions = async (
    userId: string,
    location: { lat: number; lng: number } | null,
    size: 'light' | 'regular' | 'hearty' = 'regular',
    dining: 'takeout' | 'dine-in' = 'takeout',
    travel: 'walk' | 'drive' = 'drive',
    forceRefresh: boolean = false,
    knownMealCount?: number
  ) => {
    // Round location to avoid cache misses from tiny GPS changes
    const roundedLoc = location ? {
      lat: Math.round(location.lat * 100) / 100,
      lng: Math.round(location.lng * 100) / 100
    } : null

    const cacheKey = getCacheKey('suggestions', userId, { size, dining, travel, loc: roundedLoc })
    const currentMealCount = knownMealCount ?? mealLogs?.count ?? 0

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = getCache<any>(cacheKey)
      if (cached && cached._cachedMealCount === currentMealCount) {
        setSuggestions(cached.suggestions || [])
        setSuggestionMealTime(cached.mealTime || 'lunch')
        setSuggestionMessage(cached.message || null)
        setIsNearGoal(cached.isNearGoal || false)
        setGoalAchieved(cached.goalAchieved || false)
        setHasPersonalizedSuggestions(cached.hasPersonalizedData || false)
        setLoadingSuggestions(false)
        return
      }
    }

    setLoadingSuggestions(true)
    try {
      let url = `/api/meal-suggestions?userId=${userId}&size=${size}&dining=${dining}&travel=${travel}`
      if (location) {
        url += `&lat=${location.lat}&lng=${location.lng}`
      }
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setSuggestions(data.suggestions || [])
        setSuggestionMealTime(data.mealTime || 'lunch')
        setSuggestionMessage(data.message || null)
        setIsNearGoal(data.isNearGoal || false)
        setGoalAchieved(data.goalAchieved || false)
        setHasPersonalizedSuggestions(data.hasPersonalizedData || false)
        // Cache the result
        setCache(cacheKey, data, currentMealCount)
      }
    } catch (error) {
      console.error('Failed to load suggestions:', error)
    } finally {
      setLoadingSuggestions(false)
    }
  }

  const handleMealSizeChange = (size: 'light' | 'regular' | 'hearty') => {
    setMealSize(size)
    if (user?.id) {
      // Force refresh when user changes settings
      loadSuggestions(user.id, userLocation, size, diningMode, travelMode, true)
    }
  }

  const handleDiningModeChange = (mode: 'takeout' | 'dine-in') => {
    setDiningMode(mode)
    if (user?.id) {
      // Force refresh when user changes settings
      loadSuggestions(user.id, userLocation, mealSize, mode, travelMode, true)
    }
  }

  const handleTravelModeChange = (mode: 'walk' | 'drive') => {
    setTravelMode(mode)
    if (user?.id) {
      // Force refresh when user changes settings
      loadSuggestions(user.id, userLocation, mealSize, diningMode, mode, true)
    }
  }

  const handleMealSourceChange = (source: 'restaurant' | 'home') => {
    setMealSource(source)
    if (source === 'home' && user?.id) {
      loadHomeMeals(user.id)
    }
  }

  const handleRefreshSuggestions = () => {
    if (!user?.id) return
    if (mealSource === 'home') {
      loadHomeMeals(user.id, true)
    } else {
      loadSuggestions(user.id, userLocation, mealSize, diningMode, travelMode, true)
    }
    loadInsights(user.id, true)
  }

  const loadHomeMeals = async (userId: string, forceRefresh: boolean = false, knownMealCount?: number) => {
    const cacheKey = getCacheKey('homeMeals', userId)
    const currentMealCount = knownMealCount ?? mealLogs?.count ?? 0

    // Check cache first
    if (!forceRefresh) {
      const cached = getCache<any>(cacheKey)
      if (cached && cached._cachedMealCount === currentMealCount) {
        setHomeMeals(cached.meals || [])
        setReadyToEat(cached.readyToEat || [])
        setHomeMessage(cached.message || null)
        setPantryCount(cached.pantryItemCount || 0)
        setLoadingSuggestions(false)
        return
      }
    }

    setLoadingSuggestions(true)
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
        setPantryCount(data.pantryItemCount || 0)
        // Cache the result
        setCache(cacheKey, data, currentMealCount)
      }
    } catch (error) {
      console.error('Failed to load home meals:', error)
    } finally {
      setLoadingSuggestions(false)
    }
  }

  const loadInsights = async (userId: string, forceRefresh: boolean = false, knownMealCount?: number) => {
    const cacheKey = getCacheKey('insights', userId)
    const currentMealCount = knownMealCount ?? mealLogs?.count ?? 0

    // Check cache first
    if (!forceRefresh) {
      const cached = getCache<any>(cacheKey)
      if (cached && cached._cachedMealCount === currentMealCount) {
        setInsights({
          status: cached.status || 'on_track',
          headline: cached.headline || 'Keep going',
          insights: cached.insights || [],
          loading: false
        })
        return
      }
    }

    // Show loading state
    setInsights({ status: 'on_track', headline: '', insights: [], loading: true })

    try {
      const response = await fetch(`/api/daily-insights?userId=${userId}`)
      if (response.ok) {
        const data = await response.json()
        setInsights({
          status: data.status || 'on_track',
          headline: data.headline || 'Keep going',
          insights: data.insights || [],
          loading: false
        })
        // Cache the result
        setCache(cacheKey, data, currentMealCount)
      }
    } catch (error) {
      console.error('Failed to load insights:', error)
      setInsights(null)
    }
  }

  const loadPatternInsight = async (userId: string) => {
    try {
      // Get stored pattern count from localStorage
      const storedPatternCount = parseInt(localStorage.getItem(`patternCount_${userId}`) || '0')

      // First trigger pattern analysis and get progress
      const analyzeResponse = await fetch('/api/patterns/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, reanalyze: true })
      })

      if (analyzeResponse.ok) {
        const analyzeData = await analyzeResponse.json()
        const newPatternCount = analyzeData.patternsDetected || 0

        setPatternProgress({
          daysLogged: analyzeData.daysAnalyzed || 0,
          hasPatterns: newPatternCount > 0
        })

        // Check if new patterns were discovered
        if (newPatternCount > storedPatternCount && storedPatternCount > 0) {
          // New pattern unlocked!
          const newInsights = analyzeData.insights || []
          const latestInsight = newInsights[0]
          if (latestInsight) {
            setUnlockCelebration({
              show: true,
              message: latestInsight.headline || 'New pattern discovered!'
            })
            // Auto-dismiss after 5 seconds
            setTimeout(() => setUnlockCelebration(null), 5000)
          }
        }

        // Store new count
        localStorage.setItem(`patternCount_${userId}`, String(newPatternCount))
      }

      // Then fetch the daily insight
      const response = await fetch(`/api/patterns/insights?userId=${userId}&daily=true`)
      if (response.ok) {
        const data = await response.json()
        if (data.insight) {
          setPatternInsight(data.insight)
          // Mark as displayed
          fetch('/api/patterns/insights', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ insightId: data.insight.id })
          }).catch(() => {})
        }
      }
    } catch (error) {
      console.error('Failed to load pattern insight:', error)
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
        return mealLogData.count || 0 // Return meal count for cache validation
      }
      return 0
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
      return 0
    } finally {
      setLoading(false)
    }
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  // Build pathway data from meal logs
  const getDailyMealPath = () => {
    if (!mealLogs || !macros) {
      const currentHour = new Date().getHours()
      return [
        {
          time: 'Breakfast',
          percentage: 0,
          isCompleted: false,
          isCurrent: currentHour < 11,
          macros: { calories: 0, protein: 0, carbs: 0, fat: 0 }
        },
        {
          time: 'Lunch',
          percentage: 0,
          isCompleted: false,
          isCurrent: currentHour >= 11 && currentHour < 16,
          macros: { calories: 0, protein: 0, carbs: 0, fat: 0 }
        },
        {
          time: 'Dinner',
          percentage: 0,
          isCompleted: false,
          isCurrent: currentHour >= 16,
          macros: { calories: 0, protein: 0, carbs: 0, fat: 0 }
        }
      ]
    }

    const mealsByTime = {
      breakfast: [] as MealLogEntry[],
      lunch: [] as MealLogEntry[],
      dinner: [] as MealLogEntry[]
    }

    mealLogs.mealLogs.forEach(log => {
      if (log.mealType) {
        if (log.mealType === 'breakfast') {
          mealsByTime.breakfast.push(log)
        } else if (log.mealType === 'lunch') {
          mealsByTime.lunch.push(log)
        } else if (log.mealType === 'dinner' || log.mealType === 'snack') {
          mealsByTime.dinner.push(log)
        }
      } else {
        const hour = new Date(log.datetime).getHours()
        if (hour < 11) {
          mealsByTime.breakfast.push(log)
        } else if (hour < 16) {
          mealsByTime.lunch.push(log)
        } else {
          mealsByTime.dinner.push(log)
        }
      }
    })

    const calculateMealMacros = (meals: MealLogEntry[]) => {
      return meals.reduce((sum, meal) => {
        const item = meal.orderTemplate || meal.foodCatalogItem
        if (!item) return sum
        return {
          calories: sum.calories + (item.calories * meal.servings),
          protein: sum.protein + (item.protein * meal.servings)
        }
      }, { calories: 0, protein: 0 })
    }

    const currentHour = new Date().getHours()

    const calculateFullMacros = (meals: MealLogEntry[]) => {
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

    const breakfastMacros = calculateFullMacros(mealsByTime.breakfast)
    const lunchMacros = calculateFullMacros(mealsByTime.lunch)
    const dinnerMacros = calculateFullMacros(mealsByTime.dinner)

    return [
      {
        time: 'Breakfast',
        percentage: mealsByTime.breakfast.length > 0
          ? Math.round((breakfastMacros.calories / macros.targets.calories) * 100)
          : 0,
        isCompleted: mealsByTime.breakfast.length > 0,
        isCurrent: currentHour < 11 && mealsByTime.breakfast.length === 0,
        macros: {
          calories: Math.round(breakfastMacros.calories),
          protein: Math.round(breakfastMacros.protein),
          carbs: Math.round(breakfastMacros.carbs),
          fat: Math.round(breakfastMacros.fat)
        }
      },
      {
        time: 'Lunch',
        percentage: mealsByTime.lunch.length > 0
          ? Math.round((lunchMacros.calories / macros.targets.calories) * 100)
          : 0,
        isCompleted: mealsByTime.lunch.length > 0,
        isCurrent: currentHour >= 11 && currentHour < 16 && mealsByTime.lunch.length === 0,
        macros: {
          calories: Math.round(lunchMacros.calories),
          protein: Math.round(lunchMacros.protein),
          carbs: Math.round(lunchMacros.carbs),
          fat: Math.round(lunchMacros.fat)
        }
      },
      {
        time: 'Dinner',
        percentage: mealsByTime.dinner.length > 0
          ? Math.round((dinnerMacros.calories / macros.targets.calories) * 100)
          : 0,
        isCompleted: mealsByTime.dinner.length > 0,
        isCurrent: currentHour >= 16 && mealsByTime.dinner.length === 0,
        macros: {
          calories: Math.round(dinnerMacros.calories),
          protein: Math.round(dinnerMacros.protein),
          carbs: Math.round(dinnerMacros.carbs),
          fat: Math.round(dinnerMacros.fat)
        }
      }
    ]
  }

  // Get meals grouped by type
  const getMealsByType = () => {
    if (!mealLogs || mealLogs.mealLogs.length === 0) return { breakfast: [], lunch: [], dinner: [] }

    const grouped: { breakfast: typeof meals; lunch: typeof meals; dinner: typeof meals } = {
      breakfast: [],
      lunch: [],
      dinner: []
    }

    const meals = mealLogs.mealLogs.map(log => ({
      id: log.id,
      name: log.orderTemplate?.title || log.foodCatalogItem?.name || 'Unknown',
      source: log.orderTemplate?.restaurantBrand || log.foodCatalogItem?.source || '',
      calories: Math.round((log.orderTemplate?.calories || log.foodCatalogItem?.calories || 0) * log.servings),
      protein: Math.round((log.orderTemplate?.protein || log.foodCatalogItem?.protein || 0) * log.servings),
      mealType: log.mealType || 'meal',
      datetime: log.datetime
    }))

    meals.forEach(meal => {
      if (meal.mealType === 'breakfast') {
        grouped.breakfast.push(meal)
      } else if (meal.mealType === 'lunch') {
        grouped.lunch.push(meal)
      } else {
        // dinner, snack, or unknown goes to dinner
        grouped.dinner.push(meal)
      }
    })

    return grouped
  }

  // Handle inline chat submission
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim() || !user?.id || pendingMeal) return

    setIsProcessing(true)

    try {
      const response = await fetch('/api/nutrition-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: chatInput,
          userId: user.id
        })
      })

      if (!response.ok) throw new Error('Failed to process')

      const data = await response.json()

      if (data.mealParsed && data.parsedMeal) {
        setPendingMeal({
          name: data.parsedMeal.name,
          calories: data.parsedMeal.calories,
          protein: data.parsedMeal.protein,
          carbs: data.parsedMeal.carbs,
          fat: data.parsedMeal.fat,
          servings: data.parsedMeal.servings || 1
        })
        setChatInput('')
      }
    } catch (error) {
      console.error('Failed to process:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const confirmMeal = async () => {
    if (!pendingMeal || !user?.id) return

    setIsLogging(true)

    try {
      const response = await fetch('/api/log-meal-direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          name: pendingMeal.name,
          calories: pendingMeal.calories,
          protein: pendingMeal.protein,
          carbs: pendingMeal.carbs,
          fat: pendingMeal.fat,
          servings: pendingMeal.servings,
          mealType: selectedMealType
        })
      })

      if (!response.ok) throw new Error('Failed to log meal')

      // Refresh data and insights
      await loadDashboardData(user.id)
      loadInsights(user.id)
      setPendingMeal(null)
      setShowChatInput(false)
      setChatInput('')
    } catch (error) {
      console.error('Failed to log meal:', error)
    } finally {
      setIsLogging(false)
    }
  }

  const cancelMeal = () => {
    setPendingMeal(null)
    setChatInput('')
  }

  const deleteMeal = async (mealId: string) => {
    if (!user?.id) return

    setDeletingMealId(mealId)

    try {
      const response = await fetch(`/api/log-meal?mealLogId=${mealId}&userId=${user.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete meal')

      // Refresh data and insights
      await loadDashboardData(user.id)
      loadInsights(user.id)
    } catch (error) {
      console.error('Failed to delete meal:', error)
    } finally {
      setDeletingMealId(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  const userName = user?.firstName || 'there'

  return (
    <div className="min-h-screen bg-background">
      {/* Unlock Celebration Banner */}
      {unlockCelebration?.show && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 fade-in duration-300">
          <div className="bg-gradient-to-r from-purple-500 to-blue-500 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-3">
            <span className="text-xl">🎉</span>
            <div>
              <p className="font-medium text-sm">New insight unlocked!</p>
              <p className="text-xs opacity-90">{unlockCelebration.message}</p>
            </div>
            <button
              onClick={() => setUnlockCelebration(null)}
              className="ml-2 text-white/80 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-6 py-8 space-y-6">

        {/* Header with Remaining Summary */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              {getGreeting()}, {userName}
            </h1>
            <p className="text-base text-muted-foreground mt-1">Let's find your path today</p>
          </div>

          {/* Remaining Summary Pill */}
          {!macros ? (
            <div className="bg-muted/50 rounded-full px-5 py-2.5 flex items-center gap-4 animate-pulse">
              <div className="h-5 w-16 bg-muted rounded" />
              <div className="w-px h-5 bg-border" />
              <div className="h-5 w-20 bg-muted rounded" />
            </div>
          ) : macros.remaining.calories > 0 ? (
            <div className="bg-primary/10 rounded-full px-5 py-2.5 flex items-center gap-4 text-base">
              <div className="flex items-center gap-2">
                <span className="text-primary font-semibold text-lg">{macros.remaining.calories}</span>
                <span className="text-muted-foreground">cal</span>
              </div>
              <div className="w-px h-5 bg-border" />
              <div className="flex items-center gap-2">
                <span className="text-primary font-semibold text-lg">{macros.remaining.protein}g</span>
                <span className="text-muted-foreground">protein</span>
              </div>
              <span className="text-muted-foreground">left</span>
            </div>
          ) : null}
        </div>

        {/* Pathway + Suggestions Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Pathway - Your Path Today */}
          <PathwayVisualization dailyData={getDailyMealPath()} insights={insights || undefined} />

          {/* AI Meal Suggestions */}
          <div className="bg-card rounded-2xl p-6 border border-border/50 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${mealSource === 'home' ? 'bg-green-500/10' : 'bg-purple-500/10'}`}>
                {mealSource === 'home' ? (
                  <Home className="h-4 w-4 text-green-500" />
                ) : (
                  <Sparkles className="h-4 w-4 text-purple-500" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-medium text-foreground">
                    {mealSource === 'home'
                      ? 'From Your Pantry'
                      : hasPersonalizedSuggestions
                        ? 'Suggested for You'
                        : `Suggested for ${suggestionMealTime.charAt(0).toUpperCase() + suggestionMealTime.slice(1)}`}
                  </h2>
                  {mealSource === 'home' && pantryCount > 0 && (
                    <span className="text-[10px] font-medium text-green-600 bg-green-500/10 px-1.5 py-0.5 rounded-full">
                      {pantryCount} items
                    </span>
                  )}
                  {mealSource === 'restaurant' && hasPersonalizedSuggestions && (
                    <span className="text-[10px] font-medium text-purple-600 bg-purple-500/10 px-1.5 py-0.5 rounded-full">
                      Personalized
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {mealSource === 'home'
                    ? 'Meals you can make at home'
                    : patternProgress.daysLogged >= 7
                      ? 'Based on your eating patterns'
                      : patternProgress.daysLogged > 0
                        ? `Learning your patterns... ${patternProgress.daysLogged}/7 days`
                        : 'Real meals from nearby restaurants'}
                </p>
              </div>
            </div>
            <button
              onClick={handleRefreshSuggestions}
              disabled={loadingSuggestions}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${loadingSuggestions ? 'animate-spin' : ''}`} />
              {loadingSuggestions ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            {/* Meal Source Toggle */}
            <div className="flex gap-1 bg-muted/30 rounded-lg p-1">
              <button
                onClick={() => handleMealSourceChange('restaurant')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  mealSource === 'restaurant'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Utensils className="h-3 w-3" />
                Restaurant
              </button>
              <button
                onClick={() => handleMealSourceChange('home')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  mealSource === 'home'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Home className="h-3 w-3" />
                Home
              </button>
            </div>

            {/* Restaurant-specific filters */}
            {mealSource === 'restaurant' && (
              <>
                {/* Dining Mode */}
                <div className="flex gap-1 bg-muted/30 rounded-lg p-1">
                  {([
                    { value: 'takeout', label: 'Takeout' },
                    { value: 'dine-in', label: 'Dine-in' }
                  ] as const).map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleDiningModeChange(option.value)}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                        diningMode === option.value
                          ? 'bg-card text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                {/* Travel Mode */}
                <div className="flex gap-1 bg-muted/30 rounded-lg p-1">
                  <button
                    onClick={() => handleTravelModeChange('walk')}
                    className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                      travelMode === 'walk'
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Footprints className="h-3 w-3" />
                    Walk
                  </button>
                  <button
                    onClick={() => handleTravelModeChange('drive')}
                    className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                      travelMode === 'drive'
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Car className="h-3 w-3" />
                    Drive
                  </button>
                </div>
              </>
            )}

            {/* Meal Size Selector */}
            <div className="flex items-center gap-2">
              <div className="flex gap-1 bg-muted/30 rounded-lg p-1">
                {([
                  { value: 'light', label: 'Light' },
                  { value: 'regular', label: 'Regular' },
                  { value: 'hearty', label: 'Hearty' }
                ] as const).map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleMealSizeChange(option.value)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                      mealSize === option.value
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loadingSuggestions ? (
            <div className="flex-1 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-3 rounded-xl border border-border/50 bg-muted/10 animate-pulse">
                  <div className="h-4 w-1/3 bg-muted rounded mb-2" />
                  <div className="h-3 w-2/3 bg-muted rounded mb-2" />
                  <div className="flex gap-2">
                    <div className="h-5 w-14 bg-muted rounded-full" />
                    <div className="h-5 w-14 bg-muted rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : mealSource === 'home' ? (
            // Home meals content
            <div className="flex-1 space-y-4 overflow-y-auto">
              {/* Empty pantry state */}
              {homeMeals.length === 0 && readyToEat.length === 0 && (
                <div className="flex flex-col items-center justify-center text-center py-8">
                  <div className="h-12 w-12 rounded-full bg-muted/30 flex items-center justify-center mb-3">
                    <Home className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground mb-1">
                    {homeMessage || 'Your pantry is empty'}
                  </p>
                  <p className="text-xs text-muted-foreground mb-3">
                    Add items to get meal suggestions
                  </p>
                  <Link
                    href="/pantry"
                    className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                  >
                    Go to Pantry →
                  </Link>
                </div>
              )}

              {/* Ready to Eat Items - with flip cards */}
              {readyToEat.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Ready to Eat
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {readyToEat.slice(0, 4).map((item, index) => {
                      const isFlipped = flippedCardIndex === 200 + index
                      return (
                        <div
                          key={index}
                          className="relative h-28 cursor-pointer [perspective:1000px]"
                          onClick={() => setFlippedCardIndex(isFlipped ? null : 200 + index)}
                        >
                          <div className={`relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d] ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}>
                            {/* Front */}
                            <div className="absolute inset-0 bg-card rounded-xl p-3 border border-border/50 hover:border-green-500/30 [backface-visibility:hidden]">
                              <p className="text-sm font-medium text-foreground line-clamp-1">{item.name}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {item.portion}
                              </p>
                              <div className="flex gap-1.5 mt-2">
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                                  {item.calories} cal
                                </span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600 font-medium">
                                  {item.protein}g pro
                                </span>
                              </div>
                              <p className="text-[9px] text-muted-foreground mt-1.5">Tap to log</p>
                            </div>

                            {/* Back */}
                            <div className="absolute inset-0 bg-card rounded-xl p-3 border border-green-500/30 [backface-visibility:hidden] [transform:rotateY(180deg)] flex flex-col justify-between">
                              <div>
                                <p className="text-sm font-medium text-foreground line-clamp-1">{item.name}</p>
                                <p className="text-xs text-muted-foreground">{item.portion}</p>
                              </div>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation()
                                  if (!user?.id) return
                                  const hour = new Date().getHours()
                                  const mealType = hour < 11 ? 'breakfast' : hour < 16 ? 'lunch' : 'snack'
                                  try {
                                    const response = await fetch('/api/log-meal-direct', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        userId: user.id,
                                        name: item.name,
                                        calories: item.calories,
                                        protein: item.protein,
                                        carbs: 0,
                                        fat: 0,
                                        servings: 1,
                                        mealType
                                      })
                                    })
                                    if (response.ok) {
                                      setFlippedCardIndex(null)
                                      await loadDashboardData(user.id)
                                      loadInsights(user.id)
                                    }
                                  } catch (error) {
                                    console.error('Failed to log:', error)
                                  }
                                }}
                                className="w-full py-2 rounded-lg bg-green-600 text-white text-xs font-medium hover:opacity-90 transition-opacity"
                              >
                                Log Snack
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Home Cooked Meals - with flip cards */}
              {homeMeals.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Recipes You Can Make
                  </p>
                  <div className="space-y-3">
                    {homeMeals.slice(0, 3).map((meal, index) => {
                      const isFlipped = flippedCardIndex === 100 + index
                      return (
                        <div
                          key={index}
                          className="relative h-40 cursor-pointer [perspective:1000px]"
                          onClick={() => setFlippedCardIndex(isFlipped ? null : 100 + index)}
                        >
                          <div className={`relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d] ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}>
                            {/* Front of card */}
                            <div className="absolute inset-0 p-4 rounded-xl border border-border/50 bg-muted/10 hover:border-green-500/30 hover:bg-muted/20 transition-all [backface-visibility:hidden]">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs font-semibold text-green-600 bg-green-500/10 px-2 py-1 rounded-md">
                                  {meal.prepTime}
                                </span>
                              </div>
                              <h3 className="font-medium text-foreground text-sm line-clamp-2 mb-2">
                                {meal.name}
                              </h3>
                              <div className="flex flex-wrap gap-2">
                                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                                  {meal.calories} cal
                                </span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 font-medium">
                                  {meal.protein}g protein
                                </span>
                              </div>
                              <p className="text-[9px] text-muted-foreground mt-2">Tap for details</p>
                            </div>

                            {/* Back of card */}
                            <div className="absolute inset-0 p-4 rounded-xl border border-green-500/30 bg-card [backface-visibility:hidden] [transform:rotateY(180deg)] flex flex-col">
                              <div className="flex-1">
                                {/* Macros grid */}
                                <div className="grid grid-cols-4 gap-1.5 mb-2">
                                  <div className="text-center p-1 rounded-lg bg-muted/30">
                                    <p className="text-[10px] font-semibold text-foreground">{meal.calories}</p>
                                    <p className="text-[8px] text-muted-foreground">cal</p>
                                  </div>
                                  <div className="text-center p-1 rounded-lg bg-green-500/10">
                                    <p className="text-[10px] font-semibold text-green-600">{meal.protein}g</p>
                                    <p className="text-[8px] text-muted-foreground">pro</p>
                                  </div>
                                  <div className="text-center p-1 rounded-lg bg-muted/30">
                                    <p className="text-[10px] font-semibold text-foreground">{meal.carbs}g</p>
                                    <p className="text-[8px] text-muted-foreground">carb</p>
                                  </div>
                                  <div className="text-center p-1 rounded-lg bg-muted/30">
                                    <p className="text-[10px] font-semibold text-foreground">{meal.fat}g</p>
                                    <p className="text-[8px] text-muted-foreground">fat</p>
                                  </div>
                                </div>
                                <p className="text-[10px] text-muted-foreground line-clamp-2">{meal.description}</p>
                              </div>

                              {/* Actions */}
                              <div className="flex gap-2 mt-2">
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation()
                                    if (!user?.id) return
                                    const hour = new Date().getHours()
                                    const mealType = hour < 11 ? 'breakfast' : hour < 16 ? 'lunch' : 'dinner'
                                    try {
                                      const response = await fetch('/api/log-meal-direct', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                          userId: user.id,
                                          name: meal.name,
                                          calories: meal.calories,
                                          protein: meal.protein,
                                          carbs: meal.carbs,
                                          fat: meal.fat,
                                          servings: 1,
                                          mealType
                                        })
                                      })
                                      if (response.ok) {
                                        setFlippedCardIndex(null)
                                        await loadDashboardData(user.id)
                                        loadInsights(user.id)
                                        loadHomeMeals(user.id)
                                      }
                                    } catch (error) {
                                      console.error('Failed to log meal:', error)
                                    }
                                  }}
                                  className="flex-1 py-2 rounded-lg bg-green-600 text-white text-xs font-medium hover:opacity-90 transition-opacity"
                                >
                                  Log Meal
                                </button>
                                <a
                                  href={`https://www.google.com/search?q=${encodeURIComponent(meal.name + ' recipe')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="px-3 py-2 rounded-lg border border-border hover:bg-muted/50 transition-colors flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                                >
                                  <ExternalLink className="h-3 w-3" />
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

              {/* Link to pantry */}
              {(homeMeals.length > 0 || readyToEat.length > 0) && (
                <Link
                  href="/pantry"
                  className="flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
                >
                  Manage pantry <ChevronRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          ) : goalAchieved ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
              <div className="h-14 w-14 rounded-full bg-emerald-500/20 flex items-center justify-center mb-3">
                <Check className="h-7 w-7 text-emerald-500" />
              </div>
              <p className="text-base font-semibold text-foreground mb-1">You did it!</p>
              <p className="text-sm text-muted-foreground">
                {suggestionMessage || "You hit your targets today. Great job!"}
              </p>
            </div>
          ) : isNearGoal ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
              <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
                <Check className="h-6 w-6 text-emerald-500" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">Almost there!</p>
              <p className="text-sm text-muted-foreground">
                {suggestionMessage || "You're close to your daily goals."}
              </p>
              {suggestions.length > 0 && (
                <div className="mt-4 w-full">
                  <p className="text-xs text-muted-foreground mb-2">Light options if you're still hungry:</p>
                  {suggestions.slice(0, 2).map((suggestion, index) => (
                    <div
                      key={index}
                      className="p-3 rounded-lg border border-border/50 bg-muted/10 hover:border-primary/30 transition-all cursor-pointer mb-2"
                      onClick={() => {
                        setPendingMeal({
                          name: suggestion.name,
                          calories: suggestion.calories,
                          protein: suggestion.protein,
                          carbs: suggestion.carbs,
                          fat: suggestion.fat,
                          servings: 1
                        })
                        setShowChatInput(false)
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-foreground truncate">{suggestion.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">{suggestion.calories} cal</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : suggestions.length > 0 ? (
            <div className="flex-1 space-y-3">
              {suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className={`flip-card ${flippedCardIndex === index ? 'flipped' : ''}`}
                >
                  <div className="flip-card-inner relative">
                    {/* Front of card */}
                    <div
                      className="flip-card-front p-4 rounded-xl border border-border/50 bg-muted/10 hover:border-primary/30 hover:bg-muted/20 transition-all cursor-pointer group"
                      onClick={() => setFlippedCardIndex(index)}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-1 rounded-md uppercase tracking-wide">
                          {suggestion.restaurant}
                        </span>
                        {suggestion.estimatedPrice && (
                          <span className="text-xs font-semibold text-emerald-600 bg-emerald-500/10 px-2 py-1 rounded-md">
                            ~${suggestion.estimatedPrice.toFixed(0)}
                          </span>
                        )}
                        {suggestion.distance && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {suggestion.distance} mi
                          </span>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-auto" />
                      </div>
                      <h3 className="font-medium text-foreground text-sm group-hover:text-primary transition-colors line-clamp-2 mb-2">
                        {suggestion.name}
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {suggestion.calories} cal
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                          {suggestion.protein}g protein
                        </span>
                      </div>
                      {suggestion.personalizedReason && (
                        <p className="text-[10px] text-purple-600 mt-2 flex items-center gap-1">
                          <Sparkles className="h-3 w-3" />
                          {suggestion.personalizedReason}
                        </p>
                      )}
                    </div>

                    {/* Back of card - click anywhere to flip back */}
                    <div
                      className="flip-card-back p-4 rounded-xl border border-primary/30 bg-card flex flex-col justify-center cursor-pointer"
                      onClick={() => setFlippedCardIndex(null)}
                    >
                      {/* Full macros grid */}
                      <div className="grid grid-cols-4 gap-2 mb-3">
                        <div className="text-center p-2 rounded-lg bg-muted/30">
                          <p className="text-sm font-semibold text-foreground">{suggestion.calories}</p>
                          <p className="text-[10px] text-muted-foreground">cal</p>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-primary/10">
                          <p className="text-sm font-semibold text-primary">{suggestion.protein}g</p>
                          <p className="text-[10px] text-muted-foreground">protein</p>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-muted/30">
                          <p className="text-sm font-semibold text-foreground">{suggestion.carbs}g</p>
                          <p className="text-[10px] text-muted-foreground">carbs</p>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-muted/30">
                          <p className="text-sm font-semibold text-foreground">{suggestion.fat}g</p>
                          <p className="text-[10px] text-muted-foreground">fat</p>
                        </div>
                      </div>

                      {/* Log button */}
                      <button
                        onClick={async (e) => {
                          e.stopPropagation()
                          if (!user?.id) return

                          const hour = new Date().getHours()
                          const mealType = hour < 11 ? 'breakfast' : hour < 16 ? 'lunch' : 'dinner'

                          try {
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
                              setFlippedCardIndex(null)
                              await loadDashboardData(user.id)
                              loadInsights(user.id)
                              loadSuggestions(user.id, userLocation, mealSize, diningMode, travelMode)
                            }
                          } catch (error) {
                            console.error('Failed to log meal:', error)
                          }
                        }}
                        className="w-full px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
                      >
                        Log Meal
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No suggestions available right now
            </p>
          )}
          </div>
        </div>

        {/* Pattern Insight Card */}
        {patternInsight && (
          <div className="bg-purple-500/5 rounded-2xl p-5 border border-purple-500/10 hover:border-purple-500/20 transition-all">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                <Sparkles className="h-4 w-4 text-purple-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{patternInsight.headline}</p>
                <p className="text-sm text-muted-foreground mt-1">{patternInsight.body}</p>
              </div>
            </div>
          </div>
        )}

        {/* Side by Side: Today's Total + Meals Logged */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Today's Total */}
          <div className="bg-card rounded-2xl p-6 border border-border/50 flex flex-col h-full">
            <p className="text-base font-medium text-muted-foreground mb-5">Today's Total</p>
            {!macros ? (
              // Skeleton loading state
              <div className="grid grid-cols-2 gap-4 flex-1">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex flex-col items-center p-4 rounded-xl border border-border/50 bg-muted/20 animate-pulse">
                    <div className="w-20 h-20 rounded-full bg-muted" />
                    <div className="h-4 w-12 bg-muted rounded mt-2" />
                    <div className="h-3 w-16 bg-muted rounded mt-1" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 flex-1">
                {/* Calories */}
                <div className="flex flex-col items-center p-4 rounded-xl border border-border/50 bg-muted/20">
                  <div className="relative w-20 h-20">
                    <svg className="w-20 h-20 -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted" />
                      <circle
                        cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8"
                        className="text-primary transition-all duration-500"
                        strokeLinecap="round"
                        strokeDasharray={`${Math.min(100, (macros.current.calories / macros.targets.calories) * 100) * 2.64} 264`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-base font-semibold text-foreground">{Math.round((macros.current.calories / macros.targets.calories) * 100)}%</span>
                    </div>
                  </div>
                  <p className="text-base font-medium text-foreground mt-2">{macros.current.calories}</p>
                  <p className="text-sm text-muted-foreground">of {macros.targets.calories} cal</p>
                </div>

                {/* Protein */}
                <div className="flex flex-col items-center p-4 rounded-xl border border-border/50 bg-muted/20">
                  <div className="relative w-20 h-20">
                    <svg className="w-20 h-20 -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted" />
                      <circle
                        cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8"
                        className="text-primary transition-all duration-500"
                        strokeLinecap="round"
                        strokeDasharray={`${Math.min(100, (macros.current.protein / macros.targets.protein) * 100) * 2.64} 264`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-base font-semibold text-foreground">{Math.round((macros.current.protein / macros.targets.protein) * 100)}%</span>
                    </div>
                  </div>
                  <p className="text-base font-medium text-foreground mt-2">{macros.current.protein}g</p>
                  <p className="text-sm text-muted-foreground">of {macros.targets.protein}g pro</p>
                </div>

                {/* Carbs */}
                <div className="flex flex-col items-center p-4 rounded-xl border border-border/50 bg-muted/20">
                  <div className="relative w-20 h-20">
                    <svg className="w-20 h-20 -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted" />
                      <circle
                        cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8"
                        className="text-primary/60 transition-all duration-500"
                        strokeLinecap="round"
                        strokeDasharray={`${Math.min(100, (macros.current.carbs / macros.targets.carbs) * 100) * 2.64} 264`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-base font-semibold text-foreground">{Math.round((macros.current.carbs / macros.targets.carbs) * 100)}%</span>
                    </div>
                  </div>
                  <p className="text-base font-medium text-foreground mt-2">{macros.current.carbs}g</p>
                  <p className="text-sm text-muted-foreground">of {macros.targets.carbs}g carbs</p>
                </div>

                {/* Fat */}
                <div className="flex flex-col items-center p-4 rounded-xl border border-border/50 bg-muted/20">
                  <div className="relative w-20 h-20">
                    <svg className="w-20 h-20 -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted" />
                      <circle
                        cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8"
                        className="text-primary/40 transition-all duration-500"
                        strokeLinecap="round"
                        strokeDasharray={`${Math.min(100, (macros.current.fat / macros.targets.fat) * 100) * 2.64} 264`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-base font-semibold text-foreground">{Math.round((macros.current.fat / macros.targets.fat) * 100)}%</span>
                    </div>
                  </div>
                  <p className="text-base font-medium text-foreground mt-2">{macros.current.fat}g</p>
                  <p className="text-sm text-muted-foreground">of {macros.targets.fat}g fat</p>
                </div>
              </div>
            )}
          </div>

          {/* Meals Logged */}
          <div className="bg-card rounded-2xl p-6 border border-border/50 flex flex-col">
            {/* Add Meal Button - Always visible at top */}
            {!showChatInput && !pendingMeal && (
              <button
                onClick={() => setShowChatInput(true)}
                className="w-full mb-4 flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 transition-all group"
              >
                <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center group-hover:bg-primary/30 transition-colors">
                  <Plus className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="text-sm font-medium text-primary">Add a meal</span>
              </button>
            )}

            {/* Inline Chat Input */}
            {showChatInput && !pendingMeal && (
              <div className="mb-4 pb-4 border-b border-border/50">
                <form onSubmit={handleChatSubmit}>
                  <div className="flex items-center gap-2 rounded-lg bg-muted/50 border border-border px-3 py-1.5 focus-within:border-primary/50 transition-colors">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="I had a chicken salad..."
                      className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={!chatInput.trim() || isProcessing}
                      className={`rounded-md p-1.5 transition-all ${
                        chatInput.trim() && !isProcessing
                          ? 'bg-primary text-primary-foreground hover:opacity-90'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {isProcessing ? (
                        <div className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowChatInput(false)
                        setChatInput('')
                      }}
                      className="rounded-md p-1.5 bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Pending Meal Confirmation */}
            {pendingMeal && (
              <div className="mb-4 pb-4 border-b border-border/50">
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="font-medium text-foreground text-sm">{pendingMeal.name}</p>
                  <div className="flex gap-2 mt-1.5 text-xs text-muted-foreground">
                    <span>{pendingMeal.calories} cal</span>
                    <span>{pendingMeal.protein}g pro</span>
                    <span>{pendingMeal.carbs}g carbs</span>
                    <span>{pendingMeal.fat}g fat</span>
                  </div>

                  {/* Meal type selector */}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => setSelectedMealType(type)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all capitalize ${
                          selectedMealType === type
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={confirmMeal}
                      disabled={isLogging}
                      className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
                    >
                      {isLogging ? (
                        <div className="h-3 w-3 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Check className="h-3 w-3" />
                      )}
                      Log
                    </button>
                    <button
                      onClick={cancelMeal}
                      disabled={isLogging}
                      className="px-2.5 py-1.5 rounded-md bg-muted text-muted-foreground text-xs hover:bg-muted/80 transition-colors disabled:opacity-50"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Meals Logged Header */}
            <p className="text-base font-medium text-muted-foreground mb-4">Meals Logged</p>

            {(() => {
              const mealsByType = getMealsByType()
              const MAX_VISIBLE = 2

              return (
                <div className="space-y-4 flex-1">
                  {/* Breakfast */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-foreground uppercase tracking-wider">Breakfast</p>
                      {mealsByType.breakfast.length > 0 && (
                        <span className="text-sm text-primary font-medium">{mealsByType.breakfast.length}</span>
                      )}
                    </div>
                    {mealsByType.breakfast.length > 0 ? (
                      <div className="space-y-2">
                        {mealsByType.breakfast.slice(0, MAX_VISIBLE).map((meal) => (
                          <div key={meal.id} className="flex items-center justify-between py-2.5 px-3 bg-muted/30 rounded-lg group">
                            <p className="text-sm text-foreground truncate flex-1">{meal.name}</p>
                            <div className="flex items-center gap-2 text-sm ml-2">
                              <span className="text-muted-foreground">{meal.calories}</span>
                              <span className="text-primary font-medium">{meal.protein}g</span>
                              <button
                                onClick={() => deleteMeal(meal.id)}
                                disabled={deletingMealId === meal.id}
                                className="ml-1 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all disabled:opacity-50"
                              >
                                {deletingMealId === meal.id ? (
                                  <div className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        ))}
                        {mealsByType.breakfast.length > MAX_VISIBLE && (
                          <Link href="/meals" className="text-sm text-primary hover:text-primary/80 transition-colors">
                            +{mealsByType.breakfast.length - MAX_VISIBLE} more
                          </Link>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground/40 py-1">No meals logged</p>
                    )}
                  </div>

                  <div className="border-t border-border/30" />

                  {/* Lunch */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-foreground uppercase tracking-wider">Lunch</p>
                      {mealsByType.lunch.length > 0 && (
                        <span className="text-sm text-primary font-medium">{mealsByType.lunch.length}</span>
                      )}
                    </div>
                    {mealsByType.lunch.length > 0 ? (
                      <div className="space-y-2">
                        {mealsByType.lunch.slice(0, MAX_VISIBLE).map((meal) => (
                          <div key={meal.id} className="flex items-center justify-between py-2.5 px-3 bg-muted/30 rounded-lg group">
                            <p className="text-sm text-foreground truncate flex-1">{meal.name}</p>
                            <div className="flex items-center gap-2 text-sm ml-2">
                              <span className="text-muted-foreground">{meal.calories}</span>
                              <span className="text-primary font-medium">{meal.protein}g</span>
                              <button
                                onClick={() => deleteMeal(meal.id)}
                                disabled={deletingMealId === meal.id}
                                className="ml-1 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all disabled:opacity-50"
                              >
                                {deletingMealId === meal.id ? (
                                  <div className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        ))}
                        {mealsByType.lunch.length > MAX_VISIBLE && (
                          <Link href="/meals" className="text-sm text-primary hover:text-primary/80 transition-colors">
                            +{mealsByType.lunch.length - MAX_VISIBLE} more
                          </Link>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground/40 py-1">No meals logged</p>
                    )}
                  </div>

                  <div className="border-t border-border/30" />

                  {/* Dinner */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-foreground uppercase tracking-wider">Dinner</p>
                      {mealsByType.dinner.length > 0 && (
                        <span className="text-sm text-primary font-medium">{mealsByType.dinner.length}</span>
                      )}
                    </div>
                    {mealsByType.dinner.length > 0 ? (
                      <div className="space-y-2">
                        {mealsByType.dinner.slice(0, MAX_VISIBLE).map((meal) => (
                          <div key={meal.id} className="flex items-center justify-between py-2.5 px-3 bg-muted/30 rounded-lg group">
                            <p className="text-sm text-foreground truncate flex-1">{meal.name}</p>
                            <div className="flex items-center gap-2 text-sm ml-2">
                              <span className="text-muted-foreground">{meal.calories}</span>
                              <span className="text-primary font-medium">{meal.protein}g</span>
                              <button
                                onClick={() => deleteMeal(meal.id)}
                                disabled={deletingMealId === meal.id}
                                className="ml-1 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all disabled:opacity-50"
                              >
                                {deletingMealId === meal.id ? (
                                  <div className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        ))}
                        {mealsByType.dinner.length > MAX_VISIBLE && (
                          <Link href="/meals" className="text-sm text-primary hover:text-primary/80 transition-colors">
                            +{mealsByType.dinner.length - MAX_VISIBLE} more
                          </Link>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground/40 py-1">No meals logged</p>
                    )}
                  </div>
                </div>
              )
            })()}
          </div>
        </div>

        {/* Chat Widget */}
        <ChatWidget
          userId={user?.id || ''}
          userName={user?.firstName || undefined}
          onMealLogged={() => {
            if (user?.id) {
              loadDashboardData(user.id)
              loadInsights(user.id)
            }
          }}
        />

        {/* Quick Actions - Bottom */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/restaurants"
            className="bg-card rounded-xl p-4 border border-border/50 hover:border-primary/30 transition-all hover:shadow-sm group"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Utensils className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Find food nearby</p>
                <p className="text-sm text-muted-foreground">Restaurant suggestions</p>
              </div>
            </div>
          </Link>

          <Link
            href="/my-path"
            className="bg-card rounded-xl p-4 border border-border/50 hover:border-primary/30 transition-all hover:shadow-sm group"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Your progress</p>
                <p className="text-sm text-muted-foreground">View weekly trends</p>
              </div>
            </div>
          </Link>
        </div>

      </main>
    </div>
  )
}
