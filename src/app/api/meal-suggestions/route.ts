import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateTargets, calculateDistance } from '@/lib/calculations'
import { KNOWN_CHAINS } from '@/lib/chains'
import { normalizeRestaurantName } from '@/lib/restaurant-matcher'

// Categorize chains by dining type and value
const TAKEOUT_FRIENDLY_CHAINS = [
  'chipotle', 'cava', 'sweetgreen', 'chick-fil-a', 'subway', 'panera',
  'shake shack', 'five guys', 'qdoba', 'moes', 'wingstop', 'raising canes',
  'tropical smoothie', 'jersey mikes', 'firehouse subs', 'potbelly',
  'noodles', 'panda express', 'zaxbys', 'popeyes', 'wendys', 'mcdonalds',
  'taco bell', 'del taco', 'in-n-out', 'whataburger', 'culvers', 'bojangles'
]

const DINE_IN_CHAINS = [
  'applebees', 'chilis', 'olive garden', 'red lobster', 'outback',
  'cheesecake factory', 'buffalo wild wings', 'tgifridays', 'red robin',
  'dennys', 'ihop', 'cracker barrel'
]

// Price tiers by chain ($ = under $10, $$ = $10-15, $$$ = $15-20, $$$$ = $20+)
const CHAIN_PRICE_TIERS: Record<string, { base: number; perCalorie: number }> = {
  // Budget fast food ($6-10)
  'mcdonalds': { base: 6, perCalorie: 0.003 },
  'wendys': { base: 6, perCalorie: 0.003 },
  'taco bell': { base: 5, perCalorie: 0.003 },
  'del taco': { base: 5, perCalorie: 0.003 },
  'popeyes': { base: 7, perCalorie: 0.003 },
  'bojangles': { base: 7, perCalorie: 0.003 },
  'subway': { base: 7, perCalorie: 0.004 },

  // Mid-tier fast casual ($10-14)
  'chipotle': { base: 9, perCalorie: 0.004 },
  'cava': { base: 10, perCalorie: 0.004 },
  'qdoba': { base: 9, perCalorie: 0.004 },
  'moes': { base: 9, perCalorie: 0.004 },
  'panda express': { base: 8, perCalorie: 0.004 },
  'chick-fil-a': { base: 8, perCalorie: 0.005 },
  'raising canes': { base: 9, perCalorie: 0.004 },
  'wingstop': { base: 10, perCalorie: 0.005 },
  'zaxbys': { base: 9, perCalorie: 0.004 },
  'jersey mikes': { base: 9, perCalorie: 0.005 },
  'firehouse subs': { base: 9, perCalorie: 0.005 },
  'potbelly': { base: 8, perCalorie: 0.004 },
  'noodles': { base: 9, perCalorie: 0.004 },

  // Premium fast casual ($12-18)
  'sweetgreen': { base: 12, perCalorie: 0.006 },
  'shake shack': { base: 11, perCalorie: 0.006 },
  'five guys': { base: 12, perCalorie: 0.005 },
  'in-n-out': { base: 8, perCalorie: 0.004 },
  'whataburger': { base: 8, perCalorie: 0.004 },
  'culvers': { base: 9, perCalorie: 0.004 },
  'panera': { base: 10, perCalorie: 0.005 },
  'tropical smoothie': { base: 9, perCalorie: 0.005 },

  // Casual dining ($14-25)
  'applebees': { base: 13, perCalorie: 0.005 },
  'chilis': { base: 13, perCalorie: 0.005 },
  'buffalo wild wings': { base: 14, perCalorie: 0.006 },
  'red robin': { base: 14, perCalorie: 0.005 },
  'tgifridays': { base: 14, perCalorie: 0.005 },
  'dennys': { base: 11, perCalorie: 0.004 },
  'ihop': { base: 11, perCalorie: 0.004 },
  'cracker barrel': { base: 12, perCalorie: 0.005 },
  'olive garden': { base: 15, perCalorie: 0.005 },
  'red lobster': { base: 18, perCalorie: 0.006 },
  'outback': { base: 16, perCalorie: 0.006 },
  'cheesecake factory': { base: 18, perCalorie: 0.006 }
}

// Estimate price based on restaurant and meal calories
function estimatePrice(restaurantBrand: string, calories: number): number {
  const normalized = restaurantBrand.toLowerCase().replace(/[^a-z\s]/g, '')

  // Find matching chain
  const matchedChain = Object.keys(CHAIN_PRICE_TIERS).find(chain =>
    normalized.includes(chain) || chain.includes(normalized)
  )

  if (matchedChain) {
    const tier = CHAIN_PRICE_TIERS[matchedChain]
    const estimated = tier.base + (calories * tier.perCalorie)
    return Math.round(estimated * 100) / 100
  }

  // Default pricing for unknown restaurants
  return Math.round((10 + calories * 0.005) * 100) / 100
}

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
    const diningParam = searchParams.get('dining')
    const dining: 'takeout' | 'dine-in' = diningParam === 'dine-in' ? 'dine-in' : 'takeout'

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

    // If no nearby chains found, use popular defaults based on dining mode
    if (nearbyChains.length === 0) {
      nearbyChains = dining === 'takeout'
        ? ['chipotle', 'cava', 'sweetgreen', 'chick-fil-a', 'subway', 'panera']
        : ['applebees', 'chilis', 'olive garden', 'buffalo wild wings', 'red robin', 'dennys']
    }

    // Filter and prioritize chains based on dining preference
    const preferredChains = dining === 'takeout' ? TAKEOUT_FRIENDLY_CHAINS : DINE_IN_CHAINS
    const otherChains = dining === 'takeout' ? DINE_IN_CHAINS : TAKEOUT_FRIENDLY_CHAINS

    // Sort nearby chains: preferred first, then others
    nearbyChains.sort((a, b) => {
      const aPreferred = preferredChains.some(c => a.includes(c))
      const bPreferred = preferredChains.some(c => b.includes(c))
      if (aPreferred && !bPreferred) return -1
      if (!aPreferred && bPreferred) return 1
      return 0
    })

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
      const estimatedPrice = estimatePrice(meal.restaurantBrand, meal.calories)
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
        distance,
        estimatedPrice
      })
    }

    // If we don't have 3 yet, add more from same restaurants
    if (suggestions.length < 3) {
      for (const meal of scoredMeals) {
        if (suggestions.length >= 3) break
        if (suggestions.some(s => s.id === meal.id)) continue

        const normalizedBrand = meal.restaurantBrand.toLowerCase().replace(/[^a-z]/g, '')
        const distance = chainDistances[normalizedBrand] || chainDistances[meal.restaurantBrand.toLowerCase()] || null
        const estimatedPrice = estimatePrice(meal.restaurantBrand, meal.calories)
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
          distance,
          estimatedPrice
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
      dining,
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
