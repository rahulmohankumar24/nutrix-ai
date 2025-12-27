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
  mealType: 'breakfast' | 'lunch' | 'dinner'
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

  // Calculate time remaining in the day
  const minutesUntilBedtime = bedTimeMinutes - currentTimeInMinutes
  const hoursUntilBedtime = minutesUntilBedtime / 60

  let mealsRemaining = 0
  let mealType: 'breakfast' | 'lunch' | 'dinner' = 'dinner'
  let mealPercentage = 0.33 // Default to 33% of remaining

  // Smart meal counting: consider both time windows AND actual time left
  // Each meal needs realistic spacing:
  // - Time to eat: 30-45 min
  // - Digestion time before next meal: 2-3 hours
  // - Total: ~2.5-3 hours between meals minimum
  const HOURS_PER_MEAL = 2.75 // More realistic spacing for comfort and digestion
  const realisticMealsFromTimeRemaining = Math.max(1, Math.floor(hoursUntilBedtime / HOURS_PER_MEAL))

  // Determine current meal type based on time of day (NO SNACKS - only breakfast, lunch, dinner)
  if (currentTimeInMinutes < lunchTimeMinutes - 60) {
    // Before lunch (breakfast time)
    mealType = 'breakfast'
    mealsRemaining = Math.min(3, realisticMealsFromTimeRemaining) // breakfast, lunch, dinner
    mealPercentage = 0.30 // 30% of daily remaining
  } else if (currentTimeInMinutes < dinnerTimeMinutes - 60) {
    // Before dinner (lunch time)
    mealType = 'lunch'
    mealsRemaining = Math.min(2, realisticMealsFromTimeRemaining) // lunch, dinner
    mealPercentage = 0.45 // 45% of remaining
  } else {
    // Dinner time or later (no more snacks, just dinner)
    mealType = 'dinner'
    mealsRemaining = realisticMealsFromTimeRemaining
    mealPercentage = 0.70 // 70% of remaining
  }

  // SMART ADJUSTMENT: If we have high remaining macros but limited meals/time, increase meal percentage
  // For example: 5pm with 2000 calories remaining and only 2 realistic meals = need bigger meals
  if (mealsRemaining <= 2 && remaining.calories > 1000) {
    // If we have a lot of calories left but limited meals, be aggressive
    const caloriesPerMealNeeded = remaining.calories / mealsRemaining
    if (caloriesPerMealNeeded > 600) {
      // Need substantial meals to hit targets
      mealPercentage = Math.min(0.65, (1 / mealsRemaining) + 0.15) // Add 15% buffer
    }
  }

  // If this is realistically the last meal of the day, be very aggressive
  if (mealsRemaining === 1 && remaining.calories > 800) {
    mealPercentage = 0.85 // Try to hit most of remaining macros
  }

  // Override with explicit timeOfDay if provided and reasonable (NO SNACKS)
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
    }
    // Note: Snack option removed - only breakfast, lunch, dinner supported
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

  // Generate smart reasoning that explains the recommendation
  let reasoning = ''
  if (mealsRemaining === 1) {
    reasoning = hoursUntilBedtime < 4
      ? `This is your last realistic meal of the day (${hoursUntilBedtime.toFixed(1)}hrs until bedtime). Targeting most of your remaining macros.`
      : `This is your final meal of the day. Aiming for most of your remaining macros.`
  } else if (mealsRemaining === 2) {
    const hoursLeft = hoursUntilBedtime.toFixed(1)
    reasoning = `You have ${hoursLeft}hrs until bedtime and ${remaining.calories}cal remaining. With realistic digestion time (2.5-3hrs between meals), you can fit ${mealsRemaining} meals. This meal should be ~${Math.round(mealPercentage * 100)}% of remaining macros.`
  } else {
    const hoursLeft = hoursUntilBedtime.toFixed(1)
    reasoning = `You have ${hoursLeft}hrs until bedtime with ${mealsRemaining} realistic meal${mealsRemaining > 1 ? 's' : ''} left (allowing 2.5-3hrs between meals for digestion). This meal should be ~${Math.round(mealPercentage * 100)}% of remaining macros.`
  }

  const result = {
    targetCalories: finalCalories,
    targetProtein: finalProtein,
    targetCarbs: Math.round(targetCarbs * (finalCalories / targetCalories)), // Adjust carbs proportionally
    targetFat: Math.round(targetFat * (finalCalories / targetCalories)), // Adjust fat proportionally
    mealsRemaining,
    mealType,
    reasoning
  }

  return result
}

function parseTimeToMinutes(timeString: string): number {
  const [hours, minutes] = timeString.split(':').map(Number)
  return hours * 60 + (minutes || 0)
}
