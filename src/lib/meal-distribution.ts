/**
 * Calculates realistic meal target based on time of day and remaining meals
 */

interface UserSchedule {
  wakeTime?: string
  lunchTime?: string
  dinnerTime?: string
}

interface MacroTargets {
  calories: number
  protein: number
  carbs: number
  fat: number
}

interface MealDistribution {
  targetCalories: number
  targetProtein: number
  targetCarbs: number
  targetFat: number
  mealsRemaining: number
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  reasoning: string
}

export function calculateRealisticMealTarget(
  timeOfDay: string,
  remaining: MacroTargets,
  userSchedule?: UserSchedule
): MealDistribution {
  const now = new Date()
  const currentHour = now.getHours()
  const currentMinutes = now.getMinutes()
  const currentTimeInMinutes = currentHour * 60 + currentMinutes

  // Parse user's schedule or use defaults
  const wakeTimeMinutes = parseTimeToMinutes(userSchedule?.wakeTime || '07:00')
  const lunchTimeMinutes = parseTimeToMinutes(userSchedule?.lunchTime || '12:00')
  const dinnerTimeMinutes = parseTimeToMinutes(userSchedule?.dinnerTime || '19:00')
  const bedTimeMinutes = wakeTimeMinutes + (16 * 60) // Assume 16 hour day

  let mealsRemaining = 0
  let mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' = 'snack'
  let mealPercentage = 0.33 // Default to 33% of remaining

  // Determine current meal type and count remaining meals
  if (currentTimeInMinutes < lunchTimeMinutes - 60) {
    // Before lunch (breakfast time)
    mealType = 'breakfast'
    mealsRemaining = 3 // breakfast, lunch, dinner
    mealPercentage = 0.30 // 30% of daily remaining
  } else if (currentTimeInMinutes < dinnerTimeMinutes - 60) {
    // Before dinner (lunch time)
    mealType = 'lunch'
    mealsRemaining = 2 // lunch, dinner
    mealPercentage = 0.45 // 45% of remaining (lunch + possible snack)
  } else if (currentTimeInMinutes < bedTimeMinutes) {
    // Dinner time
    mealType = 'dinner'
    mealsRemaining = 1 // just dinner
    mealPercentage = 0.70 // 70% of remaining (save some for potential late snack)
  } else {
    // Late night snack
    mealType = 'snack'
    mealsRemaining = 1
    mealPercentage = 0.80 // Most of what's left
  }

  // Override with explicit timeOfDay if provided and reasonable
  if (timeOfDay) {
    const lowerTime = timeOfDay.toLowerCase()
    if (lowerTime === 'breakfast' && mealsRemaining >= 2) {
      mealType = 'breakfast'
      mealPercentage = 0.30
    } else if (lowerTime === 'lunch' && mealsRemaining >= 2) {
      mealType = 'lunch'
      mealPercentage = 0.45
    } else if (lowerTime === 'dinner') {
      mealType = 'dinner'
      mealPercentage = mealsRemaining === 1 ? 0.70 : 0.50
    } else if (lowerTime === 'snack') {
      mealType = 'snack'
      mealPercentage = 0.25
    }
  }

  // Calculate realistic targets for THIS meal
  const targetCalories = Math.round(remaining.calories * mealPercentage)
  const targetProtein = Math.round(remaining.protein * mealPercentage)
  const targetCarbs = Math.round(remaining.carbs * mealPercentage)
  const targetFat = Math.round(remaining.fat * mealPercentage)

  // Cap maximum single meal calories at 1200 (realistic limit)
  const cappedCalories = Math.min(targetCalories, 1200)
  const cappedProtein = Math.min(targetProtein, Math.round(cappedCalories * 0.35 / 4)) // ~35% calories from protein max

  // Ensure minimum viable meal
  const finalCalories = Math.max(cappedCalories, 300)
  const finalProtein = Math.max(cappedProtein, 20)

  const reasoning = mealsRemaining > 1
    ? `Recommending ~${Math.round(mealPercentage * 100)}% of remaining macros. You have ${mealsRemaining} meals left today.`
    : `This is your final meal of the day. Aiming for most of your remaining macros.`

  return {
    targetCalories: finalCalories,
    targetProtein: finalProtein,
    targetCarbs: Math.round(targetCarbs * (finalCalories / targetCalories)), // Adjust carbs proportionally
    targetFat: Math.round(targetFat * (finalCalories / targetCalories)), // Adjust fat proportionally
    mealsRemaining,
    mealType,
    reasoning
  }
}

function parseTimeToMinutes(timeString: string): number {
  const [hours, minutes] = timeString.split(':').map(Number)
  return hours * 60 + (minutes || 0)
}
