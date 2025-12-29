import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateTargets, calculateDistance } from '@/lib/calculations'
import { KNOWN_CHAINS } from '@/lib/chains'
import { normalizeRestaurantName } from '@/lib/restaurant-matcher'
import { getUserPatterns } from '@/lib/patterns/detector'
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

// LLM-based meal scoring for intelligent ranking
async function scoreMealsWithLLM(
  meals: Array<{ id: string; title: string; restaurantBrand: string; calories: number; protein: number; carbs: number; fat: number; description?: string }>,
  remaining: { calories: number; protein: number; carbs: number; fat: number },
  mealTime: 'breakfast' | 'lunch' | 'dinner',
  size: 'light' | 'regular' | 'hearty',
  currentHour: number
): Promise<Array<{ id: string; score: number; reasoning: string }>> {
  if (!process.env.OPENAI_API_KEY || meals.length === 0) {
    // Fallback to algorithmic scoring
    return meals.map(meal => ({
      id: meal.id,
      score: 50,
      reasoning: 'Algorithmic fallback'
    }))
  }

  // Limit meals to top candidates for LLM (cost/speed optimization)
  const mealsForLLM = meals.slice(0, 25)

  const mealsList = mealsForLLM.map((m, i) =>
    `${i + 1}. [${m.id}] ${m.restaurantBrand} - ${m.title}: ${m.calories}cal, ${m.protein}g protein, ${m.carbs}g carbs, ${m.fat}g fat`
  ).join('\n')

  // Calculate how aggressive to be based on time
  const isLateNight = currentHour >= 20
  const isDinner = mealTime === 'dinner' || currentHour >= 17
  const urgencyLevel = isLateNight ? 'CRITICAL' : isDinner ? 'HIGH' : 'MODERATE'

  // Calculate target percentages
  let targetPct = 0.5
  if (mealTime === 'lunch') targetPct = 0.55
  if (mealTime === 'dinner') targetPct = 0.85
  if (isLateNight) targetPct = 0.95
  if (size === 'hearty') targetPct = Math.min(1.0, targetPct + 0.15)

  const targetCalories = Math.round(remaining.calories * targetPct)
  const targetProtein = Math.round(remaining.protein * targetPct)

  const prompt = `You are a nutrition coach helping users hit their daily macro targets. Score these restaurant meals.

USER'S SITUATION:
- Remaining today: ${remaining.calories} calories, ${remaining.protein}g protein
- Current time: ${currentHour}:00 (${mealTime})
- Meal size preference: ${size}
- Target for this meal: ~${targetCalories} calories, ~${targetProtein}g protein
- Urgency: ${urgencyLevel} - ${isLateNight ? 'This is their LAST chance to hit targets today!' : isDinner ? 'Dinner time - need to get close to targets' : 'Earlier in day but should stay on track'}

AVAILABLE MEALS:
${mealsList}

SCORING RULES:
1. Score 0-100 based on how well the meal helps hit remaining targets
2. ${urgencyLevel === 'CRITICAL' ? 'CRITICAL: Meals MUST hit 85-100% of remaining targets to score above 80' : urgencyLevel === 'HIGH' ? 'Meals should hit 70-100% of remaining targets for high scores' : 'Moderate urgency - meals hitting 50%+ of targets score well'}
3. BOTH calories AND protein matter equally - a meal that hits protein but misses calories (or vice versa) should NOT score above 75
4. High-protein options (like double meat, extra chicken) are preferred when protein targets are high
5. Penalize meals that would leave significant macros on the table at dinner time

Return ONLY valid JSON array (no markdown, no explanation):
[{"id":"meal_id","score":85,"reasoning":"Brief reason"},...]

Return the top 8 highest scoring meals, sorted by score descending.`

  try {
    const completion = await openai.responses.create({
      model: "gpt-5.2",
      input: [{ role: "user", content: prompt }]
    })

    const response = completion.output_text
    if (!response) {
      throw new Error('No response from LLM')
    }

    // Parse JSON response (handle potential markdown wrapping)
    let jsonStr = response.trim()
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    }

    const parsed = JSON.parse(jsonStr) as Array<{ id: string; score: number; reasoning: string }>
    return parsed
  } catch (error) {
    console.error('LLM meal scoring error:', error)
    // Return empty array to trigger fallback
    return []
  }
}

// LLM-based meal combination finder for "final resort" mode
// Finds meal + side combos that hit 95%+ of remaining targets
async function findMealCombinationsWithLLM(
  meals: Array<{ id: string; title: string; restaurantBrand: string; calories: number; protein: number; carbs: number; fat: number; description?: string }>,
  remaining: { calories: number; protein: number; carbs: number; fat: number }
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

  const prompt = `You are a nutrition expert. The user MUST hit their remaining macros today - this is their FINAL RESORT.

USER'S REMAINING TARGETS (must hit 95%+):
- Calories: ${remaining.calories}
- Protein: ${remaining.protein}g

AVAILABLE MEALS/SIDES:
${mealsList}

YOUR TASK:
Find the BEST meal combinations that get as close as possible to 95-105% of BOTH targets.
You can suggest:
1. Single meals that hit both targets
2. Meal + side combos from the SAME restaurant
3. Two items from the same restaurant

RULES:
- Prioritize hitting BOTH calories AND protein (95%+ each)
- Only combine items from the SAME restaurant
- Going slightly over (up to 110%) is acceptable
- Focus on the best 3-5 options

Return ONLY valid JSON (no markdown):
{
  "combinations": [
    {
      "type": "combo",
      "items": [
        {"id": "meal_id_1", "title": "Main Meal", "restaurantBrand": "Restaurant", "calories": 800, "protein": 50},
        {"id": "meal_id_2", "title": "Side Item", "restaurantBrand": "Restaurant", "calories": 200, "protein": 15}
      ],
      "totalCalories": 1000,
      "totalProtein": 65,
      "calorieFit": 95,
      "proteinFit": 98,
      "reasoning": "Bowl + side hits both targets perfectly"
    }
  ]
}`

  try {
    const completion = await openai.responses.create({
      model: "gpt-5.2",
      input: [{ role: "user", content: prompt }]
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

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    // Use passed currentHour or calculate from timezone
    const currentHour = currentHourParam
      ? parseInt(currentHourParam)
      : new Date(new Date().toLocaleString('en-US', { timeZone: timezone })).getHours()

    // Get user profile
    const profile = await prisma.profile.findUnique({
      where: { userId }
    })

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Get today's date range in user's timezone
    const now = new Date()
    const userDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }))
    const today = new Date(userDate.getFullYear(), userDate.getMonth(), userDate.getDate())
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

    // Check if user scheduled a specific meal time
    const scheduledMeal = searchParams.get('scheduledMeal') as 'breakfast' | 'lunch' | 'dinner' | null

    // Determine meal time from scheduled meal or passed hour (needed for scoring)
    let mealTime: 'breakfast' | 'lunch' | 'dinner' = 'dinner'
    if (scheduledMeal) {
      // Use the explicitly scheduled meal time
      mealTime = scheduledMeal
    } else if (currentHour < 11) {
      mealTime = 'breakfast'
    } else if (currentHour < 16) {
      mealTime = 'lunch'
    }

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
    // This ensures users always see suggestions even if location services fail
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

    // Prepare all meals for LLM scoring (no algorithmic pre-filter)
    const allMeals = meals.map(meal => {
      const normalizedBrand = meal.restaurantBrand.toLowerCase().replace(/[^a-z]/g, '_')
      const patternBoost = restaurantBoosts[normalizedBrand] || 0
      return {
        ...meal,
        patternBoosted: patternBoost > 0
      }
    })

    // FINAL RESORT MODE: Find meal combinations that hit 95%+ of targets
    if (finalResort) {
      const combinations = await findMealCombinationsWithLLM(
        allMeals.map(m => ({
          id: m.id,
          title: m.title,
          restaurantBrand: m.restaurantBrand,
          calories: m.calories,
          protein: m.protein,
          carbs: m.carbs,
          fat: m.fat,
          description: m.description || undefined
        })),
        remaining
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
        mealTime,
        size,
        dining,
        travelMode,
        maxDistance,
        nearbyChains: nearbyChains.slice(0, 5),
        goalAchieved: false,
        isNearGoal: false,
        hasPersonalizedData,
        noNearbyRestaurants,
        message: `Final Resort: ${combinations.length} meal combos found to hit your targets`,
        aiScoringUsed: true,
        isFinalResortMode: true,
        targetForMeal: {
          calories: remaining.calories,
          protein: remaining.protein
        }
      })
    }

    // Send all meals to LLM for intelligent scoring (limit to 50 for token efficiency)
    const mealsForLLM = allMeals.slice(0, 50)

    const llmScores = await scoreMealsWithLLM(
      mealsForLLM.map(m => ({
        id: m.id,
        title: m.title,
        restaurantBrand: m.restaurantBrand,
        calories: m.calories,
        protein: m.protein,
        carbs: m.carbs,
        fat: m.fat,
        description: m.description || undefined
      })),
      remaining,
      mealTime,
      size,
      currentHour
    )

    // Merge LLM scores with meal data
    let scoredMeals: Array<typeof allMeals[0] & { llmScore?: number; llmReasoning?: string; score: number }>

    if (llmScores.length > 0) {
      // Create a map of LLM scores
      const llmScoreMap = new Map(llmScores.map(s => [s.id, s]))

      // Sort by LLM score
      scoredMeals = mealsForLLM.map(meal => ({
        ...meal,
        llmScore: llmScoreMap.get(meal.id)?.score,
        llmReasoning: llmScoreMap.get(meal.id)?.reasoning,
        score: llmScoreMap.get(meal.id)?.score ?? 0
      }))
      .filter(meal => meal.score > 0)
      .sort((a, b) => b.score - a.score)
    } else {
      // Fallback: basic calorie/protein ratio scoring if LLM fails
      scoredMeals = mealsForLLM.map(meal => {
        const calRatio = remaining.calories > 0 ? meal.calories / remaining.calories : 0
        const proRatio = remaining.protein > 0 ? meal.protein / remaining.protein : 0
        const score = Math.round((calRatio + proRatio) * 50)
        return { ...meal, score, llmScore: undefined, llmReasoning: undefined }
      })
      .filter(meal => meal.score > 0)
      .sort((a, b) => b.score - a.score)
    }

    // Get top suggestions with variety from different restaurants
    const suggestions: any[] = []
    const maxPerRestaurant = suggestionLimit > 3 ? 2 : 1
    const restaurantCounts: Record<string, number> = {}

    for (const meal of scoredMeals) {
      if (suggestions.length >= suggestionLimit) break

      const count = restaurantCounts[meal.restaurantBrand] || 0
      if (count >= maxPerRestaurant) continue

      restaurantCounts[meal.restaurantBrand] = count + 1

      const normalizedBrand = meal.restaurantBrand.toLowerCase().replace(/[^a-z]/g, '')
      const brandKey = meal.restaurantBrand.toLowerCase().replace(/[^a-z]/g, '_')
      const distance = chainDistances[normalizedBrand] || chainDistances[meal.restaurantBrand.toLowerCase()] || null
      const estimatedPrice = estimatePrice(meal.restaurantBrand, meal.calories)
      const personalizedReason = restaurantReasons[brandKey] || null

      suggestions.push({
        id: meal.id,
        name: meal.title,
        description: meal.description,
        restaurant: meal.restaurantBrand,
        calories: meal.calories,
        protein: meal.protein,
        carbs: meal.carbs,
        fat: meal.fat,
        score: meal.llmScore ?? meal.score,
        aiReasoning: meal.llmReasoning || null, // Include LLM's reasoning
        distance,
        estimatedPrice,
        isPersonalized: meal.patternBoosted || false,
        personalizedReason,
        isAIScored: !!meal.llmScore
      })
    }

    // If we don't have enough yet, add more (relaxing restaurant limit)
    if (suggestions.length < suggestionLimit) {
      for (const meal of scoredMeals) {
        if (suggestions.length >= suggestionLimit) break
        if (suggestions.some(s => s.id === meal.id)) continue

        const normalizedBrand = meal.restaurantBrand.toLowerCase().replace(/[^a-z]/g, '')
        const brandKey = meal.restaurantBrand.toLowerCase().replace(/[^a-z]/g, '_')
        const distance = chainDistances[normalizedBrand] || chainDistances[meal.restaurantBrand.toLowerCase()] || null
        const estimatedPrice = estimatePrice(meal.restaurantBrand, meal.calories)
        const personalizedReason = restaurantReasons[brandKey] || null

        suggestions.push({
          id: meal.id,
          name: meal.title,
          description: meal.description,
          restaurant: meal.restaurantBrand,
          calories: meal.calories,
          protein: meal.protein,
          carbs: meal.carbs,
          fat: meal.fat,
          score: meal.llmScore ?? meal.score,
          aiReasoning: meal.llmReasoning || null,
          distance,
          estimatedPrice,
          isPersonalized: meal.patternBoosted || false,
          personalizedReason,
          isAIScored: !!meal.llmScore
        })
      }
    }

    // Check if user achieved their goals or is close
    const goalAchieved = remaining.calories <= 50 && remaining.protein <= 5
    const isNearGoal = !goalAchieved && (remaining.calories < 300 ||
      (remaining.calories < 500 && remaining.protein < 15))

    // Build appropriate message
    let message = null
    if (noNearbyRestaurants) {
      message = travelMode === 'walk'
        ? `No restaurants found within walking distance (${maxDistance} mi). Try switching to drive mode.`
        : `No known restaurant chains found within ${maxDistance} miles. Try the restaurant search to find local spots.`
    } else if (goalAchieved) {
      message = `You hit your targets today! Great job staying on track.`
    } else if (isNearGoal) {
      message = `You're close to your goals! Only ${remaining.calories} cal and ${remaining.protein}g protein left.`
    }

    // Check if AI scoring was used
    const aiScoringUsed = suggestions.some((s: any) => s.isAIScored)

    return NextResponse.json({
      suggestions,
      remaining,
      mealTime,
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
      aiScoringUsed,
      targetForMeal: {
        calories: Math.round(remaining.calories * (mealTime === 'dinner' ? 0.95 : 0.5)),
        protein: Math.round(remaining.protein * (mealTime === 'dinner' ? 0.95 : 0.5))
      }
    })

  } catch (error) {
    console.error('Meal suggestions error:', error)
    return NextResponse.json(
      { error: 'Failed to generate suggestions', suggestions: [] },
      { status: 500 }
    )
  }
}
