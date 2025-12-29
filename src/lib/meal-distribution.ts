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
  // Parse user's schedule or use defaults
  const wakeTimeMinutes = parseTimeToMinutes(userSchedule?.wakeTime || '07:00')
  const lunchTimeMinutes = parseTimeToMinutes(userSchedule?.lunchTime || '12:00')
  const dinnerTimeMinutes = parseTimeToMinutes(userSchedule?.dinnerTime || '19:00')
  const bedTimeMinutes = wakeTimeMinutes + (16 * 60) // Assume 16 hour day

  // Determine meal type and calculate based on explicit timeOfDay OR current time
  let mealsRemaining = 0
  let mealType: 'breakfast' | 'lunch' | 'dinner' = 'dinner'
  let mealPercentage = 0.33 // Default to 33% of remaining
  let hoursUntilBedtime = 8 // Default assumption

  // If explicit timeOfDay is provided, use it directly for meal calculation
  const lowerTime = timeOfDay?.toLowerCase()
  if (lowerTime === 'breakfast' || lowerTime === 'lunch' || lowerTime === 'dinner') {
    if (lowerTime === 'breakfast') {
      mealType = 'breakfast'
      mealsRemaining = 3 // breakfast, lunch, dinner
      mealPercentage = 0.30 // 30% of daily remaining for breakfast
      hoursUntilBedtime = (bedTimeMinutes - wakeTimeMinutes) / 60
    } else if (lowerTime === 'lunch') {
      mealType = 'lunch'
      mealsRemaining = 2 // lunch, dinner
      mealPercentage = 0.50 // 50% of remaining for lunch
      hoursUntilBedtime = (bedTimeMinutes - lunchTimeMinutes) / 60
    } else if (lowerTime === 'dinner') {
      mealType = 'dinner'
      mealsRemaining = 1 // just dinner
      mealPercentage = 0.95 // 95% of remaining for dinner (last meal)
      hoursUntilBedtime = (bedTimeMinutes - dinnerTimeMinutes) / 60
    }
  } else {
    // Fall back to current time calculation
    const now = new Date()
    const currentHour = now.getHours()
    const currentMinutes = now.getMinutes()
    const currentTimeInMinutes = currentHour * 60 + currentMinutes

    // Calculate time remaining in the day
    const minutesUntilBedtime = bedTimeMinutes - currentTimeInMinutes
    hoursUntilBedtime = minutesUntilBedtime / 60

    // Smart meal counting
    const HOURS_PER_MEAL = 2.75
    const realisticMealsFromTimeRemaining = Math.max(1, Math.floor(hoursUntilBedtime / HOURS_PER_MEAL))

    // Determine current meal type based on time of day
    if (currentTimeInMinutes < lunchTimeMinutes - 60) {
      mealType = 'breakfast'
      mealsRemaining = Math.min(3, realisticMealsFromTimeRemaining)
      mealPercentage = 0.30
    } else if (currentTimeInMinutes < dinnerTimeMinutes - 60) {
      mealType = 'lunch'
      mealsRemaining = Math.min(2, realisticMealsFromTimeRemaining)
      mealPercentage = 0.50
    } else {
      mealType = 'dinner'
      mealsRemaining = realisticMealsFromTimeRemaining
      mealPercentage = 0.90
    }
  }

  // SMART ADJUSTMENT: If we have high remaining macros but limited meals/time, increase meal percentage
  // For example: 5pm with 2000 calories remaining and only 2 realistic meals = need bigger meals
  if (mealsRemaining <= 2 && remaining.calories > 800) {
    // If we have a lot of calories left but limited meals, be aggressive
    const caloriesPerMealNeeded = remaining.calories / mealsRemaining
    if (caloriesPerMealNeeded > 500) {
      // Need substantial meals to hit targets - be very aggressive
      mealPercentage = Math.min(0.75, (1 / mealsRemaining) + 0.20) // Add 20% buffer to ensure targets are met
    }
  }

  // PROTEIN CHECK: If protein is running behind calories, adjust to prioritize protein
  // Users often struggle to hit protein, so recommend meals that help catch up
  const proteinProgress = (remaining.protein / remaining.calories) * 100
  if (proteinProgress > 0.05 && mealsRemaining <= 2) {
    // Protein is lagging behind - need high protein meals
    // Bump up the meal percentage to allow for larger protein-rich meals
    mealPercentage = Math.min(0.80, mealPercentage + 0.10)
  }

  // If this is realistically the last meal of the day, be very aggressive - hit those targets!
  if (mealsRemaining === 1) {
    if (remaining.calories > 400) {
      mealPercentage = 0.95 // Hit nearly all remaining macros
    } else {
      mealPercentage = 1.0 // Last meal with few calories left - go for 100%
    }
  }


  // Calculate realistic targets for THIS meal
  const targetCalories = Math.round(remaining.calories * mealPercentage)
  const targetProtein = Math.round(remaining.protein * mealPercentage)
  const targetCarbs = Math.round(remaining.carbs * mealPercentage)
  const targetFat = Math.round(remaining.fat * mealPercentage)

  // Cap maximum single meal calories at 1500 (allow larger meals to hit targets)
  const cappedCalories = Math.min(targetCalories, 1500)
  const cappedProtein = Math.min(targetProtein, Math.round(cappedCalories * 0.40 / 4)) // ~40% calories from protein max

  // Ensure minimum viable meal
  const finalCalories = Math.max(cappedCalories, 300)
  const finalProtein = Math.max(cappedProtein, 25)

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
