// Meal Agent Dispatcher
// Routes requests to the appropriate meal-time agent based on current hour

import {
  MealAgentContext,
  MealAgentResult,
  MealTime,
  MEAL_TIME_BOUNDARIES
} from './types'

import { runBreakfastAgent, calculateBreakfastTarget } from './breakfast-agent'
import { runLunchAgent, calculateLunchTarget } from './lunch-agent'
import { runDinnerAgent, calculateDinnerTarget, getDinnerUrgency } from './dinner-agent'

// Re-export types
export * from './types'

// Re-export individual agent functions for direct use
export { runBreakfastAgent, calculateBreakfastTarget } from './breakfast-agent'
export { runLunchAgent, calculateLunchTarget } from './lunch-agent'
export { runDinnerAgent, calculateDinnerTarget, getDinnerUrgency } from './dinner-agent'

/**
 * Determine meal time from hour
 *
 * Time boundaries:
 * - Breakfast: 5 AM - 11 AM
 * - Lunch: 11 AM - 4 PM
 * - Dinner: 4 PM - 12 AM
 * - Late night (12 AM - 5 AM): Treated as critical dinner
 */
export function getMealTimeFromHour(hour: number): MealTime {
  // Late night (12 AM - 5 AM) - treat as dinner with critical urgency
  if (hour >= MEAL_TIME_BOUNDARIES.lateNight.start && hour < MEAL_TIME_BOUNDARIES.lateNight.end) {
    return 'dinner'
  }
  // Breakfast (5 AM - 11 AM)
  if (hour >= MEAL_TIME_BOUNDARIES.breakfast.start && hour < MEAL_TIME_BOUNDARIES.breakfast.end) {
    return 'breakfast'
  }
  // Lunch (11 AM - 4 PM)
  if (hour >= MEAL_TIME_BOUNDARIES.lunch.start && hour < MEAL_TIME_BOUNDARIES.lunch.end) {
    return 'lunch'
  }
  // Dinner (4 PM - 12 AM) - default
  return 'dinner'
}

/**
 * Get the appropriate agent for a given hour
 */
export function getMealAgent(hour: number): {
  type: MealTime
  run: (ctx: MealAgentContext) => Promise<MealAgentResult>
} {
  const mealTime = getMealTimeFromHour(hour)

  switch (mealTime) {
    case 'breakfast':
      return { type: 'breakfast', run: runBreakfastAgent }
    case 'lunch':
      return { type: 'lunch', run: runLunchAgent }
    case 'dinner':
    default:
      return { type: 'dinner', run: runDinnerAgent }
  }
}

/**
 * Run the appropriate meal agent based on context
 * This is the main entry point for meal suggestions
 */
export async function runMealAgent(ctx: MealAgentContext): Promise<MealAgentResult> {
  const agent = getMealAgent(ctx.currentHour)
  return agent.run(ctx)
}

/**
 * Calculate the target for a specific meal time
 * Useful for displaying targets before running full agent
 */
export function calculateMealTarget(
  ctx: MealAgentContext,
  mealTime?: MealTime
): { calories: number; protein: number } {
  const effectiveMealTime = mealTime || getMealTimeFromHour(ctx.currentHour)

  switch (effectiveMealTime) {
    case 'breakfast':
      return calculateBreakfastTarget(ctx)
    case 'lunch':
      return calculateLunchTarget(ctx)
    case 'dinner':
    default:
      return calculateDinnerTarget(ctx)
  }
}

/**
 * Get a summary of meal distribution for the day
 * Useful for displaying the user's meal plan
 */
export function getMealDistributionSummary(dailyTargets: { calories: number; protein: number }, size: 'light' | 'regular' | 'hearty' = 'regular'): {
  breakfast: { calories: number; protein: number; pct: number }
  lunch: { calories: number; protein: number; pct: number }
  dinner: { calories: number; protein: number; pct: number }
} {
  // Breakfast targets (percentage of daily)
  const breakfastPct = size === 'light' ? 0.25 : size === 'hearty' ? 0.40 : 0.33

  // Lunch milestone (cumulative percentage)
  const lunchMilestone = size === 'light' ? 0.60 : size === 'hearty' ? 0.75 : 0.66
  const lunchPct = lunchMilestone - breakfastPct

  // Dinner gets the rest
  const dinnerPct = 1 - lunchMilestone

  return {
    breakfast: {
      calories: Math.round(dailyTargets.calories * breakfastPct),
      protein: Math.round(dailyTargets.protein * breakfastPct),
      pct: Math.round(breakfastPct * 100)
    },
    lunch: {
      calories: Math.round(dailyTargets.calories * lunchPct),
      protein: Math.round(dailyTargets.protein * lunchPct),
      pct: Math.round(lunchPct * 100)
    },
    dinner: {
      calories: Math.round(dailyTargets.calories * dinnerPct),
      protein: Math.round(dailyTargets.protein * dinnerPct),
      pct: Math.round(dinnerPct * 100)
    }
  }
}
