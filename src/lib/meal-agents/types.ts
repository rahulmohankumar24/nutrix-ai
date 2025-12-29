// Meal Agent Types

export interface MacroTargets {
  calories: number
  protein: number
  carbs: number
  fat: number
}

export interface MealOption {
  id: string
  title: string
  description?: string
  restaurantBrand: string
  calories: number
  protein: number
  carbs: number
  fat: number
  patternBoosted?: boolean
}

export interface UserPattern {
  patternType: string
  patternKey: string
  patternValue: Record<string, unknown>
}

export interface MealAgentContext {
  userId: string
  dailyTargets: MacroTargets
  currentIntake: MacroTargets
  remaining: MacroTargets
  currentHour: number
  size: 'light' | 'regular' | 'hearty'
  availableMeals: MealOption[]
  userPatterns: UserPattern[]
}

export interface ScoredMeal {
  id: string
  name: string
  description?: string
  restaurant: string
  calories: number
  protein: number
  carbs: number
  fat: number
  score: number
  aiReasoning?: string
  distance?: number | null
  estimatedPrice?: number | null
  isPersonalized: boolean
  personalizedReason?: string | null
  isAIScored: boolean
}

export type MealTime = 'breakfast' | 'lunch' | 'dinner'
export type UrgencyLevel = 'low' | 'moderate' | 'high' | 'critical'

export interface MealAgentResult {
  suggestions: ScoredMeal[]
  targetForMeal: { calories: number; protein: number }
  message: string
  agentType: MealTime
  urgencyLevel: UrgencyLevel
  progressToGoal: {
    caloriesPct: number
    proteinPct: number
  }
  mealMilestone: {
    current: number
    target: number
  }
}

// Time boundaries for meal agents
export const MEAL_TIME_BOUNDARIES = {
  breakfast: { start: 5, end: 11 },   // 5 AM - 11 AM
  lunch: { start: 11, end: 16 },      // 11 AM - 4 PM
  dinner: { start: 16, end: 24 },     // 4 PM - 12 AM
  lateNight: { start: 0, end: 5 }     // 12 AM - 5 AM (treated as critical dinner)
} as const

// Size multipliers for each meal type
export const SIZE_MULTIPLIERS = {
  breakfast: { light: 0.25, regular: 0.33, hearty: 0.40 },
  lunch: { light: 0.60, regular: 0.66, hearty: 0.75 },
  dinner: { light: -0.05, regular: 0, hearty: 0.10 }  // Adjustments to remaining %
} as const

// Dinner urgency thresholds based on hour
export const DINNER_URGENCY_THRESHOLDS = {
  early: { start: 16, end: 20, pct: 0.90, level: 'moderate' as UrgencyLevel },
  mid: { start: 20, end: 22, pct: 0.95, level: 'high' as UrgencyLevel },
  late: { start: 22, end: 24, pct: 1.0, level: 'critical' as UrgencyLevel },
  lateNight: { start: 0, end: 5, pct: 1.0, level: 'critical' as UrgencyLevel }
} as const
