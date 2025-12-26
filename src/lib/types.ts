import { z } from 'zod'

export const OnboardingSchema = z.object({
  sex: z.enum(['male', 'female', 'other']),
  age: z.number().min(13).max(100).optional(),
  heightFt: z.number().min(3).max(8),
  heightIn: z.number().min(0).max(11),
  weightLb: z.number().min(50).max(500),
  goal: z.enum(['recomp', 'lean_bulk', 'cut']),
  liftingDays: z.number().min(0).max(7),
  stepsLevel: z.enum(['low', 'med', 'high']),
  constraints: z.array(z.string()),
  dislikes: z.string(),
  wakeTime: z.string(),
  lunchTime: z.string(),
  dinnerTime: z.string(),
  freeText: z.string()
})

export const PreferencesResponseSchema = z.object({
  eating_pattern: z.enum(['mostly_eat_out', 'mostly_home', 'mixed']),
  dislikes_detected: z.array(z.string()),
  preferred_cuisines: z.array(z.string()),
  time_to_cook: z.enum(['none', '15min', '30min+']),
  budget: z.enum(['low', 'medium', 'high']).optional(),
  coaching_notes: z.string()
})

export type OnboardingData = z.infer<typeof OnboardingSchema>
export type PreferencesResponse = z.infer<typeof PreferencesResponseSchema>

export interface Restaurant {
  id: string
  name: string
  lat: number
  lng: number
  distance: number
  tags: Record<string, string>
  isKnown: boolean
}

export interface OrderRecommendation {
  template: {
    id: string
    restaurantBrand: string
    title: string
    description: string
    calories: number
    protein: number
    carbs: number
    fat: number
    keywordsForDeliverySearch: string
  }
  restaurant: Restaurant
  fitScore: number
  explanation: string
}

export interface DailyTargets {
  calories: number
  protein: number
  carbs: number
  fat: number
}

export interface MacroProgress {
  current: DailyTargets
  remaining: DailyTargets
  targets: DailyTargets
}