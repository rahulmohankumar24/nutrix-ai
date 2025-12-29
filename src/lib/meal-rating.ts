/**
 * Smart meal rating system that considers:
 * - How well the meal fits the per-meal target (based on remaining meals)
 * - Protein prioritization
 * - Avoiding over/under eating
 */

interface MealMacros {
  calories: number
  protein: number
  carbs: number
  fat: number
}

interface RemainingMacros {
  calories: number
  protein: number
  carbs: number
  fat: number
}

interface MealRating {
  score: number // 0-100
  badge: 'PERFECT MATCH' | 'HIGHLY RECOMMENDED' | 'GOOD FIT' | 'OKAY' | null
  reasoning: string
  caloriesFit: number // 0-100
  proteinFit: number // 0-100
  overallFit: number // 0-100
}

export function rateMealForTarget(
  meal: MealMacros,
  remaining: RemainingMacros,
  mealsRemaining: number,
  targetCaloriesPerMeal: number,
  targetProteinPerMeal: number
): MealRating {
  // Calculate ideal per-meal targets
  const idealCalories = targetCaloriesPerMeal
  const idealProtein = targetProteinPerMeal

  // 1. CALORIE FIT (40% weight)
  // How well do the meal calories match the ideal?
  const calorieDiff = Math.abs(meal.calories - idealCalories)
  const calorieDeviation = calorieDiff / Math.max(idealCalories, 1)

  // More forgiving fit curve - penalize less for small deviations
  let caloriesFit = Math.max(0, 100 - (calorieDeviation * 80)) // Changed from 100 to 80 for gentler curve

  // Strong penalty for significantly overshooting if we have multiple meals left
  if (meal.calories > idealCalories * 1.4 && mealsRemaining > 1) {
    caloriesFit *= 0.5 // Harsher penalty
  }

  // Big bonus for hitting target when it's the last meal
  if (mealsRemaining === 1) {
    if (calorieDiff < idealCalories * 0.15) { // Within 15% is great
      caloriesFit = Math.min(100, caloriesFit * 1.3)
    }
    // Don't penalize as much for going over on the last meal
    if (meal.calories > idealCalories && meal.calories <= idealCalories * 1.2) {
      caloriesFit = Math.min(100, caloriesFit * 1.1)
    }
  }

  // Penalty for meals that are too small
  if (meal.calories < idealCalories * 0.6 && remaining.calories > 800) {
    caloriesFit *= 0.7
  }

  // 2. PROTEIN FIT (45% weight) - protein is critical
  const proteinDiff = Math.abs(meal.protein - idealProtein)
  const proteinDeviation = proteinDiff / Math.max(idealProtein, 1)

  // Gentler protein fit curve
  let proteinFit = Math.max(0, 100 - (proteinDeviation * 70)) // Changed from 100 to 70

  // Extra bonus for exceeding protein target (protein is good to go over)
  if (meal.protein > idealProtein && meal.protein <= idealProtein * 1.3) {
    proteinFit = Math.min(100, proteinFit * 1.15) // Increased bonus
  }

  // Big bonus if it's the last meal and we need to catch up on protein
  if (mealsRemaining === 1 && meal.protein >= remaining.protein * 0.85) {
    proteinFit = Math.min(100, proteinFit * 1.4) // Increased bonus
  }

  // Penalty for very low protein meals when protein is critical
  if (meal.protein < idealProtein * 0.5 && remaining.protein > 60) {
    proteinFit *= 0.6
  }

  // 3. OVERALL MACRO BALANCE (15% weight)
  // Don't want to blow out carbs or fat while hitting protein
  const macroBalance = 100 - Math.min(100,
    Math.abs(meal.carbs - (idealCalories * 0.45 / 4)) / (idealCalories * 0.45 / 4) * 50 +
    Math.abs(meal.fat - (idealCalories * 0.25 / 9)) / (idealCalories * 0.25 / 9) * 50
  )

  // Calculate weighted overall fit
  // CRITICAL: BOTH protein AND calories must be close for high scores
  const weights = mealsRemaining === 1
    ? { calories: 0.48, protein: 0.48, balance: 0.04 } // Last meal: BOTH matter equally
    : { calories: 0.45, protein: 0.48, balance: 0.07 } // Normal: both matter, slight protein edge

  const overallFit = (
    caloriesFit * weights.calories +
    proteinFit * weights.protein +
    macroBalance * weights.balance
  )

  // Final score (0-100)
  let score = Math.round(Math.max(0, Math.min(100, overallFit)))

  // BOTH MUST BE CLOSE RULE: Cap score if either target is significantly missed
  // This ensures you can't get a high score by just hitting protein OR just hitting calories
  // Use RAW percentages, not the boosted fit scores
  const rawCaloriePct = meal.calories / Math.max(idealCalories, 1)
  const rawProteinPct = meal.protein / Math.max(idealProtein, 1)
  const minRawPct = Math.min(rawCaloriePct, rawProteinPct)

  if (minRawPct <= 0.75) {
    // Either target missed by 25%+ = cap at 80 max
    score = Math.min(score, 80)
  }
  if (minRawPct <= 0.65) {
    // Either target missed by 35%+ = cap at 70 max
    score = Math.min(score, 70)
  }
  if (minRawPct <= 0.50) {
    // Either target missed by 50%+ = cap at 55 max
    score = Math.min(score, 55)
  }
  if (minRawPct <= 0.35) {
    // Either target missed by 65%+ = cap at 40 max
    score = Math.min(score, 40)
  }

  // Boost only if BOTH targets are hit well
  if (mealsRemaining === 1 && remaining.calories > 600) {
    const percentOfRemainingCalories = meal.calories / remaining.calories
    const percentOfRemainingProtein = meal.protein / remaining.protein

    // Only boost if BOTH are at 75%+
    if (percentOfRemainingCalories >= 0.75 && percentOfRemainingProtein >= 0.75) {
      score = Math.min(100, score + 10)
    }
  }

  // Ensure we have enough variation in scores
  score = Math.round(score)

  // Determine badge - more generous thresholds for better user experience
  let badge: MealRating['badge'] = null
  if (score >= 85) badge = 'PERFECT MATCH'
  else if (score >= 75) badge = 'HIGHLY RECOMMENDED'
  else if (score >= 65) badge = 'GOOD FIT'
  else if (score >= 55) badge = 'OKAY'

  // Generate reasoning with more context
  let reasoning = ''
  const calPercentOfTarget = (meal.calories / idealCalories) * 100
  const proteinPercentOfTarget = (meal.protein / idealProtein) * 100

  if (mealsRemaining === 1) {
    if (score >= 85) {
      reasoning = `Perfect for your last meal - ${Math.round(meal.calories)}cal and ${Math.round(meal.protein)}g protein hits ${Math.round(calPercentOfTarget)}% of your remaining targets`
    } else if (meal.calories < idealCalories * 0.75) {
      reasoning = `Lighter final meal (${Math.round(calPercentOfTarget)}% of target) - you'll finish ${Math.round(remaining.calories - meal.calories)}cal under daily goal`
    } else if (meal.calories > idealCalories * 1.15) {
      reasoning = `Substantial final meal (${Math.round(calPercentOfTarget)}% of target) - maximize macros before bedtime`
    } else {
      reasoning = `Solid final meal hitting ${Math.round(calPercentOfTarget)}% of remaining calories and ${Math.round(proteinPercentOfTarget)}% of protein`
    }
  } else if (mealsRemaining === 2) {
    if (score >= 85) {
      reasoning = `Excellent choice - balanced ${Math.round(meal.calories)}cal meal with ${Math.round(meal.protein)}g protein, leaving room for 1 more meal`
    } else if (meal.calories > idealCalories * 1.25) {
      reasoning = `Larger meal (${Math.round(calPercentOfTarget)}% of target) - good if you're very hungry, but leaves less for your final meal`
    } else if (meal.calories < idealCalories * 0.7) {
      reasoning = `Light meal (${Math.round(calPercentOfTarget)}% of target) - means your next meal needs to be bigger to hit targets`
    } else {
      reasoning = `Balanced ${Math.round(meal.calories)}cal meal, saving ${Math.round(remaining.calories - meal.calories)}cal for your final meal`
    }
  } else {
    if (score >= 85) {
      reasoning = `Great choice - well-balanced for this meal with ${mealsRemaining - 1} meal(s) remaining today`
    } else if (meal.calories > idealCalories * 1.3) {
      reasoning = `Higher calorie option - use if you're very hungry or planning fewer meals today`
    } else if (meal.calories < idealCalories * 0.7) {
      reasoning = `Lighter option - good if you're planning multiple smaller meals throughout the day`
    } else {
      reasoning = `Solid choice leaving room for ${mealsRemaining - 1} more meal(s) today`
    }
  }

  return {
    score,
    badge,
    reasoning,
    caloriesFit: Math.round(caloriesFit),
    proteinFit: Math.round(proteinFit),
    overallFit: Math.round(overallFit)
  }
}
