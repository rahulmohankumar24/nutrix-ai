import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateTargets, calculateDistance } from '@/lib/calculations'
import { KNOWN_CHAINS } from '@/lib/chains'
import { normalizeRestaurantName } from '@/lib/restaurant-matcher'
import { getUserPatterns } from '@/lib/patterns/detector'
import {
  runMealAgent,
  getMealTimeFromHour,
  MealAgentContext,
  MealOption,
  UserPattern
} from '@/lib/meal-agents'
import { calculateRealisticMealTarget } from '@/lib/meal-distribution'
import { getUserDateStr, getDayBoundariesUTC, getUserHour } from '@/lib/timezone'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

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

// LLM-based meal finder for "Feast" mode
// Finds meals that hit the lunch or dinner goal (ignoring constraints)
async function findFeastMealsWithLLM(
  meals: Array<{ id: string; title: string; restaurantBrand: string; calories: number; protein: number; carbs: number; fat: number; description?: string }>,
  mealType: 'lunch' | 'dinner',
  targetCalories: number,
  targetProtein: number
): Promise<Array<{
  type: 'single' | 'combo'
  items: Array<{ id: string; title: string; restaurantBrand: string; calories: number; protein: number }>
  totalCalories: number
  totalProtein: number
  calorieFit: number
  proteinFit: number
  reasoning: string
}>> {
  if (!process.env.OPENAI_API_KEY || meals.length === 0) {
    return []
  }

  const mealsList = meals.slice(0, 40).map((m, i) =>
    `${i + 1}. [${m.id}] ${m.restaurantBrand} - ${m.title}: ${m.calories}cal, ${m.protein}g protein`
  ).join('\n')

  const goalDescription = mealType === 'lunch'
    ? 'Reach 66% of your daily targets by end of lunch'
    : 'Hit 100% of your remaining daily targets'

  const prompt = `You are a nutrition expert helping someone find a satisfying ${mealType} meal. This is FEAST MODE - find the best options to hit their ${mealType} goal, ignoring any dietary constraints.

${mealType.toUpperCase()} TARGET (aim for 90-110%):
- Calories: ${targetCalories}
- Protein: ${targetProtein}g
- Goal: ${goalDescription}

AVAILABLE MEALS:
${mealsList}

YOUR TASK:
Find meals that get close to the ${mealType} target. This is about having a satisfying meal, not about restrictions.
You can suggest:
1. Single substantial meals
2. Meal + side combos from the SAME restaurant
3. Two items from the same restaurant for a bigger feast

RULES:
- Find filling, satisfying options
- Prioritize hitting BOTH calories AND protein
- Going over is fine (up to 120%)
- Only combine items from the SAME restaurant
- Focus on the best 5-8 options with variety

Return ONLY valid JSON (no markdown):
{
  "combinations": [
    {
      "type": "single",
      "items": [
        {"id": "meal_id", "title": "Big Meal", "restaurantBrand": "Restaurant", "calories": 800, "protein": 50}
      ],
      "totalCalories": 800,
      "totalProtein": 50,
      "calorieFit": 100,
      "proteinFit": 100,
      "reasoning": "Hits your ${mealType} target perfectly"
    }
  ]
}`

  try {
    const completion = await openai.responses.create({
      model: 'gpt-5.2',
      input: [{ role: 'user', content: prompt }]
    })

    const response = completion.output_text
    if (!response) {
      return []
    }

    let jsonStr = response.trim()
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    }

    const parsed = JSON.parse(jsonStr)
    return parsed.combinations || []
  } catch (error) {
    console.error('LLM meal combination error:', error)
    return []
  }
}

// Distance thresholds by travel mode (in miles)
const TRAVEL_DISTANCES = {
  walk: 1.0,   // ~20 min walk
  drive: 8.0   // ~15-20 min drive
}

// Restaurants with ingredient data for dynamic meal building
const RESTAURANTS_WITH_INGREDIENTS = ['chipotle', 'cava', 'sweetgreen', 'panera', 'panda express']

// Generate dynamic meals from ingredients that hit targets
async function generateDynamicMeals(
  restaurantBrand: string,
  remaining: { calories: number; protein: number; carbs: number; fat: number },
  mealTime: 'breakfast' | 'lunch' | 'dinner',
  targetCalories: number,
  targetProtein: number
): Promise<Array<{
  id: string
  title: string
  description: string
  restaurantBrand: string
  calories: number
  protein: number
  carbs: number
  fat: number
  isDynamic: boolean
  buildInstructions?: string
}>> {
  // Get ingredients for this restaurant
  const ingredients = await prisma.foodCatalogItem.findMany({
    where: {
      source: 'restaurant',
      tags: { contains: restaurantBrand.toLowerCase() }
    }
  })

  if (ingredients.length < 3) return []

  // Categorize ingredients
  const categorized: Record<string, typeof ingredients> = {
    protein: [],
    base: [],
    vegetables: [],
    sauces: [],
    toppings: [],
    other: []
  }

  ingredients.forEach(ing => {
    const name = ing.name.toLowerCase()
    if (name.includes('chicken') || name.includes('beef') || name.includes('steak') ||
        name.includes('carnitas') || name.includes('barbacoa') || name.includes('lamb') ||
        name.includes('salmon') || name.includes('tofu') || name.includes('falafel')) {
      categorized.protein.push(ing)
    } else if (name.includes('rice') || name.includes('quinoa') || name.includes('tortilla') ||
               name.includes('bread') || name.includes('pita') || name.includes('noodle')) {
      categorized.base.push(ing)
    } else if (name.includes('bean') || name.includes('lettuce') || name.includes('tomato') ||
               name.includes('pepper') || name.includes('onion') || name.includes('corn') ||
               name.includes('vegetable') || name.includes('broccoli') || name.includes('greens')) {
      categorized.vegetables.push(ing)
    } else if (name.includes('salsa') || name.includes('sauce') || name.includes('dressing') ||
               name.includes('hummus') || name.includes('tzatziki')) {
      categorized.sauces.push(ing)
    } else if (name.includes('cheese') || name.includes('guacamole') || name.includes('guac') ||
               name.includes('sour cream') || name.includes('avocado')) {
      categorized.toppings.push(ing)
    } else {
      categorized.other.push(ing)
    }
  })

  // Skip if missing key categories
  if (categorized.protein.length === 0 || categorized.base.length === 0) return []

  const meals: Array<{
    id: string
    title: string
    description: string
    restaurantBrand: string
    calories: number
    protein: number
    carbs: number
    fat: number
    isDynamic: boolean
    buildInstructions?: string
  }> = []

  // Find best protein option
  const bestProtein = categorized.protein.sort((a, b) => b.protein - a.protein)[0]
  const secondProtein = categorized.protein.sort((a, b) => b.protein - a.protein)[1]
  const bestBase = categorized.base[0]

  // Generate 4 meal variations: Target, Protein-Packed, Max, Feast
  // Include a "Feast" option for high calorie targets
  const variations = [
    { name: 'Target', doubleProtein: false, addExtras: false, doubleBase: false, allToppings: false },
    { name: 'Protein-Packed', doubleProtein: true, addExtras: false, doubleBase: false, allToppings: false },
    { name: 'Max', doubleProtein: true, addExtras: true, doubleBase: true, allToppings: false },
    { name: 'Feast', doubleProtein: true, addExtras: true, doubleBase: true, allToppings: true }
  ]

  for (const variation of variations) {
    let totalCal = 0
    let totalProtein = 0
    let totalCarbs = 0
    let totalFat = 0
    const parts: string[] = []
    const instructions: string[] = []

    // Add base (double for max/feast)
    if (bestBase) {
      const baseMultiplier = variation.doubleBase ? 2 : 1
      totalCal += bestBase.calories * baseMultiplier
      totalProtein += bestBase.protein * baseMultiplier
      totalCarbs += bestBase.carbs * baseMultiplier
      totalFat += bestBase.fat * baseMultiplier
      parts.push(variation.doubleBase ? `double ${bestBase.name}` : bestBase.name)
      if (variation.doubleBase) instructions.push('Ask for double rice/base')
    }

    // Add protein (double if specified)
    if (bestProtein) {
      const proteinMultiplier = variation.doubleProtein ? 2 : 1
      totalCal += bestProtein.calories * proteinMultiplier
      totalProtein += bestProtein.protein * proteinMultiplier
      totalCarbs += bestProtein.carbs * proteinMultiplier
      totalFat += bestProtein.fat * proteinMultiplier
      parts.push(variation.doubleProtein ? `double ${bestProtein.name}` : bestProtein.name)
      if (variation.doubleProtein) instructions.push('Order double protein')
    }

    // Add vegetables (always include 2 for variety)
    const veggies = categorized.vegetables.slice(0, 2)
    for (const veggie of veggies) {
      totalCal += veggie.calories
      totalProtein += veggie.protein
      totalCarbs += veggie.carbs
      totalFat += veggie.fat
      parts.push(veggie.name)
    }

    // Add toppings for max/feast variations
    if (variation.addExtras && categorized.toppings.length > 0) {
      const toppingsToAdd = variation.allToppings
        ? categorized.toppings // All toppings for feast
        : categorized.toppings.slice(0, 2) // Just 2 for max

      for (const topping of toppingsToAdd) {
        totalCal += topping.calories
        totalProtein += topping.protein
        totalCarbs += topping.carbs
        totalFat += topping.fat
        parts.push(topping.name)
        if (topping.name.toLowerCase().includes('guac')) {
          instructions.push('Add guacamole')
        } else if (topping.name.toLowerCase().includes('cheese')) {
          instructions.push('Add cheese')
        } else if (topping.name.toLowerCase().includes('sour cream')) {
          instructions.push('Add sour cream')
        }
      }
    }

    // For feast, also add sauces
    if (variation.allToppings && categorized.sauces.length > 0) {
      for (const sauce of categorized.sauces.slice(0, 2)) {
        totalCal += sauce.calories
        totalProtein += sauce.protein
        totalCarbs += sauce.carbs
        totalFat += sauce.fat
        parts.push(sauce.name)
      }
    }

    // Check if this variation is close enough to target to be useful
    const calFit = totalCal / targetCalories
    const proFit = totalProtein / targetProtein

    // More flexible range - include more options
    // Low range: 40% (for showing lighter options)
    // High range: 150% (for showing bigger options)
    if (calFit >= 0.4 && calFit <= 1.5 && proFit >= 0.4 && proFit <= 1.8) {
      const mealName = mealTime.charAt(0).toUpperCase() + mealTime.slice(1)
      meals.push({
        id: `dynamic_${restaurantBrand}_${variation.name.toLowerCase().replace(/[^a-z]/g, '')}`,
        title: variation.name === 'Target' ? `${mealName} Bowl` :
               variation.name === 'Feast' ? `${variation.name} Combo` :
               `${variation.name} ${mealName} Bowl`,
        description: parts.join(', '),
        restaurantBrand: restaurantBrand.charAt(0).toUpperCase() + restaurantBrand.slice(1),
        calories: Math.round(totalCal),
        protein: Math.round(totalProtein),
        carbs: Math.round(totalCarbs),
        fat: Math.round(totalFat),
        isDynamic: true,
        buildInstructions: instructions.length > 0 ? instructions.join('. ') : undefined
      })
    }
  }

  return meals
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
    const travelParam = searchParams.get('travel')
    const travelMode: 'walk' | 'drive' = travelParam === 'walk' ? 'walk' : 'drive'
    const maxDistance = TRAVEL_DISTANCES[travelMode]
    const timezone = searchParams.get('timezone') || 'America/Los_Angeles'
    const currentHourParam = searchParams.get('currentHour')
    const limitParam = searchParams.get('limit')
    const suggestionLimit = limitParam ? Math.min(parseInt(limitParam), 12) : 3
    const finalResort = searchParams.get('finalResort') === 'true'
    const scheduledMeal = searchParams.get('scheduledMeal') as 'breakfast' | 'lunch' | 'dinner' | null

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    // Use passed currentHour or calculate from timezone
    const currentHour = currentHourParam
      ? parseInt(currentHourParam)
      : getUserHour(timezone)

    // Get user profile
    const profile = await prisma.profile.findUnique({
      where: { userId }
    })

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Get today's date range in user's timezone
    const userDateStr = getUserDateStr(timezone)
    const { startOfDay, endOfDay } = getDayBoundariesUTC(userDateStr, timezone)
    // For DailyTarget date field (stored as date without time)
    const today = new Date(`${userDateStr}T00:00:00.000Z`)

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
        datetime: { gte: startOfDay, lte: endOfDay }
      },
      include: {
        orderTemplate: true,
        foodCatalogItem: true
      }
    })

    // Calculate current intake and remaining macros
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

    // Determine meal time using new agent system
    const mealTime = scheduledMeal || getMealTimeFromHour(currentHour)

    // Fetch user patterns for personalized recommendations
    const patterns = await getUserPatterns(userId)
    const restaurantBoosts: Record<string, number> = {}
    const restaurantReasons: Record<string, string> = {}

    // Process restaurant patterns
    for (const pattern of patterns) {
      if (pattern.patternType === 'restaurant') {
        const value = pattern.patternValue as Record<string, unknown>
        const restaurantKey = pattern.patternKey
        const successRate = Math.round((value.successRate as number || 0) * 100)

        // High success restaurants get a significant boost
        if (value.isHighSuccess && (value.successRate as number) >= 0.7) {
          restaurantBoosts[restaurantKey] = 25
          restaurantReasons[restaurantKey] = `${successRate}% success rate here`
        } else if ((value.successRate as number) >= 0.5) {
          restaurantBoosts[restaurantKey] = 15
          restaurantReasons[restaurantKey] = `You do well here (${successRate}% on track)`
        }

        // If this is the user's typical day for this restaurant, extra boost
        if (value.hasDayPreference) {
          const todayDayNum = new Date().getDay()
          if (value.dominantDay === todayDayNum) {
            restaurantBoosts[restaurantKey] = (restaurantBoosts[restaurantKey] || 0) + 10
            const dayName = value.dominantDayName as string
            restaurantReasons[restaurantKey] = `Your ${dayName} spot`
          }
        }
      }
    }

    const hasPersonalizedData = Object.keys(restaurantBoosts).length > 0

    // Find nearby restaurants if location provided
    let nearbyChains: string[] = []
    const chainDistances: Record<string, number> = {}
    const userLat = lat ? parseFloat(lat) : null
    const userLng = lng ? parseFloat(lng) : null
    let locationVerified = false

    if (userLat && userLng) {
      try {
        // Query Overpass for nearby restaurants - use max drive distance for query, filter later
        const radiusMeters = Math.round(TRAVEL_DISTANCES.drive * 1609) // Convert miles to meters
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
          locationVerified = true

          // Process restaurants with distance - ONLY include those within travel mode distance
          data.elements.forEach((el: any) => {
            const name = el.tags?.name?.toLowerCase()
            if (!name || !el.lat || !el.lon) return

            const distance = calculateDistance(userLat, userLng, el.lat, el.lon)

            // IMPORTANT: Only include restaurants within the user's travel mode distance
            if (distance > maxDistance) return

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

    // Track if we had location but found no nearby restaurants
    const noNearbyRestaurants = locationVerified && nearbyChains.length === 0

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

    // If no nearby chains found (location failed or no results), use popular chains as fallback
    const chainsToQuery = nearbyChains.length > 0
      ? nearbyChains
      : preferredChains.slice(0, 10) // Fallback to top 10 preferred chains

    // Get meals from these chains
    const meals = await prisma.orderTemplate.findMany({
      where: {
        restaurantBrand: {
          in: chainsToQuery.map(c => normalizeRestaurantName(c))
        }
      }
    })

    // Prepare meals for agent with pattern boost info
    const availableMeals: MealOption[] = meals.map(meal => {
      const normalizedBrand = meal.restaurantBrand.toLowerCase().replace(/[^a-z]/g, '_')
      const patternBoost = restaurantBoosts[normalizedBrand] || 0
      return {
        id: meal.id,
        title: meal.title,
        description: meal.description || undefined,
        restaurantBrand: meal.restaurantBrand,
        calories: meal.calories,
        protein: meal.protein,
        carbs: meal.carbs,
        fat: meal.fat,
        patternBoosted: patternBoost > 0
      }
    })

    // Calculate meal target for dynamic meal generation
    const mealDistribution = calculateRealisticMealTarget(
      mealTime,
      remaining,
      undefined // No user schedule
    )

    // Generate dynamic meals from ingredient data for nearby restaurants
    const restaurantsWithIngredients = chainsToQuery.filter(chain =>
      RESTAURANTS_WITH_INGREDIENTS.some(r => chain.toLowerCase().includes(r))
    )

    // Generate dynamic meals for up to 3 restaurants
    const dynamicMealPromises = restaurantsWithIngredients.slice(0, 3).map(restaurant =>
      generateDynamicMeals(
        restaurant,
        remaining,
        mealTime,
        mealDistribution.targetCalories,
        mealDistribution.targetProtein
      )
    )

    const dynamicMealsResults = await Promise.all(dynamicMealPromises)
    const allDynamicMeals = dynamicMealsResults.flat()

    // Add dynamic meals to available meals
    for (const dynamicMeal of allDynamicMeals) {
      const normalizedBrand = dynamicMeal.restaurantBrand.toLowerCase().replace(/[^a-z]/g, '_')
      const patternBoost = restaurantBoosts[normalizedBrand] || 0
      availableMeals.push({
        id: dynamicMeal.id,
        title: dynamicMeal.title,
        description: dynamicMeal.description + (dynamicMeal.buildInstructions ? ` | HOW TO ORDER: ${dynamicMeal.buildInstructions}` : ''),
        restaurantBrand: dynamicMeal.restaurantBrand,
        calories: dynamicMeal.calories,
        protein: dynamicMeal.protein,
        carbs: dynamicMeal.carbs,
        fat: dynamicMeal.fat,
        patternBoosted: patternBoost > 0
      })
    }

    console.log(`Generated ${allDynamicMeals.length} dynamic meals from ${restaurantsWithIngredients.length} restaurants`)

    // FEAST MODE: Find meals to hit lunch or dinner goal (ignoring constraints)
    if (finalResort) {
      // Use scheduledMeal or determine from time
      const feastMealType: 'lunch' | 'dinner' = (scheduledMeal === 'lunch' || scheduledMeal === 'dinner')
        ? scheduledMeal
        : (mealTime === 'lunch' ? 'lunch' : 'dinner')

      // Calculate targets dynamically based on meal type:
      // - Lunch: aim to reach 66% of daily total
      // - Dinner: aim for 100% of remaining
      let feastTargetCalories: number
      let feastTargetProtein: number

      if (feastMealType === 'lunch') {
        // Lunch target: reach 66% of daily by end of meal
        const lunchMilestone = 0.66
        feastTargetCalories = Math.max(0, Math.round((targets.calories * lunchMilestone) - currentCalories))
        feastTargetProtein = Math.max(0, Math.round((targets.protein * lunchMilestone) - currentProtein))
      } else {
        // Dinner target: 100% of remaining
        feastTargetCalories = remaining.calories
        feastTargetProtein = remaining.protein
      }

      const combinations = await findFeastMealsWithLLM(
        availableMeals.map(m => ({
          id: m.id,
          title: m.title,
          restaurantBrand: m.restaurantBrand,
          calories: m.calories,
          protein: m.protein,
          carbs: m.carbs,
          fat: m.fat,
          description: m.description
        })),
        feastMealType,
        feastTargetCalories,
        feastTargetProtein
      )

      // Format combinations as suggestions
      const comboSuggestions = combinations.map((combo, index) => {
        const primaryItem = combo.items[0]
        const normalizedBrand = primaryItem?.restaurantBrand.toLowerCase().replace(/[^a-z]/g, '')
        const distance = chainDistances[normalizedBrand] || null

        return {
          id: `combo-${index}`,
          name: combo.items.length > 1
            ? `${combo.items[0].title} + ${combo.items[1].title}`
            : combo.items[0].title,
          description: combo.reasoning,
          restaurant: primaryItem?.restaurantBrand || 'Unknown',
          calories: combo.totalCalories,
          protein: combo.totalProtein,
          carbs: 0, // Not tracked in combos
          fat: 0,
          score: Math.round((combo.calorieFit + combo.proteinFit) / 2),
          distance,
          estimatedPrice: null,
          isPersonalized: false,
          personalizedReason: null,
          aiReasoning: `${combo.calorieFit}% calories, ${combo.proteinFit}% protein - ${combo.reasoning}`,
          isAIScored: true,
          isFinalResort: true,
          comboItems: combo.items,
          calorieFit: combo.calorieFit,
          proteinFit: combo.proteinFit
        }
      })

      return NextResponse.json({
        suggestions: comboSuggestions,
        remaining,
        mealTime: feastMealType,
        agentType: feastMealType,
        urgencyLevel: 'moderate',
        size,
        dining,
        travelMode,
        maxDistance,
        nearbyChains: nearbyChains.slice(0, 5),
        goalAchieved: false,
        isNearGoal: false,
        hasPersonalizedData,
        noNearbyRestaurants,
        message: `Feast mode: ${combinations.length} ${feastMealType} options to hit your goal`,
        aiScoringUsed: true,
        isFinalResortMode: true,
        targetForMeal: {
          calories: feastTargetCalories,
          protein: feastTargetProtein
        },
        progressToGoal: {
          caloriesPct: Math.round((currentCalories / targets.calories) * 100),
          proteinPct: Math.round((currentProtein / targets.protein) * 100)
        }
      })
    }

    // Convert patterns to agent format
    const userPatterns: UserPattern[] = patterns.map(p => ({
      patternType: p.patternType,
      patternKey: p.patternKey,
      patternValue: p.patternValue as Record<string, unknown>
    }))

    // Build agent context
    const agentContext: MealAgentContext = {
      userId,
      dailyTargets: {
        calories: targets.calories,
        protein: targets.protein,
        carbs: targets.carbs,
        fat: targets.fat
      },
      currentIntake: {
        calories: Math.round(currentCalories),
        protein: Math.round(currentProtein),
        carbs: Math.round(currentCarbs),
        fat: Math.round(currentFat)
      },
      remaining,
      currentHour,
      size,
      availableMeals,
      userPatterns
    }

    // Run the appropriate meal agent
    const agentResult = await runMealAgent(agentContext)

    // Enhance suggestions with distance, price, and personalization info
    const enhancedSuggestions = agentResult.suggestions.map(suggestion => {
      const normalizedBrand = suggestion.restaurant.toLowerCase().replace(/[^a-z]/g, '')
      const brandKey = suggestion.restaurant.toLowerCase().replace(/[^a-z]/g, '_')
      const distance = chainDistances[normalizedBrand] || chainDistances[suggestion.restaurant.toLowerCase()] || null
      const estimatedPriceValue = estimatePrice(suggestion.restaurant, suggestion.calories)
      const personalizedReason = restaurantReasons[brandKey] || null

      return {
        ...suggestion,
        distance,
        estimatedPrice: estimatedPriceValue,
        isPersonalized: suggestion.isPersonalized || !!personalizedReason,
        personalizedReason
      }
    })

    // Apply restaurant variety limits
    const diverseSuggestions: typeof enhancedSuggestions = []
    const maxPerRestaurant = suggestionLimit > 3 ? 2 : 1
    const restaurantCounts: Record<string, number> = {}

    for (const suggestion of enhancedSuggestions) {
      if (diverseSuggestions.length >= suggestionLimit) break

      const count = restaurantCounts[suggestion.restaurant] || 0
      if (count >= maxPerRestaurant) continue

      restaurantCounts[suggestion.restaurant] = count + 1
      diverseSuggestions.push(suggestion)
    }

    // If we don't have enough yet, add more (relaxing restaurant limit)
    if (diverseSuggestions.length < suggestionLimit) {
      for (const suggestion of enhancedSuggestions) {
        if (diverseSuggestions.length >= suggestionLimit) break
        if (diverseSuggestions.some(s => s.id === suggestion.id)) continue
        diverseSuggestions.push(suggestion)
      }
    }

    // Check if user achieved their goals or is close
    const goalAchieved = remaining.calories <= 50 && remaining.protein <= 5
    const isNearGoal = !goalAchieved && (remaining.calories < 300 ||
      (remaining.calories < 500 && remaining.protein < 15))

    // Build appropriate message
    let message = agentResult.message
    if (noNearbyRestaurants) {
      message = travelMode === 'walk'
        ? `No restaurants found within walking distance (${maxDistance} mi). Try switching to drive mode.`
        : `No known restaurant chains found within ${maxDistance} miles. Try the restaurant search to find local spots.`
    } else if (goalAchieved) {
      message = `Daily targets reached.`
    } else if (isNearGoal) {
      message = `Almost there — ${remaining.calories} cal and ${remaining.protein}g protein remaining.`
    }

    return NextResponse.json({
      suggestions: diverseSuggestions,
      remaining,
      mealTime,
      agentType: agentResult.agentType,
      urgencyLevel: agentResult.urgencyLevel,
      size,
      dining,
      travelMode,
      maxDistance,
      nearbyChains: nearbyChains.slice(0, 5),
      goalAchieved,
      isNearGoal,
      hasPersonalizedData,
      noNearbyRestaurants,
      message,
      aiScoringUsed: diverseSuggestions.some(s => s.isAIScored),
      targetForMeal: agentResult.targetForMeal,
      progressToGoal: agentResult.progressToGoal,
      mealMilestone: agentResult.mealMilestone
    })

  } catch (error) {
    console.error('Meal suggestions error:', error)
    return NextResponse.json(
      { error: 'Failed to generate suggestions', suggestions: [] },
      { status: 500 }
    )
  }
}
