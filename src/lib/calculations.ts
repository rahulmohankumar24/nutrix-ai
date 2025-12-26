import { DailyTargets } from './types'

export function calculateTargets(
  heightIn: number,
  weightLb: number,
  age: number = 27,
  sex: 'male' | 'female' | 'other',
  goal: 'recomp' | 'lean_bulk' | 'cut',
  liftingDays: number,
  stepsLevel: 'low' | 'med' | 'high'
): DailyTargets {
  // Convert to metric
  const weightKg = weightLb / 2.20462
  const heightCm = heightIn * 2.54

  // Mifflin-St Jeor BMR calculation
  let bmr: number
  if (sex === 'male') {
    bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + 5
  } else {
    bmr = 10 * weightKg + 6.25 * heightCm - 5 * age - 161
  }

  // Activity multiplier
  let activityMultiplier: number
  switch (stepsLevel) {
    case 'low': activityMultiplier = 1.35; break
    case 'med': activityMultiplier = 1.50; break
    case 'high': activityMultiplier = 1.65; break
  }

  // Add lifting bonus
  if (liftingDays >= 4) {
    activityMultiplier += 0.05
  }

  let maintenanceCalories = bmr * activityMultiplier

  // Goal adjustment
  switch (goal) {
    case 'cut':
      maintenanceCalories -= 300
      break
    case 'recomp':
      maintenanceCalories += 100
      break
    case 'lean_bulk':
      maintenanceCalories += 250
      break
  }

  // Protein calculation
  let proteinMultiplier: number
  switch (goal) {
    case 'cut': proteinMultiplier = 1.1; break
    case 'recomp': proteinMultiplier = 1.0; break
    case 'lean_bulk': proteinMultiplier = 0.95; break
  }

  const protein = weightLb * proteinMultiplier

  // Fat calculation (clamp between 0.3-0.45 g/lb)
  const fat = Math.max(0.3 * weightLb, Math.min(0.45 * weightLb, 0.35 * weightLb))

  // Carbs fill remaining calories
  const proteinCalories = protein * 4
  const fatCalories = fat * 9
  const remainingCalories = maintenanceCalories - proteinCalories - fatCalories
  const carbs = remainingCalories / 4

  // Round to nearest 5g for macros, 50 for calories
  return {
    calories: Math.round(maintenanceCalories / 50) * 50,
    protein: Math.round(protein / 5) * 5,
    carbs: Math.round(carbs / 5) * 5,
    fat: Math.round(fat / 5) * 5
  }
}

export function calculateNextMealTarget(remaining: DailyTargets) {
  const targetCalories = Math.max(450, Math.min(900, 0.35 * remaining.calories))
  const targetProtein = Math.max(30, Math.min(75, 0.35 * remaining.protein))

  return {
    calories: targetCalories,
    protein: targetProtein,
    carbs: 0.35 * remaining.carbs,
    fat: 0.35 * remaining.fat
  }
}

export function calculateFitScore(
  template: { calories: number; protein: number; carbs: number; fat: number },
  remaining: DailyTargets
) {
  const target = calculateNextMealTarget(remaining)

  let score = 0
  score += 3 * Math.abs(template.protein - target.protein)
  score += 1 * Math.abs(template.calories - target.calories) / 50
  score += 1 * Math.abs(template.fat - target.fat) / 10
  score += 1 * Math.abs(template.carbs - target.carbs) / 25

  // Penalty for going over remaining calories
  if (template.calories > remaining.calories * 1.2) {
    score += 100
  }

  return score
}

export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3959 // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}