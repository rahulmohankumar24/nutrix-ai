import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'
import { cache, generateAIMealCacheKey } from '@/lib/cache'
import { parseAIResponse } from '@/lib/ai-utils'
import { calculateRealisticMealTarget } from '@/lib/meal-distribution'
import { normalizeRestaurantName } from '@/lib/restaurant-matcher'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Force rebuild to apply AI utils fix

// Efficient scoring for pre-filtering
function quickScore(meal: any, targets: any, timeOfDay: string): number {
  const { remaining } = targets
  let score = 0

  // Protein fit (most important)
  const proteinFit = Math.min(1, meal.protein / Math.max(remaining.protein * 0.7, 10))
  score += proteinFit * 50

  // Calorie fit
  const calorieFit = remaining.calories > 0 ?
    Math.max(0, 1 - Math.abs(meal.calories - remaining.calories * 0.4) / (remaining.calories * 0.6)) : 0.5
  score += calorieFit * 30

  // Time bonus
  if (timeOfDay === 'breakfast' && meal.protein >= 20) score += 10
  if (timeOfDay === 'lunch' && meal.calories >= 400 && meal.calories <= 700) score += 10
  if (timeOfDay === 'dinner' && meal.protein >= 25) score += 10

  return Math.max(0, Math.min(100, score))
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 })
    }

    const { restaurantBrand, userTargets, timeOfDay = 'lunch', userProfile, useAI = true, userId, userSchedule } = await request.json()

    if (!restaurantBrand || !userTargets) {
      return NextResponse.json({ error: 'Restaurant and user targets required' }, { status: 400 })
    }

    // Calculate realistic meal target based on time of day and remaining meals
    const mealDistribution = calculateRealisticMealTarget(
      timeOfDay,
      {
        calories: userTargets.remaining?.calories || 0,
        protein: userTargets.remaining?.protein || 0,
        carbs: userTargets.remaining?.carbs || 0,
        fat: userTargets.remaining?.fat || 0
      },
      userSchedule
    )

    // Check cache first for AI-enhanced results
    if (useAI && userId) {
      const cacheKey = `unified_${generateAIMealCacheKey(
        restaurantBrand,
        userId,
        timeOfDay,
        userTargets.remaining?.calories || 0,
        userTargets.remaining?.protein || 0
      )}`

      const cachedResult = cache.get(cacheKey)
      if (cachedResult) {
        console.log('🚀 Unified meal coach cache hit:', cacheKey)
        return NextResponse.json({
          ...cachedResult,
          cached: true
        })
      }
    }

    // Normalize restaurant name to match database brand names
    const normalizedBrand = normalizeRestaurantName(restaurantBrand)
    console.log(`🏪 Restaurant name normalized: "${restaurantBrand}" -> "${normalizedBrand}"`)

    // Get available meals for this restaurant brand
    const availableMeals = await prisma.orderTemplate.findMany({
      where: {
        restaurantBrand: normalizedBrand
      },
      orderBy: {
        title: 'asc'
      }
    })

    if (availableMeals.length === 0) {
      return NextResponse.json({ error: 'No meals found for this restaurant' }, { status: 404 })
    }

    // Quick algorithmic pre-filtering to reduce AI workload
    const scoredMeals = availableMeals.map(meal => ({
      ...meal,
      tags: meal.tags ? JSON.parse(meal.tags) : [],
      quickScore: quickScore(meal, userTargets, timeOfDay)
    })).sort((a, b) => b.quickScore - a.quickScore).slice(0, 8) // Top 8 candidates

    if (!useAI) {
      return NextResponse.json({
        success: true,
        meals: scoredMeals.slice(0, 5), // Top 5 without AI analysis
        coaching: { message: "Pre-filtered meals based on nutrition targets" },
        algorithmicFiltering: true
      })
    }

    // AI analysis of top candidates
    const remainingMacros = `${userTargets.remaining.calories}cal total remaining, but THIS MEAL should target ~${mealDistribution.targetCalories}cal, ${mealDistribution.targetProtein}g protein (${mealDistribution.reasoning})`

    const mealsList = scoredMeals.map((meal, i) =>
      `${i + 1}. ${meal.title} (${meal.calories}cal, ${meal.protein}p, ${meal.carbs}cb, ${meal.fat}f)`
    ).join('\n')

    const prompt = `RESPOND WITH ONLY VALID JSON. NO EXPLANATORY TEXT BEFORE OR AFTER.

${restaurantBrand} ${mealDistribution.mealType} meal analysis. User has ${userTargets.remaining.calories}cal remaining for the day, but THIS meal should target ~${mealDistribution.targetCalories}cal and ${mealDistribution.targetProtein}g protein since they have ${mealDistribution.mealsRemaining} meals left today. Goal: ${userProfile?.goal || 'balance'}.

CRITICAL COACHING INSTRUCTIONS:
- TARGET: ~${mealDistribution.targetCalories}cal and ~${mealDistribution.targetProtein}g protein for THIS meal
- DO NOT recommend meals that use up all remaining daily calories (${userTargets.remaining.calories}cal) - that's unrealistic for one meal
- If meals are too low, suggest add-ons to reach the MEAL target (~${mealDistribution.targetCalories}cal), not the daily total
- For ${restaurantBrand}: suggest "double protein", "extra chicken", "add guacamole", "add cheese" to hit THIS MEAL'S target
- Realistic single meal limit: 1200 calories max

PRE-FILTERED OPTIONS:
${mealsList}

Analyze & return JSON with ENHANCED meal recommendations targeting ${mealDistribution.targetCalories}cal for THIS meal:
{
  "approvedMeals": [
    {"mealIndex": 0, "score": 85, "reasoning": "Good for ${mealDistribution.mealType}, hits ~${mealDistribution.targetCalories}cal target", "customizations": ["ADD DOUBLE PROTEIN +360cal +70g protein"], "macroImpact": "Perfect for this meal, leaves room for ${mealDistribution.mealsRemaining - 1} more meals today"}
  ],
  "overallAdvice": "This ${mealDistribution.mealType} should be ~${mealDistribution.targetCalories}cal. You have ${mealDistribution.mealsRemaining} meals remaining today.",
  "restaurantTips": "Build a ${mealDistribution.targetCalories}cal meal - don't try to eat all ${userTargets.remaining.calories}cal at once!"
}`

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 1000, // Reduced for faster response
    })

    const aiResponse = completion.choices[0]?.message?.content
    if (!aiResponse) {
      return NextResponse.json({ error: 'No response from AI coach' }, { status: 500 })
    }

    try {
      const parsedResponse = parseAIResponse(aiResponse)

      // Enhance approved meals with AI insights
      const approvedMeals = parsedResponse.approvedMeals?.map((approved: any) => {
        const originalMeal = scoredMeals[approved.mealIndex]
        return {
          ...originalMeal,
          aiScore: approved.score,
          aiReasoning: approved.reasoning,
          customizations: approved.customizations || [],
          macroImpact: approved.macroImpact,
          aiApproved: true
        }
      }) || []

      const result = {
        success: true,
        meals: approvedMeals,
        coaching: parsedResponse,
        restaurantBrand,
        analysedCount: scoredMeals.length,
        approvedCount: approvedMeals.length,
        aiEnhanced: true
      }

      // Cache the AI result for 2 hours
      if (useAI && userId) {
        const cacheKey = `unified_${generateAIMealCacheKey(
          restaurantBrand,
          userId,
          timeOfDay,
          userTargets.remaining?.calories || 0,
          userTargets.remaining?.protein || 0
        )}`
        cache.set(cacheKey, result, 120)
        console.log('💾 Unified meal coach cached:', cacheKey)
      }

      return NextResponse.json(result)
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError)

      // Fallback to algorithmic results
      return NextResponse.json({
        success: true,
        meals: scoredMeals.slice(0, 5),
        coaching: {
          message: "AI analysis failed, showing algorithmically filtered results",
          overallAdvice: "Choose meals that match your remaining protein and calorie targets"
        },
        restaurantBrand,
        algorithmicFallback: true
      })
    }

  } catch (error) {
    console.error('Unified meal coach error:', error)
    return NextResponse.json({ error: 'Failed to analyze meals' }, { status: 500 })
  }
}
