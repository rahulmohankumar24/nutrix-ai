'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { MacroProgress } from '@/lib/types'
import { PathwayVisualization } from '@/components/pathway-visualization'
import Link from 'next/link'
import { Utensils, MessageCircle, TrendingUp, Plus, Minus, Send, Check, X, Trash2, Sparkles, ChevronRight, MapPin, DollarSign, Home, ExternalLink, RefreshCw, Car, Footprints, GripVertical, Shield, ArrowUpRight, Target } from 'lucide-react'
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
  score?: number
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
  const [scheduledMealTime, setScheduledMealTime] = useState<'now' | 'breakfast' | 'lunch' | 'dinner'>('now')
  const [suggestionMessage, setSuggestionMessage] = useState<string | null>(null)
  const [isNearGoal, setIsNearGoal] = useState(false)
  const [goalAchieved, setGoalAchieved] = useState(false)
  const [isFinalResortMode, setIsFinalResortMode] = useState(false)
  const [flippedCardIndex, setFlippedCardIndex] = useState<number | null>(null)
  const [patternInsight, setPatternInsight] = useState<PatternInsight | null>(null)
  const [patternProgress, setPatternProgress] = useState<{ daysLogged: number; hasPatterns: boolean }>({ daysLogged: 0, hasPatterns: false })
  const [hasPersonalizedSuggestions, setHasPersonalizedSuggestions] = useState(false)
  const [unlockCelebration, setUnlockCelebration] = useState<{ show: boolean; message: string } | null>(null)
  const [isPro, setIsPro] = useState(false)
  const [todayHealth, setTodayHealth] = useState<{
    grade: 'A' | 'B' | 'C' | 'D' | 'F'
    score: number
    mealsAnalyzed: number
    allMealsCount: number
    summary: string | null
    hasFruits: boolean
    hasVeggies: boolean
    hasFiber: boolean
    hasProtein: boolean
    hasProbiotics: boolean
  } | null>(null)


  // Home meals state
  const [mealSource, setMealSource] = useState<'restaurant' | 'home'>('restaurant')
  const [homeMeals, setHomeMeals] = useState<HomeMealSuggestion[]>([])
  const [readyToEat, setReadyToEat] = useState<ReadyToEatItem[]>([])
  const [homeMessage, setHomeMessage] = useState<string | null>(null)
  const [pantryCount, setPantryCount] = useState(0)

  // Inline chat state
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
          loadDashboardData(user.id),
          loadProStatus(user.id)
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
          loadSuggestions(userId, loc, 'regular', 'takeout', 'drive', 'now', false, mealCount)
        },
        () => {
          // Location denied, load suggestions without location
          loadSuggestions(userId, null, 'regular', 'takeout', 'drive', 'now', false, mealCount)
        },
        { timeout: 5000 }
      )
    } else {
      loadSuggestions(userId, null, 'regular', 'takeout', 'drive', 'now', false, mealCount)
    }
  }

  const loadSuggestions = async (
    userId: string,
    location: { lat: number; lng: number } | null,
    size: 'light' | 'regular' | 'hearty' = 'regular',
    dining: 'takeout' | 'dine-in' = 'takeout',
    travel: 'walk' | 'drive' = 'drive',
    scheduledTime: 'now' | 'breakfast' | 'lunch' | 'dinner' = 'now',
    forceRefresh: boolean = false,
    knownMealCount?: number,
    finalResort: boolean = false
  ) => {
    // Round location to avoid cache misses from tiny GPS changes
    const roundedLoc = location ? {
      lat: Math.round(location.lat * 100) / 100,
      lng: Math.round(location.lng * 100) / 100
    } : null

    const cacheKey = getCacheKey('suggestions', userId, { size, dining, travel, loc: roundedLoc, finalResort })
    const currentMealCount = knownMealCount ?? mealLogs?.count ?? 0

    // Check cache first (unless force refresh or final resort)
    if (!forceRefresh && !finalResort) {
      const cached = getCache<any>(cacheKey)
      if (cached && cached._cachedMealCount === currentMealCount) {
        setSuggestions(cached.suggestions || [])
        setSuggestionMealTime(cached.mealTime || 'lunch')
        setSuggestionMessage(cached.message || null)
        setIsNearGoal(cached.isNearGoal || false)
        setGoalAchieved(cached.goalAchieved || false)
        setHasPersonalizedSuggestions(cached.hasPersonalizedData || false)
        setIsFinalResortMode(cached.isFinalResortMode || false)
        setLoadingSuggestions(false)
        return
      }
    }

    setLoadingSuggestions(true)
    try {
      const tz = encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)
      // Use scheduled time if set, otherwise use current time
      let hour: number
      if (scheduledTime === 'now') {
        hour = new Date().getHours()
      } else {
        // Simulate hours for scheduled meals
        hour = scheduledTime === 'breakfast' ? 8 : scheduledTime === 'lunch' ? 12 : 18
      }
      let url = `/api/meal-suggestions?userId=${userId}&size=${size}&dining=${dining}&travel=${travel}&timezone=${tz}&currentHour=${hour}`
      if (location) {
        url += `&lat=${location.lat}&lng=${location.lng}`
      }
      // Pass scheduled meal time to API
      if (scheduledTime !== 'now') {
        url += `&scheduledMeal=${scheduledTime}`
      }
      // Add final resort mode
      if (finalResort) {
        url += '&finalResort=true'
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
        setIsFinalResortMode(data.isFinalResortMode || false)
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
      loadSuggestions(user.id, userLocation, size, diningMode, travelMode, scheduledMealTime, true)
    }
  }

  const handleDiningModeChange = (mode: 'takeout' | 'dine-in') => {
    setDiningMode(mode)
    if (user?.id) {
      // Force refresh when user changes settings
      loadSuggestions(user.id, userLocation, mealSize, mode, travelMode, scheduledMealTime, true)
    }
  }

  const handleTravelModeChange = (mode: 'walk' | 'drive') => {
    setTravelMode(mode)
    if (user?.id) {
      // Force refresh when user changes settings
      loadSuggestions(user.id, userLocation, mealSize, diningMode, mode, scheduledMealTime, true)
    }
  }

  const handleScheduledMealTimeChange = (time: 'now' | 'breakfast' | 'lunch' | 'dinner') => {
    setScheduledMealTime(time)
    if (user?.id) {
      // Force refresh when user changes scheduled time
      loadSuggestions(user.id, userLocation, mealSize, diningMode, travelMode, time, true)
    }
  }

  // Get current meal label based on time
  const getCurrentMealLabel = () => {
    const hour = new Date().getHours()
    if (hour < 11) return 'Breakfast'
    if (hour < 16) return 'Lunch'
    return 'Dinner'
  }

  const handleMealSourceChange = (source: 'restaurant' | 'home') => {
    setMealSource(source)
    if (source === 'home' && user?.id) {
      loadHomeMeals(user.id)
    } else if (source === 'restaurant' && user?.id) {
      loadSuggestions(user.id, userLocation, mealSize, diningMode, travelMode, scheduledMealTime, true)
    }
  }

  const handleRefreshSuggestions = () => {
    if (!user?.id) return
    setIsFinalResortMode(false) // Reset final resort mode on refresh
    if (mealSource === 'home') {
      loadHomeMeals(user.id, true)
    } else {
      loadSuggestions(user.id, userLocation, mealSize, diningMode, travelMode, scheduledMealTime, true)
    }
    loadInsights(user.id, true)
  }

  const handleFinalResort = () => {
    if (!user?.id) return
    loadSuggestions(user.id, userLocation, mealSize, diningMode, travelMode, scheduledMealTime, true, undefined, true)
  }

  const handleExitFinalResort = () => {
    if (!user?.id) return
    setIsFinalResortMode(false)
    loadSuggestions(user.id, userLocation, mealSize, diningMode, travelMode, scheduledMealTime, true)
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
      const tz = encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)
      const hour = new Date().getHours()
      const response = await fetch(`/api/daily-insights?userId=${userId}&timezone=${tz}&currentHour=${hour}`)
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

  const loadProStatus = async (userId: string) => {
    try {
      const response = await fetch(`/api/profile?userId=${userId}`)
      if (response.ok) {
        const data = await response.json()
        const pro = data.profile?.isPro === true
        setIsPro(pro)

        // If Pro, fetch today's health analysis
        if (pro) {
          try {
            const tz = encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)
            const healthResponse = await fetch(`/api/health-analysis?userId=${userId}&today=true&timezone=${tz}`)
            if (healthResponse.ok) {
              const healthData = await healthResponse.json()
              if (healthData.allMealsCount > 0 || healthData.mealsAnalyzed > 0) {
                // Check for protein in insights
                const hasProtein = healthData.nutritionInsights?.some(
                  (i: { title: string }) => i.title.toLowerCase().includes('protein')
                ) || false

                setTodayHealth({
                  grade: healthData.grade,
                  score: healthData.overallScore,
                  mealsAnalyzed: healthData.mealsAnalyzed,
                  allMealsCount: healthData.allMealsCount || 0,
                  summary: healthData.dailySummary || null,
                  hasFruits: healthData.hasFruits || false,
                  hasVeggies: healthData.hasVeggies || false,
                  hasFiber: healthData.hasFiber || false,
                  hasProtein,
                  hasProbiotics: healthData.hasProbiotics || false
                })
              }
            }
          } catch (healthError) {
            console.error('Failed to fetch health analysis:', healthError)
            // Silently fail - health analysis is optional
          }
        }
      }
    } catch (error) {
      console.error('Failed to load pro status:', error)
    }
  }

  const loadDashboardData = async (userId: string) => {
    try {
      const [macroResponse, mealLogResponse] = await Promise.all([
        fetch(`/api/macro-progress?userId=${userId}&timezone=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`),
        fetch(`/api/log-meal?userId=${userId}&timezone=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`)
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

    const meals = mealLogs.mealLogs.map(log => {
      const baseCalories = log.orderTemplate?.calories || log.foodCatalogItem?.calories || 0
      const baseProtein = log.orderTemplate?.protein || log.foodCatalogItem?.protein || 0
      return {
        id: log.id,
        name: log.orderTemplate?.title || log.foodCatalogItem?.name || 'Unknown',
        source: log.orderTemplate?.restaurantBrand || log.foodCatalogItem?.source || '',
        baseCalories,
        baseProtein,
        servings: log.servings || 1,
        calories: Math.round(baseCalories * log.servings),
        protein: Math.round(baseProtein * log.servings),
        mealType: log.mealType || 'dinner',
        datetime: log.datetime
      }
    })

    const grouped: { breakfast: typeof meals; lunch: typeof meals; dinner: typeof meals } = {
      breakfast: [],
      lunch: [],
      dinner: []
    }

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
          userId: user.id,
          currentHour: new Date().getHours(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
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

  const [updatingMealId, setUpdatingMealId] = useState<string | null>(null)

  const updateMealServings = async (mealId: string, newServings: number) => {
    if (!user?.id || newServings < 0.5) return

    setUpdatingMealId(mealId)

    try {
      const response = await fetch('/api/log-meal', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mealLogId: mealId,
          userId: user.id,
          servings: newServings
        })
      })

      if (!response.ok) throw new Error('Failed to update meal')

      // Refresh data
      await loadDashboardData(user.id)
    } catch (error) {
      console.error('Failed to update meal:', error)
    } finally {
      setUpdatingMealId(null)
    }
  }

  const updateMealType = async (mealId: string, newMealType: string) => {
    if (!user?.id) return

    setUpdatingMealId(mealId)

    try {
      const response = await fetch('/api/log-meal', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mealLogId: mealId,
          userId: user.id,
          mealType: newMealType
        })
      })

      if (!response.ok) throw new Error('Failed to update meal type')

      // Refresh data
      await loadDashboardData(user.id)
    } catch (error) {
      console.error('Failed to update meal type:', error)
    } finally {
      setUpdatingMealId(null)
    }
  }

  // Drag and drop state
  const [draggedMeal, setDraggedMeal] = useState<{ id: string; mealType: string } | null>(null)
  const [dragOverType, setDragOverType] = useState<string | null>(null)

  const handleDragStart = (e: React.DragEvent, mealId: string, mealType: string) => {
    setDraggedMeal({ id: mealId, mealType })
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, mealType: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverType(mealType)
  }

  const handleDragLeave = () => {
    setDragOverType(null)
  }

  const handleDrop = async (e: React.DragEvent, targetMealType: string) => {
    e.preventDefault()
    setDragOverType(null)

    if (draggedMeal && draggedMeal.mealType !== targetMealType) {
      await updateMealType(draggedMeal.id, targetMealType)
    }

    setDraggedMeal(null)
  }

  const handleDragEnd = () => {
    setDraggedMeal(null)
    setDragOverType(null)
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
          <div className="bg-gradient-to-r from-sky-500 to-blue-500 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-3">
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

        {/* Header with Chat Bar */}
        <div className="space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Greeting + Refresh */}
            <div className="flex items-center gap-4 flex-shrink-0">
              <h1 className="text-2xl font-semibold text-foreground whitespace-nowrap">
                {getGreeting()}, {userName}
              </h1>
              <button
                onClick={handleRefreshSuggestions}
                disabled={loadingSuggestions}
                className="flex items-center gap-2 py-2 px-3 rounded-lg bg-sky-500/10 text-sky-600 text-xs font-medium hover:bg-sky-500/20 transition-all disabled:opacity-50"
              >
                <Sparkles className={`h-3.5 w-3.5 ${loadingSuggestions ? 'animate-pulse' : ''}`} />
                {loadingSuggestions ? 'Generating...' : 'Refresh AI'}
              </button>
            </div>

            {/* Chat Bar - Right aligned, above meal suggestions */}
            {!pendingMeal ? (
              <form onSubmit={handleChatSubmit} className="w-full lg:w-[calc(50%-10px)]">
                <div className="flex items-center gap-3 bg-card rounded-2xl border border-border shadow-sm px-4 py-3.5 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
                  <MessageCircle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Log a meal..."
                    className="flex-1 min-w-0 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground/50"
                  />
                  {chatInput.trim() && (
                    <button
                      type="submit"
                      disabled={isProcessing}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {isProcessing ? (
                        <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>
              </form>
            ) : (
              <div className="w-full lg:w-[calc(50%-10px)] bg-card rounded-2xl border border-primary/30 px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground text-sm truncate">{pendingMeal.name}</p>
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      <span>{pendingMeal.calories} cal</span>
                      <span className="text-primary font-medium">{pendingMeal.protein}g pro</span>
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setSelectedMealType(type)}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all capitalize ${
                          selectedMealType === type
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button
                      onClick={confirmMeal}
                      disabled={isLogging}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
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
                      className="p-1 rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 transition-colors disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Pathway + Suggestions Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Pathway - Your Path Today */}
          <PathwayVisualization
            dailyData={getDailyMealPath()}
            insights={insights || undefined}
            totals={macros ? {
              calories: macros.current.calories,
              protein: macros.current.protein,
              targetCalories: macros.targets.calories,
              targetProtein: macros.targets.protein
            } : undefined}
          />

          {/* AI Meal Suggestions */}
          <div className="bg-card rounded-2xl border border-border shadow-sm flex flex-col overflow-hidden">
          {/* AI Header */}
          <div className="bg-gradient-to-r from-sky-100 to-blue-50 px-6 py-5 border-b border-sky-200/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-sky-500/20 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-sky-500" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-foreground">
                      {mealSource === 'home'
                        ? 'AI Pantry Suggestions'
                        : 'AI Meal Picks'}
                    </h2>
                    <span className="text-[10px] font-medium text-sky-600 bg-sky-500/20 px-2 py-0.5 rounded-full">
                      AI-Powered
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {mealSource === 'home'
                      ? 'Personalized recipes from your pantry'
                      : 'Optimized for your macros & goals'}
                  </p>
                </div>
              </div>
              <Link
                href="/ai-picks"
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-sky-600 text-sm font-medium hover:bg-sky-50 border border-sky-200 shadow-sm transition-all"
              >
                See more
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="p-6">

          {/* Filters */}
          <div className="space-y-3 mb-5">
            {/* Primary: Meal Source Toggle */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleMealSourceChange('restaurant')}
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-medium transition-all ${
                  mealSource === 'restaurant'
                    ? 'bg-primary/10 text-primary border-2 border-primary/30'
                    : 'bg-muted/30 text-muted-foreground border-2 border-transparent hover:bg-muted/50'
                }`}
              >
                <Utensils className="h-4 w-4" />
                Restaurant
              </button>
              <button
                onClick={() => handleMealSourceChange('home')}
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-medium transition-all ${
                  mealSource === 'home'
                    ? 'bg-primary/10 text-primary border-2 border-primary/30'
                    : 'bg-muted/30 text-muted-foreground border-2 border-transparent hover:bg-muted/50'
                }`}
              >
                <Home className="h-4 w-4" />
                Home
              </button>
            </div>

            {/* Secondary: Context-specific options */}
            <div className="flex gap-2">
              {/* Meal Size - Always visible */}
              <div className="flex-1 flex bg-muted/20 rounded-xl p-1">
                {([
                  { value: 'light', label: 'Light' },
                  { value: 'regular', label: 'Regular' },
                  { value: 'hearty', label: 'Hearty' }
                ] as const).map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleMealSizeChange(option.value)}
                    className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                      mealSize === option.value
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {/* Restaurant-specific: Travel Mode */}
              {mealSource === 'restaurant' && (
                <div className="flex bg-muted/20 rounded-xl p-1">
                  <button
                    onClick={() => handleTravelModeChange('walk')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                      travelMode === 'walk'
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Footprints className="h-3.5 w-3.5" />
                    Walk
                  </button>
                  <button
                    onClick={() => handleTravelModeChange('drive')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                      travelMode === 'drive'
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Car className="h-3.5 w-3.5" />
                    Drive
                  </button>
                </div>
              )}

            </div>

            {/* Meal Time Scheduler + Hit Targets */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Planning for:</span>
                <div className="flex bg-muted/20 rounded-xl p-1">
                  <button
                    onClick={() => handleScheduledMealTimeChange('now')}
                    className={`py-1.5 px-3 rounded-lg text-xs font-medium transition-all ${
                      scheduledMealTime === 'now'
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Now
                  </button>
                  <button
                    onClick={() => handleScheduledMealTimeChange('breakfast')}
                    className={`py-1.5 px-3 rounded-lg text-xs font-medium transition-all ${
                      scheduledMealTime === 'breakfast'
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Breakfast
                  </button>
                  <button
                    onClick={() => handleScheduledMealTimeChange('lunch')}
                    className={`py-1.5 px-3 rounded-lg text-xs font-medium transition-all ${
                      scheduledMealTime === 'lunch'
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Lunch
                  </button>
                  <button
                    onClick={() => handleScheduledMealTimeChange('dinner')}
                    className={`py-1.5 px-3 rounded-lg text-xs font-medium transition-all ${
                      scheduledMealTime === 'dinner'
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Dinner
                  </button>
                </div>
              </div>

              {/* Hit Targets Button */}
              {mealSource === 'restaurant' && (
                <button
                  onClick={isFinalResortMode ? handleExitFinalResort : handleFinalResort}
                  className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium transition-all ${
                    isFinalResortMode
                      ? 'bg-amber-500 text-white shadow-md'
                      : 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-2 border-amber-500/30 hover:border-amber-500/50'
                  }`}
                >
                  <Target className="h-4 w-4" />
                  {isFinalResortMode ? 'Exit Combos' : 'Hit Targets'}
                </button>
              )}
            </div>
          </div>

          {loadingSuggestions ? (
            <div className="flex-1 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-3 rounded-xl border border-border bg-card animate-pulse">
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
              {homeMeals.filter(m => m.name?.trim()).length === 0 && readyToEat.filter(i => i.name?.trim()).length === 0 && (
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
              {readyToEat.filter(item => item.name && item.name.trim()).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Ready to Eat
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {readyToEat.filter(item => item.name && item.name.trim()).slice(0, 4).map((item, index) => {
                      const isFlipped = flippedCardIndex === 200 + index
                      return (
                        <div
                          key={index}
                          className="relative h-28 cursor-pointer [perspective:1000px]"
                          onClick={() => setFlippedCardIndex(isFlipped ? null : 200 + index)}
                        >
                          <div className={`relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d] ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}>
                            {/* Front */}
                            <div className="absolute inset-0 bg-card rounded-xl p-3 border border-border shadow-sm hover:border-green-500/50 [backface-visibility:hidden]">
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
              {homeMeals.filter(m => m.name?.trim()).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Recipes You Can Make
                  </p>
                  <div className="space-y-3">
                    {homeMeals.filter(m => m.name?.trim()).slice(0, 3).map((meal, index) => {
                      const isFlipped = flippedCardIndex === 100 + index
                      return (
                        <div
                          key={index}
                          className="relative h-40 cursor-pointer [perspective:1000px]"
                          onClick={() => setFlippedCardIndex(isFlipped ? null : 100 + index)}
                        >
                          <div className={`relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d] ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}>
                            {/* Front of card */}
                            <div className="absolute inset-0 p-4 rounded-xl border border-border bg-card shadow-sm hover:border-green-500/50 hover:shadow-md transition-all [backface-visibility:hidden]">
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
              {(homeMeals.filter(m => m.name?.trim()).length > 0 || readyToEat.filter(i => i.name?.trim()).length > 0) && (
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
              <div className="h-14 w-14 rounded-full bg-sky-500/20 flex items-center justify-center mb-3">
                <Check className="h-7 w-7 text-sky-500" />
              </div>
              <p className="text-base font-semibold text-foreground mb-1">Targets Achieved</p>
              <p className="text-sm text-muted-foreground">
                {suggestionMessage || "You've reached your daily targets."}
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
                      className="p-3 rounded-lg border border-border bg-card shadow-sm hover:border-primary/50 hover:shadow-md transition-all cursor-pointer mb-2"
                      onClick={() => {
                        setPendingMeal({
                          name: suggestion.name,
                          calories: suggestion.calories,
                          protein: suggestion.protein,
                          carbs: suggestion.carbs,
                          fat: suggestion.fat,
                          servings: 1
                        })
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
                      className="flip-card-front p-4 rounded-xl border border-border bg-card shadow-sm hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group"
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
                        <p className="text-[10px] text-sky-600 mt-2 flex items-center gap-1">
                          <Sparkles className="h-3 w-3" />
                          {suggestion.personalizedReason}
                        </p>
                      )}
                      {suggestion.aiReasoning && !suggestion.personalizedReason && (
                        <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                          <Sparkles className="h-3 w-3" />
                          {suggestion.aiReasoning}
                        </p>
                      )}
                      {suggestion.score && suggestion.score >= 85 && (
                        <div className="absolute top-2 right-2">
                          <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                            Top Pick
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Back of card - click anywhere to flip back */}
                    <div
                      className="flip-card-back p-4 rounded-xl border border-border bg-card shadow-sm flex flex-col justify-center cursor-pointer"
                      onClick={() => setFlippedCardIndex(null)}
                    >
                      {/* Full macros grid */}
                      <div className="grid grid-cols-4 gap-2 mb-3">
                        <div className="text-center p-2 rounded-lg bg-muted">
                          <p className="text-sm font-semibold text-foreground">{suggestion.calories}</p>
                          <p className="text-[10px] text-muted-foreground">cal</p>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-primary/15">
                          <p className="text-sm font-semibold text-primary">{suggestion.protein}g</p>
                          <p className="text-[10px] text-muted-foreground">protein</p>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-muted">
                          <p className="text-sm font-semibold text-foreground">{suggestion.carbs}g</p>
                          <p className="text-[10px] text-muted-foreground">carbs</p>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-muted">
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
                              loadSuggestions(user.id, userLocation, mealSize, diningMode, travelMode, scheduledMealTime)
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
        </div>

        {/* Pattern Insight Card */}
        {patternInsight && (
          <div className="bg-sky-500/5 rounded-2xl p-5 border border-sky-500/10 hover:border-sky-500/20 transition-all">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-sky-500/10 flex items-center justify-center flex-shrink-0">
                <Sparkles className="h-4 w-4 text-sky-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{patternInsight.headline}</p>
                <p className="text-sm text-muted-foreground mt-1">{patternInsight.body}</p>
              </div>
            </div>
          </div>
        )}

        {/* Left: Today's Total + Ingredient Health (stacked squares) | Right: Meals Logged */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Left Column: Two equal squares stacked */}
          <div className="flex flex-col gap-5">
            {/* Today's Total - Square */}
            <div className="flex-1 bg-card rounded-2xl p-5 border border-border shadow-sm flex flex-col">
              <p className="text-sm font-medium text-muted-foreground mb-4">Today's Total</p>
              {!macros ? (
                <div className="flex-1 grid grid-cols-2 gap-3 content-center">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex flex-col items-center p-3 rounded-xl bg-muted/30 animate-pulse">
                      <div className="w-16 h-16 rounded-full bg-muted" />
                      <div className="h-5 w-14 bg-muted rounded mt-2" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex-1 grid grid-cols-2 gap-3 content-center">
                  {/* Calories */}
                  <div className="flex flex-col items-center p-3 rounded-xl bg-muted/30">
                    <div className="relative w-16 h-16">
                      <svg className="w-16 h-16 -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted" />
                        <circle
                          cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8"
                          className="text-primary transition-all duration-500"
                          strokeLinecap="round"
                          strokeDasharray={`${Math.min(100, (macros.current.calories / macros.targets.calories) * 100) * 2.64} 264`}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-sm font-bold text-foreground">{Math.round((macros.current.calories / macros.targets.calories) * 100)}%</span>
                      </div>
                    </div>
                    <p className="text-lg font-bold text-foreground mt-1">{macros.current.calories}</p>
                    <p className="text-xs text-muted-foreground">of {macros.targets.calories} cal</p>
                  </div>

                  {/* Protein */}
                  <div className="flex flex-col items-center p-3 rounded-xl bg-primary/5 border border-primary/10">
                    <div className="relative w-16 h-16">
                      <svg className="w-16 h-16 -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted" />
                        <circle
                          cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8"
                          className="text-primary transition-all duration-500"
                          strokeLinecap="round"
                          strokeDasharray={`${Math.min(100, (macros.current.protein / macros.targets.protein) * 100) * 2.64} 264`}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-sm font-bold text-foreground">{Math.round((macros.current.protein / macros.targets.protein) * 100)}%</span>
                      </div>
                    </div>
                    <p className="text-lg font-bold text-primary mt-1">{macros.current.protein}g</p>
                    <p className="text-xs text-muted-foreground">of {macros.targets.protein}g protein</p>
                  </div>

                  {/* Carbs */}
                  <div className="flex flex-col items-center p-3 rounded-xl bg-muted/30">
                    <div className="relative w-16 h-16">
                      <svg className="w-16 h-16 -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted" />
                        <circle
                          cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8"
                          className="text-primary/60 transition-all duration-500"
                          strokeLinecap="round"
                          strokeDasharray={`${Math.min(100, (macros.current.carbs / macros.targets.carbs) * 100) * 2.64} 264`}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-sm font-bold text-foreground">{Math.round((macros.current.carbs / macros.targets.carbs) * 100)}%</span>
                      </div>
                    </div>
                    <p className="text-lg font-bold text-foreground mt-1">{macros.current.carbs}g</p>
                    <p className="text-xs text-muted-foreground">of {macros.targets.carbs}g carbs</p>
                  </div>

                  {/* Fat */}
                  <div className="flex flex-col items-center p-3 rounded-xl bg-muted/30">
                    <div className="relative w-16 h-16">
                      <svg className="w-16 h-16 -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted" />
                        <circle
                          cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8"
                          className="text-primary/40 transition-all duration-500"
                          strokeLinecap="round"
                          strokeDasharray={`${Math.min(100, (macros.current.fat / macros.targets.fat) * 100) * 2.64} 264`}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-sm font-bold text-foreground">{Math.round((macros.current.fat / macros.targets.fat) * 100)}%</span>
                      </div>
                    </div>
                    <p className="text-lg font-bold text-foreground mt-1">{macros.current.fat}g</p>
                    <p className="text-xs text-muted-foreground">of {macros.targets.fat}g fat</p>
                  </div>
                </div>
              )}
            </div>

            {/* Today's Health Insights - Square */}
            {isPro && todayHealth ? (
              <Link
                href="/insights/health"
                className="flex-1 bg-card rounded-2xl border border-border hover:border-primary/30 hover:shadow-lg transition-all group flex flex-col overflow-hidden"
              >
                {/* Header with grade accent */}
                <div className={`px-5 py-4 ${
                  todayHealth.grade === 'A' ? 'bg-gradient-to-r from-emerald-500/15 to-transparent' :
                  todayHealth.grade === 'B' ? 'bg-gradient-to-r from-green-500/15 to-transparent' :
                  todayHealth.grade === 'C' ? 'bg-gradient-to-r from-amber-500/15 to-transparent' :
                  todayHealth.grade === 'D' ? 'bg-gradient-to-r from-orange-500/15 to-transparent' :
                  'bg-gradient-to-r from-red-500/15 to-transparent'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className={`text-4xl font-bold ${
                        todayHealth.grade === 'A' ? 'text-emerald-500' :
                        todayHealth.grade === 'B' ? 'text-green-500' :
                        todayHealth.grade === 'C' ? 'text-amber-500' :
                        todayHealth.grade === 'D' ? 'text-orange-500' : 'text-red-500'
                      }`}>{todayHealth.grade}</span>
                      <div>
                        <p className="text-base font-medium text-foreground">Today's Health</p>
                        <p className="text-sm text-muted-foreground">{todayHealth.allMealsCount} meal{todayHealth.allMealsCount !== 1 ? 's' : ''} tracked</p>
                      </div>
                    </div>
                    <ArrowUpRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 px-5 py-4 flex flex-col justify-between">
                  {/* AI Summary */}
                  {todayHealth.summary ? (
                    <p className="text-base text-foreground/90 leading-relaxed">
                      {todayHealth.summary}
                    </p>
                  ) : (
                    <p className="text-base text-foreground/90 leading-relaxed">
                      {todayHealth.grade === 'A' || todayHealth.grade === 'B'
                        ? 'Great nutrition balance today. Keep it up!'
                        : 'Track more meals for personalized insights.'}
                    </p>
                  )}

                  {/* Nutrition Grid */}
                  <div className="grid grid-cols-4 gap-3 mt-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-2 ${
                        todayHealth.hasVeggies ? 'bg-emerald-500/20' : 'bg-muted/50'
                      }`}>
                        {todayHealth.hasVeggies ? (
                          <Check className="h-6 w-6 text-emerald-500" />
                        ) : (
                          <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />
                        )}
                      </div>
                      <span className={`text-sm ${todayHealth.hasVeggies ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>Veggies</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-2 ${
                        todayHealth.hasFruits ? 'bg-emerald-500/20' : 'bg-muted/50'
                      }`}>
                        {todayHealth.hasFruits ? (
                          <Check className="h-6 w-6 text-emerald-500" />
                        ) : (
                          <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />
                        )}
                      </div>
                      <span className={`text-sm ${todayHealth.hasFruits ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>Fruits</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-2 ${
                        todayHealth.hasFiber ? 'bg-emerald-500/20' : 'bg-muted/50'
                      }`}>
                        {todayHealth.hasFiber ? (
                          <Check className="h-6 w-6 text-emerald-500" />
                        ) : (
                          <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />
                        )}
                      </div>
                      <span className={`text-sm ${todayHealth.hasFiber ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>Fiber</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-2 ${
                        todayHealth.hasProbiotics ? 'bg-emerald-500/20' : 'bg-muted/50'
                      }`}>
                        {todayHealth.hasProbiotics ? (
                          <Check className="h-6 w-6 text-emerald-500" />
                        ) : (
                          <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />
                        )}
                      </div>
                      <span className={`text-sm ${todayHealth.hasProbiotics ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>Gut</span>
                    </div>
                  </div>
                </div>
              </Link>
            ) : isPro ? (
              <Link
                href="/insights/health"
                className="flex-1 bg-card rounded-2xl border border-border hover:border-primary/30 hover:shadow-lg transition-all group flex flex-col overflow-hidden"
              >
                <div className="px-5 py-4 bg-gradient-to-r from-muted/50 to-transparent">
                  <div className="flex items-center justify-between">
                    <p className="text-base font-medium text-foreground">Today's Health</p>
                    <ArrowUpRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
                <div className="flex-1 px-5 py-4 flex flex-col items-center justify-center">
                  <div className="w-16 h-16 rounded-xl bg-muted/50 flex items-center justify-center mb-4">
                    <Shield className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                  <p className="text-base text-muted-foreground text-center">Log meals to unlock health insights</p>
                </div>
              </Link>
            ) : (
              <div className="flex-1 bg-card rounded-2xl border border-border relative overflow-hidden flex flex-col">
                <div className="px-5 py-4 bg-gradient-to-r from-green-500/10 to-transparent flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-4xl font-bold text-green-500">B</span>
                    <p className="text-base font-medium text-foreground">Today's Health</p>
                  </div>
                  <span className="text-xs font-medium text-amber-600 bg-amber-500/10 px-2.5 py-1 rounded-full">Pro</span>
                </div>
                <div className="flex-1 px-5 py-4 blur-[2px] opacity-60">
                  <p className="text-base text-foreground/90 mb-4">Solid protein intake. Consider adding probiotics for gut health.</p>
                  <div className="grid grid-cols-4 gap-3">
                    {['Veggies', 'Fruits', 'Fiber', 'Gut'].map((item, i) => (
                      <div key={item} className="flex flex-col items-center">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-2 ${i < 2 ? 'bg-emerald-500/20' : 'bg-muted/50'}`}>
                          {i < 2 ? <Check className="h-6 w-6 text-emerald-500" /> : <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />}
                        </div>
                        <span className="text-sm text-muted-foreground">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Meals Logged */}
          <div className="bg-card rounded-2xl p-5 border border-border shadow-sm flex flex-col">
            <p className="text-sm font-medium text-muted-foreground mb-4">Meals Logged</p>

            {(() => {
              const mealsByType = getMealsByType()
              const MAX_VISIBLE = 3

              const renderMealItem = (meal: typeof mealsByType.breakfast[0]) => (
                <div
                  key={meal.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, meal.id, meal.mealType)}
                  onDragEnd={handleDragEnd}
                  className={`bg-muted/30 rounded-xl p-3 group cursor-grab active:cursor-grabbing transition-all hover:bg-muted/50 ${
                    draggedMeal?.id === meal.id ? 'opacity-50 scale-95' : ''
                  } ${updatingMealId === meal.id ? 'opacity-70' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground/40 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <p className="text-sm font-medium text-foreground truncate flex-1">{meal.name}</p>
                    <button
                      onClick={() => deleteMeal(meal.id)}
                      disabled={deletingMealId === meal.id}
                      className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all disabled:opacity-50"
                    >
                      {deletingMealId === meal.id ? (
                        <div className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-2 pl-6">
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-muted-foreground">{meal.calories} cal</span>
                      <span className="text-primary font-medium">{meal.protein}g protein</span>
                    </div>
                    <div className="flex items-center gap-1 bg-background/50 rounded-lg px-1 py-0.5">
                      <button
                        onClick={() => updateMealServings(meal.id, meal.servings - 0.5)}
                        disabled={updatingMealId === meal.id || meal.servings <= 0.5}
                        className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="text-sm font-medium text-foreground w-8 text-center">
                        {meal.servings % 1 === 0 ? meal.servings : meal.servings.toFixed(1)}x
                      </span>
                      <button
                        onClick={() => updateMealServings(meal.id, meal.servings + 0.5)}
                        disabled={updatingMealId === meal.id}
                        className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )

              const renderMealSection = (type: 'breakfast' | 'lunch' | 'dinner', label: string, meals: typeof mealsByType.breakfast) => (
                <div
                  onDragOver={(e) => handleDragOver(e, type)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, type)}
                  className={`rounded-xl p-2 transition-all ${
                    dragOverType === type ? 'bg-primary/5 ring-2 ring-primary/30 ring-dashed' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
                    {meals.length > 0 && (
                      <span className="text-xs text-primary font-semibold bg-primary/10 px-2 py-0.5 rounded-full">{meals.length}</span>
                    )}
                  </div>
                  {meals.length > 0 ? (
                    <div className="space-y-2">
                      {meals.slice(0, MAX_VISIBLE).map(renderMealItem)}
                      {meals.length > MAX_VISIBLE && (
                        <Link href="/meals" className="text-xs text-primary hover:text-primary/80 transition-colors block text-center py-1">
                          +{meals.length - MAX_VISIBLE} more
                        </Link>
                      )}
                    </div>
                  ) : (
                    <div className={`text-center py-4 rounded-lg border-2 border-dashed ${
                      dragOverType === type ? 'border-primary/40 bg-primary/5' : 'border-border/30'
                    }`}>
                      <p className="text-xs text-muted-foreground/50">
                        {dragOverType === type ? 'Drop meal here' : 'No meals yet'}
                      </p>
                    </div>
                  )}
                </div>
              )

              return (
                <div className="space-y-4 flex-1">
                  {renderMealSection('breakfast', 'Breakfast', mealsByType.breakfast)}
                  {renderMealSection('lunch', 'Lunch', mealsByType.lunch)}
                  {renderMealSection('dinner', 'Dinner', mealsByType.dinner)}
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
            className="bg-card rounded-xl p-4 border border-border shadow-sm hover:border-primary/50 hover:shadow-md transition-all group"
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
            className="bg-card rounded-xl p-4 border border-border shadow-sm hover:border-primary/50 hover:shadow-md transition-all group"
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
