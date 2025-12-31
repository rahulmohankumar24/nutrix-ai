"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import Link from "next/link"
import {
  Shield, ChevronLeft, AlertTriangle, Sparkles, RefreshCw,
  ChevronDown, TrendingUp, Utensils, Crown, Lock, Check,
  Leaf, Heart, Flame, Droplets, Apple, ArrowRight, Info,
  Zap, AlertCircle, ChevronRight
} from "lucide-react"
import { cn } from "@/lib/utils"

type SeverityLevel = 'critical' | 'high' | 'medium' | 'low'

interface FlaggedIngredient {
  name: string
  category: string
  severity: SeverityLevel
  displayName: string
  description: string
  foundInMeals: string[]
  occurrences: number
}

interface TopConcern {
  title: string
  description: string
  frequency: string
  severity: SeverityLevel
}

interface RestaurantBreakdown {
  restaurant: string
  avgScore: number
  mealCount: number
  cleanestOption: string | null
  concerningOptions: string[]
}

interface Recommendation {
  title: string
  action: string
  impact: string
}

interface HealthAnalysis {
  overallScore: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  mealsAnalyzed: number
  mealsWithData: number
  flaggedIngredients: FlaggedIngredient[]
  topConcerns: TopConcern[]
  restaurantBreakdown: RestaurantBreakdown[]
  recommendations: Recommendation[]
  // Nutrient tracking
  hasFruits?: boolean
  hasVeggies?: boolean
  hasFiber?: boolean
  hasProbiotics?: boolean
  hasVitaminC?: boolean
  hasVitaminD?: boolean
  hasVitaminA?: boolean
  hasIron?: boolean
  hasCalcium?: boolean
  hasOmega3?: boolean
  hasAntioxidants?: boolean
  hasPotassium?: boolean
  hasMagnesium?: boolean
  hasZinc?: boolean
  hasBVitamins?: boolean
  nutrientScore?: number
}

// Detailed explanations for ingredient categories - educational, not fear-based
const INGREDIENT_INFO: Record<string, { what: string; context: string; tip: string; alternatives: string[] }> = {
  'Seed Oils': {
    what: 'Common cooking oils like soybean, canola, and sunflower oil used in most restaurant kitchens.',
    context: 'These are fine in moderation. The main consideration is balancing omega-6 intake with omega-3s in your overall diet.',
    tip: 'No need to avoid completely - just be aware that restaurant meals often use these, so balance with omega-3 rich foods at home.',
    alternatives: ['Olive oil dishes', 'Avocado-based options', 'Grilled items']
  },
  'High Fructose Corn Syrup': {
    what: 'A sweetener commonly found in sodas, sauces, and dressings.',
    context: 'Like any added sugar, it\'s about quantity. Occasional consumption is perfectly normal.',
    tip: 'Check sauces and drinks - that\'s where it often hides. Water or unsweetened options are easy swaps.',
    alternatives: ['Unsweetened drinks', 'Oil & vinegar dressings', 'Fresh fruit']
  },
  'Trans Fats': {
    what: 'Partially hydrogenated oils, now rare in the US due to FDA regulations.',
    context: 'Most restaurants have phased these out. If present, it\'s usually in small amounts in baked goods or older recipes.',
    tip: 'This one\'s worth minimizing when you spot it, but it\'s increasingly uncommon.',
    alternatives: ['Grilled options', 'Fresh-made items', 'Non-fried dishes']
  },
  'Artificial Additives': {
    what: 'Includes colors, flavors, and enhancers like MSG that make food more appealing.',
    context: 'MSG is actually well-studied and considered safe. Other additives vary - most are fine for most people.',
    tip: 'If you notice you\'re sensitive to certain additives, it\'s useful to track which ones. Otherwise, don\'t stress.',
    alternatives: ['Fresh-prepared options', 'Simple ingredient dishes', 'Build-your-own meals']
  },
  'Preservatives': {
    what: 'Ingredients that help food last longer, like sodium benzoate or nitrates.',
    context: 'These serve an important food safety purpose. The amounts in food are regulated and generally safe.',
    tip: 'Fresh-made restaurant options naturally have fewer preservatives if you prefer.',
    alternatives: ['Made-to-order items', 'Fresh salads', 'Grilled proteins']
  },
  'Refined Sugars': {
    what: 'Added sugars in desserts, drinks, and some sauces.',
    context: 'Sugar is energy - it\'s about fitting it into your overall daily intake, not eliminating it.',
    tip: 'Be mindful of liquid calories and hidden sugars in sauces. Save room for intentional treats you actually enjoy.',
    alternatives: ['Fresh fruit', 'Unsweetened options', 'Smaller dessert portions']
  },
  'Artificial Sweeteners': {
    what: 'Zero-calorie sweeteners like aspartame, sucralose, or stevia.',
    context: 'Research shows these are safe for most people. They can be helpful for reducing sugar intake.',
    tip: 'If you enjoy diet drinks, that\'s fine. Some people prefer to limit them - personal preference.',
    alternatives: ['Water', 'Unsweetened tea', 'Sparkling water']
  }
}

function getGradeColor(grade: 'A' | 'B' | 'C' | 'D' | 'F') {
  switch (grade) {
    case 'A': return { text: 'text-emerald-600', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', fill: 'bg-emerald-500', stroke: '#10b981', gradient: 'from-emerald-400 to-green-500' }
    case 'B': return { text: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500/30', fill: 'bg-green-500', stroke: '#22c55e', gradient: 'from-green-400 to-emerald-500' }
    case 'C': return { text: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/30', fill: 'bg-amber-500', stroke: '#f59e0b', gradient: 'from-amber-400 to-yellow-500' }
    case 'D': return { text: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/30', fill: 'bg-orange-500', stroke: '#f97316', gradient: 'from-orange-400 to-amber-500' }
    case 'F': return { text: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/30', fill: 'bg-red-500', stroke: '#ef4444', gradient: 'from-red-400 to-orange-500' }
  }
}

// Circular progress component
function CircularProgress({ score, grade, colors }: { score: number; grade: string; colors: ReturnType<typeof getGradeColor> }) {
  const radius = 58
  const strokeWidth = 8
  const normalizedRadius = radius - strokeWidth / 2
  const circumference = normalizedRadius * 2 * Math.PI
  const strokeDashoffset = circumference - (score / 100) * circumference

  return (
    <div className="relative">
      {/* Glow effect */}
      <div className={cn(
        "absolute inset-0 blur-2xl opacity-30 rounded-full bg-gradient-to-br",
        colors.gradient
      )} />

      <svg height={radius * 2} width={radius * 2} className="transform -rotate-90 relative">
        {/* Background circle */}
        <circle
          stroke="currentColor"
          className="text-muted/20"
          fill="transparent"
          strokeWidth={strokeWidth}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        {/* Progress circle */}
        <circle
          stroke={colors.stroke}
          fill="transparent"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference + ' ' + circumference}
          style={{ strokeDashoffset, transition: 'stroke-dashoffset 0.8s ease-out' }}
          strokeLinecap="round"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-4xl font-bold", colors.text)}>{grade}</span>
        <span className="text-xs text-muted-foreground mt-0.5">GRADE</span>
      </div>
    </div>
  )
}

// Reframed as "awareness levels" instead of severity
function getAwarenessColor(severity: SeverityLevel) {
  switch (severity) {
    case 'critical': return { text: 'text-purple-600', bg: 'bg-purple-500/10', border: 'border-purple-500/20', dot: 'bg-purple-500', label: 'Worth noting' }
    case 'high': return { text: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20', dot: 'bg-blue-500', label: 'Good to know' }
    case 'medium': return { text: 'text-sky-500', bg: 'bg-sky-500/10', border: 'border-sky-500/20', dot: 'bg-sky-500', label: 'FYI' }
    case 'low': return { text: 'text-slate-500', bg: 'bg-slate-500/10', border: 'border-slate-500/20', dot: 'bg-slate-400', label: 'Minor' }
  }
}

export default function HealthInsightsPage() {
  const router = useRouter()
  const { user, isLoaded, isSignedIn } = useUser()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [analysis, setAnalysis] = useState<HealthAnalysis | null>(null)
  const [isPro, setIsPro] = useState(false)
  const [selectedIngredient, setSelectedIngredient] = useState<FlaggedIngredient | null>(null)

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) {
      router.push('/auth/signin')
      return
    }
    fetchProStatus()
  }, [isLoaded, isSignedIn, router, user?.id])

  const fetchProStatus = async () => {
    if (!user?.id) return
    try {
      const response = await fetch(`/api/profile?userId=${user.id}`)
      if (response.ok) {
        const data = await response.json()
        const pro = data.profile?.isPro === true
        setIsPro(pro)
        if (pro) {
          fetchAnalysis()
        } else {
          setLoading(false)
        }
      }
    } catch (error) {
      console.error('Failed to fetch pro status:', error)
      setLoading(false)
    }
  }

  const fetchAnalysis = async () => {
    if (!user?.id) return
    try {
      setLoading(true)
      const response = await fetch(`/api/health-analysis?userId=${user.id}`)
      if (response.ok) {
        const data = await response.json()
        setAnalysis(data)
      }
    } catch (error) {
      console.error('Failed to fetch health analysis:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    if (!user?.id || refreshing) return
    setRefreshing(true)
    try {
      const response = await fetch('/api/health-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      })
      if (response.ok) {
        const data = await response.json()
        setAnalysis(data)
      }
    } catch (error) {
      console.error('Failed to refresh analysis:', error)
    } finally {
      setRefreshing(false)
    }
  }

  // Group ingredients by category for cleaner display
  const groupedIngredients = analysis?.flaggedIngredients.reduce((acc, ing) => {
    if (!acc[ing.category]) acc[ing.category] = []
    acc[ing.category].push(ing)
    return acc
  }, {} as Record<string, FlaggedIngredient[]>) || {}

  // Get best and worst restaurants
  const sortedRestaurants = [...(analysis?.restaurantBreakdown || [])].sort((a, b) => b.avgScore - a.avgScore)
  const bestRestaurant = sortedRestaurants[0]
  const worstRestaurant = sortedRestaurants[sortedRestaurants.length - 1]

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-muted rounded w-1/4"></div>
            <div className="h-64 bg-muted rounded-3xl"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="h-48 bg-muted rounded-2xl"></div>
              <div className="h-48 bg-muted rounded-2xl"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Not Pro - show upgrade prompt
  if (!isPro) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <Link
            href="/my-path"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Analytics
          </Link>

          <div className="bg-card rounded-3xl p-10 border border-border/50 text-center">
            <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center mx-auto mb-6">
              <Crown className="h-10 w-10 text-amber-500" />
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-3">Ingredient Insights</h1>
            <p className="text-muted-foreground mb-8 max-w-lg mx-auto text-lg">
              Learn what's in your restaurant meals and make informed choices about the foods you enjoy.
            </p>
            <button className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold text-lg shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all">
              <Lock className="h-5 w-5" />
              Upgrade to Pro
            </button>
          </div>
        </div>
      </div>
    )
  }

  const gradeColors = analysis ? getGradeColor(analysis.grade) : null

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link
            href="/my-path"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Link>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border text-muted-foreground text-sm hover:bg-muted/50 transition-all disabled:opacity-50"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            Refresh
          </button>
        </div>

        {/* No Data State */}
        {(!analysis || analysis.mealsAnalyzed === 0) && (
          <div className="bg-card rounded-3xl p-8 border border-border/50">
            <div className="text-center py-8">
              <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-6">
                <Shield className="h-8 w-8 text-emerald-500" />
              </div>
              <h1 className="text-2xl font-bold text-foreground mb-3">Health AI</h1>
              <p className="text-muted-foreground max-w-sm mx-auto text-lg">
                Log restaurant meals to analyze your ingredient health.
              </p>
              <p className="text-sm text-muted-foreground mt-4">
                Try: "I had a chicken bowl from Chipotle"
              </p>
            </div>
          </div>
        )}

        {/* Main Analysis Content */}
        {analysis && analysis.mealsAnalyzed > 0 && gradeColors && (
          <div className="space-y-6">
            {/* Hero Score Card - Modern Design */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-card via-card to-muted/30 border border-border/50 p-6 md:p-8">
              {/* Background decoration */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-transparent via-transparent to-muted/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              <div className={cn(
                "absolute bottom-0 left-0 w-48 h-48 rounded-full blur-3xl opacity-10 -translate-x-1/2 translate-y-1/2 bg-gradient-to-br",
                gradeColors.gradient
              )} />

              <div className="relative flex flex-col md:flex-row items-center gap-8">
                {/* Circular Score */}
                <div className="flex flex-col items-center">
                  <CircularProgress score={analysis.overallScore} grade={analysis.grade} colors={gradeColors} />
                  <div className="mt-4 text-center">
                    <p className={cn("text-3xl font-bold tracking-tight", gradeColors.text)}>
                      {analysis.overallScore}
                      <span className="text-lg font-normal text-muted-foreground">/100</span>
                    </p>
                    <p className="text-sm text-muted-foreground">Health Score</p>
                  </div>
                </div>

                {/* Divider */}
                <div className="hidden md:block w-px h-32 bg-gradient-to-b from-transparent via-border to-transparent" />

                {/* Stats & Insights */}
                <div className="flex-1 w-full">
                  {/* Stats Row */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="text-center md:text-left">
                      <p className="text-3xl font-bold text-foreground">{analysis.mealsAnalyzed}</p>
                      <p className="text-sm text-muted-foreground">Meals Analyzed</p>
                    </div>
                    <div className="text-center md:text-left">
                      <p className="text-3xl font-bold text-foreground">{analysis.restaurantBreakdown.length}</p>
                      <p className="text-sm text-muted-foreground">Restaurants</p>
                    </div>
                    <div className="text-center md:text-left">
                      <p className={cn(
                        "text-3xl font-bold",
                        Object.keys(groupedIngredients).length > 3 ? "text-orange-500" : "text-emerald-500"
                      )}>
                        {Object.keys(groupedIngredients).length}
                      </p>
                      <p className="text-sm text-muted-foreground">Concerns</p>
                    </div>
                  </div>

                  {/* Quick Insights Pills */}
                  <div className="flex flex-wrap gap-2">
                    {bestRestaurant && (
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                        <span className="text-sm text-emerald-700 capitalize">Best: {bestRestaurant.restaurant}</span>
                      </div>
                    )}
                    {worstRestaurant && sortedRestaurants.length > 1 && worstRestaurant.avgScore < 70 && (
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20">
                        <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
                        <span className="text-sm text-orange-700 capitalize">Watch: {worstRestaurant.restaurant}</span>
                      </div>
                    )}
                    {analysis.topConcerns[0] && (
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted border border-border">
                        <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">{analysis.topConcerns[0].title}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Score interpretation - positive framing */}
              <div className="relative mt-6 pt-6 border-t border-border/50">
                <p className="text-sm text-muted-foreground">
                  {analysis.overallScore >= 85 ? (
                    <>Your restaurant choices tend toward <span className="text-emerald-600 font-medium">whole food options</span>. You're naturally gravitating toward simpler ingredients.</>
                  ) : analysis.overallScore >= 70 ? (
                    <>You're making <span className="text-green-600 font-medium">solid choices</span> overall. The insights below can help you fine-tune if you're curious.</>
                  ) : analysis.overallScore >= 55 ? (
                    <>Your meals are <span className="text-sky-600 font-medium">typical for restaurant dining</span>. Browse the insights below to learn what's in your food.</>
                  ) : analysis.overallScore >= 40 ? (
                    <>Like most restaurant meals, yours contain <span className="text-blue-600 font-medium">common additives</span>. No stress - just good info to have.</>
                  ) : (
                    <>Your meals have <span className="text-purple-600 font-medium">more processed ingredients</span> than average. Small swaps can help if that matters to you.</>
                  )}
                </p>
              </div>
            </div>

            {/* Vitamins & Nutrients Grid */}
            <div className="bg-card rounded-2xl border border-border/50 p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-green-500/20 flex items-center justify-center">
                    <Leaf className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-foreground">Vitamins & Nutrients</h2>
                    <p className="text-sm text-muted-foreground">What you're getting from your meals</p>
                  </div>
                </div>
                {analysis.nutrientScore !== undefined && (
                  <div className="text-right">
                    <p className={cn(
                      "text-2xl font-bold",
                      analysis.nutrientScore >= 60 ? "text-emerald-500" :
                      analysis.nutrientScore >= 40 ? "text-amber-500" : "text-orange-500"
                    )}>
                      {analysis.nutrientScore}%
                    </p>
                    <p className="text-xs text-muted-foreground">Nutrient variety</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-3">
                {/* Vitamins */}
                <div className={cn(
                  "flex flex-col items-center p-3 rounded-xl border transition-all",
                  analysis.hasVitaminC ? "bg-orange-500/10 border-orange-500/30" : "bg-muted/30 border-border/50"
                )}>
                  <span className="text-2xl mb-1">🍊</span>
                  <span className={cn("text-xs font-medium", analysis.hasVitaminC ? "text-orange-600" : "text-muted-foreground")}>Vit C</span>
                  {analysis.hasVitaminC && <Check className="h-3 w-3 text-orange-500 mt-1" />}
                </div>

                <div className={cn(
                  "flex flex-col items-center p-3 rounded-xl border transition-all",
                  analysis.hasVitaminD ? "bg-yellow-500/10 border-yellow-500/30" : "bg-muted/30 border-border/50"
                )}>
                  <span className="text-2xl mb-1">☀️</span>
                  <span className={cn("text-xs font-medium", analysis.hasVitaminD ? "text-yellow-600" : "text-muted-foreground")}>Vit D</span>
                  {analysis.hasVitaminD && <Check className="h-3 w-3 text-yellow-500 mt-1" />}
                </div>

                <div className={cn(
                  "flex flex-col items-center p-3 rounded-xl border transition-all",
                  analysis.hasVitaminA ? "bg-orange-500/10 border-orange-500/30" : "bg-muted/30 border-border/50"
                )}>
                  <span className="text-2xl mb-1">🥕</span>
                  <span className={cn("text-xs font-medium", analysis.hasVitaminA ? "text-orange-600" : "text-muted-foreground")}>Vit A</span>
                  {analysis.hasVitaminA && <Check className="h-3 w-3 text-orange-500 mt-1" />}
                </div>

                <div className={cn(
                  "flex flex-col items-center p-3 rounded-xl border transition-all",
                  analysis.hasBVitamins ? "bg-purple-500/10 border-purple-500/30" : "bg-muted/30 border-border/50"
                )}>
                  <span className="text-2xl mb-1">⚡</span>
                  <span className={cn("text-xs font-medium", analysis.hasBVitamins ? "text-purple-600" : "text-muted-foreground")}>B Vits</span>
                  {analysis.hasBVitamins && <Check className="h-3 w-3 text-purple-500 mt-1" />}
                </div>

                {/* Minerals */}
                <div className={cn(
                  "flex flex-col items-center p-3 rounded-xl border transition-all",
                  analysis.hasIron ? "bg-red-500/10 border-red-500/30" : "bg-muted/30 border-border/50"
                )}>
                  <span className="text-2xl mb-1">🩸</span>
                  <span className={cn("text-xs font-medium", analysis.hasIron ? "text-red-600" : "text-muted-foreground")}>Iron</span>
                  {analysis.hasIron && <Check className="h-3 w-3 text-red-500 mt-1" />}
                </div>

                <div className={cn(
                  "flex flex-col items-center p-3 rounded-xl border transition-all",
                  analysis.hasCalcium ? "bg-sky-500/10 border-sky-500/30" : "bg-muted/30 border-border/50"
                )}>
                  <span className="text-2xl mb-1">🦴</span>
                  <span className={cn("text-xs font-medium", analysis.hasCalcium ? "text-sky-600" : "text-muted-foreground")}>Calcium</span>
                  {analysis.hasCalcium && <Check className="h-3 w-3 text-sky-500 mt-1" />}
                </div>

                <div className={cn(
                  "flex flex-col items-center p-3 rounded-xl border transition-all",
                  analysis.hasMagnesium ? "bg-indigo-500/10 border-indigo-500/30" : "bg-muted/30 border-border/50"
                )}>
                  <span className="text-2xl mb-1">✨</span>
                  <span className={cn("text-xs font-medium", analysis.hasMagnesium ? "text-indigo-600" : "text-muted-foreground")}>Mag</span>
                  {analysis.hasMagnesium && <Check className="h-3 w-3 text-indigo-500 mt-1" />}
                </div>

                <div className={cn(
                  "flex flex-col items-center p-3 rounded-xl border transition-all",
                  analysis.hasZinc ? "bg-slate-500/10 border-slate-500/30" : "bg-muted/30 border-border/50"
                )}>
                  <span className="text-2xl mb-1">🛡️</span>
                  <span className={cn("text-xs font-medium", analysis.hasZinc ? "text-slate-600" : "text-muted-foreground")}>Zinc</span>
                  {analysis.hasZinc && <Check className="h-3 w-3 text-slate-500 mt-1" />}
                </div>

                <div className={cn(
                  "flex flex-col items-center p-3 rounded-xl border transition-all",
                  analysis.hasPotassium ? "bg-yellow-500/10 border-yellow-500/30" : "bg-muted/30 border-border/50"
                )}>
                  <span className="text-2xl mb-1">🍌</span>
                  <span className={cn("text-xs font-medium", analysis.hasPotassium ? "text-yellow-600" : "text-muted-foreground")}>Potass</span>
                  {analysis.hasPotassium && <Check className="h-3 w-3 text-yellow-500 mt-1" />}
                </div>

                {/* Other nutrients */}
                <div className={cn(
                  "flex flex-col items-center p-3 rounded-xl border transition-all",
                  analysis.hasOmega3 ? "bg-blue-500/10 border-blue-500/30" : "bg-muted/30 border-border/50"
                )}>
                  <span className="text-2xl mb-1">🐟</span>
                  <span className={cn("text-xs font-medium", analysis.hasOmega3 ? "text-blue-600" : "text-muted-foreground")}>Omega-3</span>
                  {analysis.hasOmega3 && <Check className="h-3 w-3 text-blue-500 mt-1" />}
                </div>

                <div className={cn(
                  "flex flex-col items-center p-3 rounded-xl border transition-all",
                  analysis.hasAntioxidants ? "bg-purple-500/10 border-purple-500/30" : "bg-muted/30 border-border/50"
                )}>
                  <span className="text-2xl mb-1">🫐</span>
                  <span className={cn("text-xs font-medium", analysis.hasAntioxidants ? "text-purple-600" : "text-muted-foreground")}>Antiox</span>
                  {analysis.hasAntioxidants && <Check className="h-3 w-3 text-purple-500 mt-1" />}
                </div>

                <div className={cn(
                  "flex flex-col items-center p-3 rounded-xl border transition-all",
                  analysis.hasFiber ? "bg-amber-500/10 border-amber-500/30" : "bg-muted/30 border-border/50"
                )}>
                  <span className="text-2xl mb-1">🌾</span>
                  <span className={cn("text-xs font-medium", analysis.hasFiber ? "text-amber-600" : "text-muted-foreground")}>Fiber</span>
                  {analysis.hasFiber && <Check className="h-3 w-3 text-amber-500 mt-1" />}
                </div>

                <div className={cn(
                  "flex flex-col items-center p-3 rounded-xl border transition-all",
                  analysis.hasProbiotics ? "bg-green-500/10 border-green-500/30" : "bg-muted/30 border-border/50"
                )}>
                  <span className="text-2xl mb-1">🦠</span>
                  <span className={cn("text-xs font-medium", analysis.hasProbiotics ? "text-green-600" : "text-muted-foreground")}>Probio</span>
                  {analysis.hasProbiotics && <Check className="h-3 w-3 text-green-500 mt-1" />}
                </div>

                <div className={cn(
                  "flex flex-col items-center p-3 rounded-xl border transition-all",
                  analysis.hasFruits ? "bg-pink-500/10 border-pink-500/30" : "bg-muted/30 border-border/50"
                )}>
                  <span className="text-2xl mb-1">🍎</span>
                  <span className={cn("text-xs font-medium", analysis.hasFruits ? "text-pink-600" : "text-muted-foreground")}>Fruits</span>
                  {analysis.hasFruits && <Check className="h-3 w-3 text-pink-500 mt-1" />}
                </div>

                <div className={cn(
                  "flex flex-col items-center p-3 rounded-xl border transition-all",
                  analysis.hasVeggies ? "bg-emerald-500/10 border-emerald-500/30" : "bg-muted/30 border-border/50"
                )}>
                  <span className="text-2xl mb-1">🥬</span>
                  <span className={cn("text-xs font-medium", analysis.hasVeggies ? "text-emerald-600" : "text-muted-foreground")}>Veggies</span>
                  {analysis.hasVeggies && <Check className="h-3 w-3 text-emerald-500 mt-1" />}
                </div>
              </div>

              <p className="text-xs text-muted-foreground text-center mt-4">
                Based on meal names - actual nutrient content may vary
              </p>
            </div>

            {/* Ingredient Awareness - Educational Section */}
            {Object.keys(groupedIngredients).length > 0 && (
              <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
                <div className="p-6 border-b border-border/50">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-sky-500/10 flex items-center justify-center">
                      <Info className="h-5 w-5 text-sky-500" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-foreground">Ingredient Insights</h2>
                      <p className="text-sm text-muted-foreground">Learn about what's in your restaurant meals</p>
                    </div>
                  </div>
                </div>

                <div className="divide-y divide-border/50">
                  {Object.entries(groupedIngredients).map(([category, ingredients]) => {
                    const info = INGREDIENT_INFO[category]
                    const topIngredient = ingredients[0]
                    const colors = getAwarenessColor(topIngredient.severity)
                    const isExpanded = selectedIngredient?.category === category

                    return (
                      <div key={category}>
                        <button
                          onClick={() => setSelectedIngredient(isExpanded ? null : topIngredient)}
                          className="w-full p-5 hover:bg-muted/30 transition-colors text-left"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <div className={cn("h-2.5 w-2.5 rounded-full", colors.dot)} />
                                <h3 className="font-semibold text-foreground">{category}</h3>
                                <span className={cn(
                                  "text-xs px-2 py-0.5 rounded-full",
                                  colors.bg, colors.text
                                )}>
                                  {colors.label}
                                </span>
                              </div>

                              {/* Quick summary */}
                              <div className="ml-5 space-y-1">
                                <p className="text-sm text-muted-foreground">
                                  Present in <span className="text-foreground font-medium">{ingredients.reduce((sum, i) => sum + i.occurrences, 0)}</span> of your meals
                                </p>
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {ingredients.slice(0, 3).map((ing, i) => (
                                    <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                                      {ing.name}
                                    </span>
                                  ))}
                                  {ingredients.length > 3 && (
                                    <span className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                                      +{ingredients.length - 3} more
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <ChevronDown className={cn(
                              "h-5 w-5 text-muted-foreground transition-transform mt-1",
                              isExpanded && "rotate-180"
                            )} />
                          </div>
                        </button>

                        {/* Expanded Educational Detail */}
                        {isExpanded && info && (
                          <div className="px-5 pb-5 -mt-2">
                            <div className="ml-5 p-5 rounded-xl bg-gradient-to-br from-muted/50 to-muted/30 space-y-4">
                              {/* What it is */}
                              <div>
                                <div className="flex items-center gap-2 mb-1.5">
                                  <Info className="h-4 w-4 text-sky-500" />
                                  <span className="text-sm font-medium text-foreground">What is this?</span>
                                </div>
                                <p className="text-sm text-muted-foreground ml-6">{info.what}</p>
                              </div>

                              {/* Context - balanced perspective */}
                              <div>
                                <div className="flex items-center gap-2 mb-1.5">
                                  <Heart className="h-4 w-4 text-pink-500" />
                                  <span className="text-sm font-medium text-foreground">The balanced view</span>
                                </div>
                                <p className="text-sm text-muted-foreground ml-6">{info.context}</p>
                              </div>

                              {/* Where it's coming from */}
                              <div>
                                <div className="flex items-center gap-2 mb-1.5">
                                  <Utensils className="h-4 w-4 text-purple-500" />
                                  <span className="text-sm font-medium text-foreground">Your meals with this</span>
                                </div>
                                <div className="ml-6 flex flex-wrap gap-2">
                                  {[...new Set(ingredients.flatMap(i => i.foundInMeals))].slice(0, 5).map((meal, i) => (
                                    <span key={i} className="text-xs px-2.5 py-1.5 rounded-lg bg-card border border-border text-foreground">
                                      {meal}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              {/* Practical tip */}
                              <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                                <div className="flex items-start gap-2">
                                  <Sparkles className="h-4 w-4 text-emerald-500 mt-0.5" />
                                  <div>
                                    <span className="text-sm font-medium text-emerald-700">Practical tip</span>
                                    <p className="text-sm text-muted-foreground mt-0.5">{info.tip}</p>
                                  </div>
                                </div>
                              </div>

                              {/* Alternative options */}
                              <div>
                                <div className="flex items-center gap-2 mb-1.5">
                                  <Leaf className="h-4 w-4 text-emerald-500" />
                                  <span className="text-sm font-medium text-foreground">If you want alternatives</span>
                                </div>
                                <div className="ml-6 flex flex-wrap gap-2">
                                  {info.alternatives.map((alt, i) => (
                                    <span key={i} className="text-xs px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700">
                                      {alt}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Options & Tips - Friendly Suggestions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Simpler Options If You Want Them */}
              <div className="bg-gradient-to-br from-emerald-500/5 to-green-500/5 rounded-2xl p-6 border border-emerald-500/20">
                <div className="flex items-center gap-3 mb-5">
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <Leaf className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-foreground">Simpler Options</h2>
                    <p className="text-xs text-muted-foreground">If you're curious about alternatives</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Mediterranean spots</p>
                      <p className="text-xs text-muted-foreground">Cava, Sweetgreen - typically use olive oil</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Grilled over fried</p>
                      <p className="text-xs text-muted-foreground">Usually means simpler preparation</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Fresh toppings</p>
                      <p className="text-xs text-muted-foreground">Salsa, guac, vinaigrettes have fewer additives</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Recognizable sides</p>
                      <p className="text-xs text-muted-foreground">Rice, beans, veggies - simple ingredients</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Personalized Suggestions */}
              {analysis.recommendations.length > 0 && (
                <div className="bg-gradient-to-br from-sky-500/5 to-blue-500/5 rounded-2xl p-6 border border-sky-500/20">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="h-10 w-10 rounded-xl bg-sky-500/10 flex items-center justify-center">
                      <Sparkles className="h-5 w-5 text-sky-500" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-foreground">Based On Your Habits</h2>
                      <p className="text-xs text-muted-foreground">Personalized ideas for you</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {analysis.recommendations.slice(0, 3).map((rec, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className="h-6 w-6 rounded-full bg-sky-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <ArrowRight className="h-3.5 w-3.5 text-sky-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{rec.title}</p>
                          <p className="text-xs text-muted-foreground">{rec.action}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Restaurant Breakdown - Grid Cards */}
            {analysis.restaurantBreakdown.length > 0 && (
              <div className="bg-card rounded-2xl border border-border/50 p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                    <Utensils className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-foreground">Your Restaurants</h2>
                    <p className="text-xs text-muted-foreground">Ingredient simplicity by where you eat</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sortedRestaurants.map((restaurant, i) => {
                    const grade = restaurant.avgScore >= 85 ? 'A' :
                                  restaurant.avgScore >= 70 ? 'B' :
                                  restaurant.avgScore >= 55 ? 'C' :
                                  restaurant.avgScore >= 40 ? 'D' : 'F'
                    const colors = getGradeColor(grade)
                    return (
                      <div key={i} className={cn(
                        "p-5 rounded-xl border flex items-center gap-4",
                        colors.bg, colors.border
                      )}>
                        <div className={cn(
                          "h-14 w-14 rounded-xl flex items-center justify-center text-xl font-bold flex-shrink-0",
                          colors.text, "bg-card border", colors.border
                        )}>
                          {grade}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground capitalize truncate text-lg">{restaurant.restaurant}</p>
                          <p className="text-sm text-muted-foreground">{restaurant.mealCount} meal{restaurant.mealCount > 1 ? 's' : ''}</p>
                          {restaurant.cleanestOption && (
                            <p className="text-xs text-emerald-600 truncate mt-1">Try: {restaurant.cleanestOption}</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Footer - Balanced messaging */}
            <div className="text-center py-6 space-y-2">
              <p className="text-sm text-muted-foreground">
                This is educational info, not medical advice. Enjoy your food!
              </p>
              <p className="text-xs text-muted-foreground/70">
                Based on published restaurant ingredient lists. Your actual meals may vary.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
