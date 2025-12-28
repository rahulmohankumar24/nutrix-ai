import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateTargets, calculateDistance } from '@/lib/calculations'
import { KNOWN_CHAINS } from '@/lib/chains'
import { normalizeRestaurantName } from '@/lib/restaurant-matcher'

// Meal size requirements by time of day and portion preference
const MEAL_REQUIREMENTS = {
  light: {
    breakfast: { minCalories: 250, maxCalories: 450, minProtein: 15 },
    lunch: { minCalories: 350, maxCalories: 600, minProtein: 20 },
    dinner: { minCalories: 400, maxCalories: 650, minProtein: 25 }
  },
  regular: {
    breakfast: { minCalories: 350, maxCalories: 700, minProtein: 20 },
    lunch: { minCalories: 500, maxCalories: 900, minProtein: 30 },
    dinner: { minCalories: 550, maxCalories: 1000, minProtein: 35 }
  },
  hearty: {
    breakfast: { minCalories: 500, maxCalories: 900, minProtein: 30 },
    lunch: { minCalories: 700, maxCalories: 1200, minProtein: 40 },
    dinner: { minCalories: 800, maxCalories: 1400, minProtein: 50 }
  }
}

// Calculate how well a meal fits for the specific meal time
function scoreMeal(
  meal: any,
  remaining: { calories: number; protein: number; carbs: number; fat: number },
  mealTime: 'breakfast' | 'lunch' | 'dinner',
  size: 'light' | 'regular' | 'hearty' = 'regular'
) {
  const requirements = MEAL_REQUIREMENTS[size][mealTime]
  let score = 0

  // CRITICAL: If meal exceeds remaining calories by more than 15%, reject it
  // This ensures we don't suggest 800cal meals when user has 450cal left
  if (meal.calories > remaining.calories * 1.15) {
    return 0
  }

  // First, check if meal is appropriate size for this meal time
  // But adjust based on what's remaining - if user has less left, accept smaller meals
  const effectiveMinCalories = Math.min(requirements.minCalories, remaining.calories * 0.5)

  if (meal.calories < effectiveMinCalories) {
    // Too small
    return 0
  }

  // Cap max calories at remaining (with small buffer)
  const effectiveMaxCalories = Math.min(requirements.maxCalories, remaining.calories * 1.1)

  if (meal.calories > effectiveMaxCalories) {
    // Too large for what's remaining
    score -= 30
  }

  // Adjust protein requirements based on remaining
  const effectiveMinProtein = Math.min(requirements.minProtein, remaining.protein * 0.8)

  if (meal.protein < effectiveMinProtein && remaining.protein > 20) {
    // Not enough protein (only penalize if user still needs significant protein)
    score -= 15
  }

  // Base score for being in the right calorie range
  if (meal.calories >= effectiveMinCalories && meal.calories <= effectiveMaxCalories) {
    score += 40
  }

  // Reward meals that fit well within remaining calories
  const caloriefit = meal.calories / remaining.calories
  if (caloriefit >= 0.5 && caloriefit <= 1.0) {
    score += 30 // Perfect fit
  } else if (caloriefit >= 0.3 && caloriefit <= 1.1) {
    score += 15 // Good fit
  }

  // Protein score - but cap reward based on what's remaining
  if (remaining.protein > 10) {
    const proteinFit = meal.protein / remaining.protein
    if (proteinFit >= 0.3 && proteinFit <= 1.0) {
      score += 25 // Good protein fit
    } else if (proteinFit > 1.0 && proteinFit <= 1.2) {
      score += 10 // Slightly over but acceptable
    }
  }

  // Protein efficiency bonus
  const proteinEfficiency = meal.calories > 0 ? meal.protein / meal.calories * 100 : 0
  if (proteinEfficiency >= 8) score += 15
  else if (proteinEfficiency >= 5) score += 10

  return Math.max(0, score)
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const lat = searchParams.get('lat')
    const lng = searchParams.get('lng')
    const sizeParam = searchParams.get('size')
    const size: 'light' | 'regular' | 'hearty' =
      sizeParam === 'light' || sizeParam === 'hearty' ? sizeParam : 'regular'

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    // Get user profile
    const profile = await prisma.profile.findUnique({
      where: { userId }
    })

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Get today's date range
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Get or calculate targets
    let targets = await prisma.dailyTarget.findFirst({
      where: { userId, date: today }
    })

    if (!targets) {
      const calculatedTargets = calculateTargets(
        profile.heightIn,
        profile.weightLb,
        profile.age || 27,
        profile.sex as 'male' | 'female' | 'other',
        profile.goal as 'recomp' | 'lean_bulk' | 'cut',
        profile.liftingDays,
        profile.stepsLevel as 'low' | 'med' | 'high'
      )
      targets = {
        id: '',
        userId,
        date: today,
        calories: calculatedTargets.calories,
        protein: calculatedTargets.protein,
        carbs: calculatedTargets.carbs,
        fat: calculatedTargets.fat
      }
    }

    // Get today's meal logs
    const todayLogs = await prisma.mealLog.findMany({
      where: {
        userId,
        datetime: { gte: today, lt: tomorrow }
      },
      include: {
        orderTemplate: true,
        foodCatalogItem: true
      }
    })

    // Calculate remaining macros
    let currentCalories = 0
    let currentProtein = 0
    let currentCarbs = 0
    let currentFat = 0

    todayLogs.forEach(log => {
      const item = log.orderTemplate || log.foodCatalogItem
      if (item) {
        currentCalories += item.calories * log.servings
        currentProtein += item.protein * log.servings
        currentCarbs += item.carbs * log.servings
        currentFat += item.fat * log.servings
      }
    })

    const remaining = {
      calories: Math.max(0, targets.calories - currentCalories),
      protein: Math.max(0, targets.protein - currentProtein),
      carbs: Math.max(0, targets.carbs - currentCarbs),
      fat: Math.max(0, targets.fat - currentFat)
    }

    // Determine meal time first (needed for scoring)
    const hour = new Date().getHours()
    let mealTime: 'breakfast' | 'lunch' | 'dinner' = 'dinner'
    if (hour < 11) mealTime = 'breakfast'
    else if (hour < 16) mealTime = 'lunch'

    // Find nearby restaurants if location provided
    let nearbyChains: string[] = []
    const chainDistances: Record<string, number> = {}
    const userLat = lat ? parseFloat(lat) : null
    const userLng = lng ? parseFloat(lng) : null

    if (userLat && userLng) {
      try {
        // Query Overpass for nearby restaurants
        const radiusMeters = 8000 // 5 miles
        const overpassQuery = `
          [out:json][timeout:10];
          (
            node["amenity"="restaurant"](around:${radiusMeters},${userLat},${userLng});
            node["amenity"="fast_food"](around:${radiusMeters},${userLat},${userLng});
          );
          out body;
        `

        const response = await fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: overpassQuery
        })

        if (response.ok) {
          const data = await response.json()

          // Process restaurants with distance
          data.elements.forEach((el: any) => {
            const name = el.tags?.name?.toLowerCase()
            if (!name || !el.lat || !el.lon) return

            const distance = calculateDistance(userLat, userLng, el.lat, el.lon)

            // Check if this is a known chain
            const matchedChain = KNOWN_CHAINS.find(chain => name.includes(chain))
            if (matchedChain) {
              // Store the closest distance for each chain
              if (!chainDistances[matchedChain] || distance < chainDistances[matchedChain]) {
                chainDistances[matchedChain] = Math.round(distance * 10) / 10 // Round to 1 decimal
              }
            }
          })

          nearbyChains = Object.keys(chainDistances)
        }
      } catch (error) {
        console.error('Failed to fetch nearby restaurants:', error)
      }
    }

    // If no nearby chains found, use popular defaults (no distance available)
    if (nearbyChains.length === 0) {
      nearbyChains = ['chipotle', 'cava', 'sweetgreen', 'chick-fil-a', 'subway', 'panera']
    }

    // Get meals from these chains
    const meals = await prisma.orderTemplate.findMany({
      where: {
        restaurantBrand: {
          in: nearbyChains.map(c => normalizeRestaurantName(c))
        }
      }
    })

    // Score and sort meals based on meal time appropriateness
    const scoredMeals = meals.map(meal => ({
      ...meal,
      score: scoreMeal(meal, remaining, mealTime, size)
    }))
    .filter(meal => meal.score > 0) // Remove snacks/inappropriate sized meals
    .sort((a, b) => b.score - a.score)

    // Get top 3 unique restaurants (don't suggest 3 meals from same place)
    const suggestions: any[] = []
    const usedRestaurants = new Set<string>()

    for (const meal of scoredMeals) {
      if (suggestions.length >= 3) break
      if (usedRestaurants.has(meal.restaurantBrand)) continue

      usedRestaurants.add(meal.restaurantBrand)
      const normalizedBrand = meal.restaurantBrand.toLowerCase().replace(/[^a-z]/g, '')
      const distance = chainDistances[normalizedBrand] || chainDistances[meal.restaurantBrand.toLowerCase()] || null
      suggestions.push({
        id: meal.id,
        name: meal.title,
        description: meal.description,
        restaurant: meal.restaurantBrand,
        calories: meal.calories,
        protein: meal.protein,
        carbs: meal.carbs,
        fat: meal.fat,
        score: meal.score,
        distance
      })
    }

    // If we don't have 3 yet, add more from same restaurants
    if (suggestions.length < 3) {
      for (const meal of scoredMeals) {
        if (suggestions.length >= 3) break
        if (suggestions.some(s => s.id === meal.id)) continue

        const normalizedBrand = meal.restaurantBrand.toLowerCase().replace(/[^a-z]/g, '')
        const distance = chainDistances[normalizedBrand] || chainDistances[meal.restaurantBrand.toLowerCase()] || null
        suggestions.push({
          id: meal.id,
          name: meal.title,
          description: meal.description,
          restaurant: meal.restaurantBrand,
          calories: meal.calories,
          protein: meal.protein,
          carbs: meal.carbs,
          fat: meal.fat,
          score: meal.score,
          distance
        })
      }
    }

    // Check if user is close to their goals
    const isNearGoal = remaining.calories < 300 ||
      (remaining.calories < 500 && remaining.protein < 15)

    return NextResponse.json({
      suggestions,
      remaining,
      mealTime,
      size,
      nearbyChains: nearbyChains.slice(0, 5),
      isNearGoal,
      message: isNearGoal
        ? `You're close to your goals! Only ${remaining.calories} cal and ${remaining.protein}g protein left.`
        : null
    })

  } catch (error) {
    console.error('Meal suggestions error:', error)
    return NextResponse.json(
      { error: 'Failed to generate suggestions', suggestions: [] },
      { status: 500 }
    )
  }
}
