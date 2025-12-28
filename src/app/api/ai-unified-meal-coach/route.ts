import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'
import { cache, generateAIMealCacheKey } from '@/lib/cache'
import { parseAIResponse } from '@/lib/ai-utils'
import { calculateRealisticMealTarget } from '@/lib/meal-distribution'
import { normalizeRestaurantName } from '@/lib/restaurant-matcher'
import { rateMealForTarget } from '@/lib/meal-rating'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Force rebuild to apply AI utils fix

// Efficient scoring for pre-filtering - uses calculated meal targets
function quickScore(meal: any, targetCalories: number, targetProtein: number, mealsRemaining: number): number {
  let score = 0

  // CALORIE FIT (40% weight) - how close to target?
  // Prefer meals within 70-130% of target, with bonus for hitting target
  const calorieRatio = meal.calories / Math.max(targetCalories, 300)
  let calorieFit = 0
  if (calorieRatio >= 0.7 && calorieRatio <= 1.3) {
    // Within acceptable range - score based on closeness to 1.0
    calorieFit = 1 - Math.abs(1 - calorieRatio) * 0.5
  } else if (calorieRatio < 0.7) {
    // Too small - penalize more heavily
    calorieFit = calorieRatio * 0.6
  } else {
    // Too large - penalize but not as harshly (can always eat less)
    calorieFit = Math.max(0, 1 - (calorieRatio - 1.3) * 0.3)
  }
  score += calorieFit * 40

  // PROTEIN FIT (40% weight) - protein is equally important
  const proteinRatio = meal.protein / Math.max(targetProtein, 20)
  let proteinFit = 0
  if (proteinRatio >= 0.7 && proteinRatio <= 1.5) {
    // Within acceptable range - bonus for exceeding target (protein is always good)
    proteinFit = Math.min(1, 0.8 + proteinRatio * 0.2)
  } else if (proteinRatio < 0.7) {
    // Too low protein - penalize
    proteinFit = proteinRatio * 0.8
  } else {
    // Very high protein - still good, just cap the score
    proteinFit = 1
  }
  score += proteinFit * 40

  // MEALS REMAINING BONUS (10% weight)
  // If it's the last meal, strongly prefer meals that get close to targets
  if (mealsRemaining === 1) {
    const hitsTarget = calorieRatio >= 0.75 && proteinRatio >= 0.75
    score += hitsTarget ? 10 : 2
  } else {
    // Multiple meals left - balanced meals are good
    const isBalanced = calorieRatio >= 0.8 && calorieRatio <= 1.2
    score += isBalanced ? 8 : 4
  }

  // MACROS BALANCE (10% weight) - carbs/fat considered but not prioritized
  // Just avoid extreme outliers
  const carbsRatio = meal.carbs / Math.max((targetCalories * 0.45 / 4), 30)
  const fatRatio = meal.fat / Math.max((targetCalories * 0.25 / 9), 10)
  const macroBalance = (carbsRatio >= 0.5 && carbsRatio <= 2) && (fatRatio >= 0.5 && fatRatio <= 2) ? 10 : 5
  score += macroBalance

  return Math.max(0, Math.min(100, score))
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 })
    }

    const { restaurantBrand, userTargets, timeOfDay = 'lunch', currentTime, currentHour, useAI = true, userId, userSchedule, bypassCache = false } = await request.json()

    if (!restaurantBrand || !userTargets) {
      return NextResponse.json({ error: 'Restaurant and user targets required' }, { status: 400 })
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📊 UNIFIED MEAL COACH - STARTING')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`  User ID: ${userId}`)
    console.log(`  Restaurant: ${restaurantBrand}`)
    console.log(`  EXPLICIT TIME: ${currentTime || 'not provided'} (hour: ${currentHour || 'not provided'})`)
    console.log(`  Meal Type: ${timeOfDay} (breakfast/lunch/dinner only - NO SNACKS)`)
    console.log('')
    console.log('📈 USER MACRO PROGRESS:')
    console.log(`  Daily Targets: ${userTargets.targets.calories}cal, ${userTargets.targets.protein}g protein, ${userTargets.targets.carbs}g carbs, ${userTargets.targets.fat}g fat`)
    console.log(`  Current Progress: ${userTargets.current.calories}cal, ${userTargets.current.protein}g protein, ${userTargets.current.carbs}g carbs, ${userTargets.current.fat}g fat`)
    console.log(`  Remaining: ${userTargets.remaining.calories}cal, ${userTargets.remaining.protein}g protein, ${userTargets.remaining.carbs}g carbs, ${userTargets.remaining.fat}g fat`)
    console.log(`  Progress: ${Math.round(userTargets.current.calories/userTargets.targets.calories*100)}% of daily calories`)
    console.log('')

    // Calculate realistic meal target FIRST (before pre-filtering)
    // This ensures we filter for meals matching the ACTUAL target, not a conservative 40%
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

    console.log('')
    console.log('🎯 AI WILL BE TOLD TO RECOMMEND MEALS WITH:')
    console.log(`  Target for THIS meal: ${mealDistribution.targetCalories}cal, ${mealDistribution.targetProtein}g protein`)
    console.log(`  Meals remaining today: ${mealDistribution.mealsRemaining}`)
    console.log(`  Context: ${mealDistribution.reasoning}`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    // Check cache first for AI-enhanced results (unless bypassed)
    if (useAI && userId && !bypassCache) {
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
    } else if (bypassCache) {
      console.log('🔄 Cache bypassed for unified meal coach')
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
    // Uses calculated meal distribution targets (calories & protein prioritized 80%)
    const scoredMeals = availableMeals.map(meal => ({
      ...meal,
      tags: meal.tags ? JSON.parse(meal.tags) : [],
      quickScore: quickScore(
        meal,
        mealDistribution.targetCalories,
        mealDistribution.targetProtein,
        mealDistribution.mealsRemaining
      )
    })).sort((a, b) => b.quickScore - a.quickScore).slice(0, 15) // Top 15 candidates for more variety

    console.log('🎯 Pre-filtering with targets:', {
      targetCalories: mealDistribution.targetCalories,
      targetProtein: mealDistribution.targetProtein,
      mealsRemaining: mealDistribution.mealsRemaining,
      topMeals: scoredMeals.slice(0, 5).map(m => `${m.title}: ${m.calories}cal, ${m.protein}g protein (score: ${m.quickScore})`)
    })

    if (!useAI) {
      return NextResponse.json({
        success: true,
        meals: scoredMeals.slice(0, 6), // Top 6 without AI analysis
        coaching: { message: "Pre-filtered meals based on nutrition targets" },
        algorithmicFiltering: true
      })
    }

    // AI analysis of top candidates
    const mealsList = scoredMeals.map((meal, i) =>
      `${i + 1}. ${meal.title} (${meal.calories}cal, ${meal.protein}p, ${meal.carbs}cb, ${meal.fat}f)`
    ).join('\n')

    const prompt = `RESPOND WITH ONLY VALID JSON. NO EXPLANATORY TEXT BEFORE OR AFTER.

CURRENT TIME: ${currentTime || 'unknown'} (it is ${timeOfDay} time)
${restaurantBrand} ${mealDistribution.mealType} meal analysis. User has ${userTargets.remaining.calories}cal remaining for the day. Target for this meal: ~${mealDistribution.targetCalories}cal and ${mealDistribution.targetProtein}g protein.

IMPORTANT: This is a proper ${timeOfDay} meal (breakfast/lunch/dinner) - NOT a snack. Recommend complete, substantial meals.

CONTEXT: ${mealDistribution.reasoning}

CRITICAL COACHING INSTRUCTIONS:
- PROVIDE 5-6 VARIED OPTIONS at different calorie/protein levels to give user choice
- ONLY recommend from the pre-filtered options below (use mealIndex 0 to ${scoredMeals.length - 1})
- LIGHT OPTIONS (~${Math.round(mealDistribution.targetCalories * 0.7)}cal): Regular portions, no add-ons
- MODERATE OPTIONS (~${Math.round(mealDistribution.targetCalories * 0.9)}cal): Standard size with some add-ons
- TARGET OPTIONS (~${mealDistribution.targetCalories}cal): Hits target perfectly
- PROTEIN-PACKED (~${Math.round(mealDistribution.targetCalories * 1.15)}cal, ~${Math.round(mealDistribution.targetProtein * 1.3)}g protein): Suggest "double protein", "extra chicken", "add protein"
- MAX OPTIONS (~${Math.min(Math.round(mealDistribution.targetCalories * 1.3), 1200)}cal, ~${Math.round(mealDistribution.targetProtein * 1.5)}g protein): "double protein + all toppings (guac, cheese, etc.)"
- Use customizations to vary the calories/protein: "ADD DOUBLE PROTEIN +180cal +32g protein", "ADD GUACAMOLE +230cal +3g protein", "ADD CHEESE +100cal +6g protein", "EXTRA LARGE SIZE +150cal +20g protein"
- Each approved meal should be DISTINCT with different calorie/protein levels

EXPLANATION STYLE:
- "reasoning": Explain WHY this meal is a good choice (e.g., "Hits your ${mealDistribution.targetProtein}g protein target while staying within calorie budget")
- "macroImpact": Be specific about numbers (e.g., "Gets you 71g of your 72g remaining protein - nearly perfect!")
- For meals to AVOID: Include in "mealsToAvoid" with honest explanation

PRE-FILTERED OPTIONS (use these indices only):
${mealsList}

Analyze & return JSON with 5-6 VARIED meal recommendations:
{
  "approvedMeals": [
    {"mealIndex": 0, "score": 85, "reasoning": "Light option - good if you want to save calories for later", "customizations": [], "macroImpact": "420cal leaves room for a bigger dinner"},
    {"mealIndex": 1, "score": 92, "reasoning": "Best protein-to-calorie ratio on the menu", "customizations": [], "macroImpact": "Gets you 42g protein for only 560cal - efficient"},
    {"mealIndex": 2, "score": 95, "reasoning": "Closest to your ${mealDistribution.targetCalories}cal target", "customizations": ["ADD CHEESE +100cal +6g protein"], "macroImpact": "Hits ${Math.round(mealDistribution.targetCalories)}cal target almost perfectly"},
    {"mealIndex": 3, "score": 90, "reasoning": "High protein option for muscle building", "customizations": ["ADD DOUBLE PROTEIN +180cal +32g protein"], "macroImpact": "Maximizes protein at ${mealDistribution.targetProtein}g+ for the day"}
  ],
  "mealsToAvoid": [
    {"title": "Example Low Protein Option", "reason": "Only 15g protein - you need ${mealDistribution.targetProtein}g this meal"},
    {"title": "Example High Calorie Option", "reason": "1200cal would exceed your ${userTargets.remaining.calories}cal remaining budget"}
  ],
  "overallAdvice": "${mealDistribution.reasoning} Choose the portion size that matches your hunger level.",
  "coachingNote": "Brief personalized tip about hitting targets at this restaurant"
}`

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 2000, // Increased for 5-6 varied meal options
    })

    const aiResponse = completion.choices[0]?.message?.content
    if (!aiResponse) {
      return NextResponse.json({ error: 'No response from AI coach' }, { status: 500 })
    }

    try {
      const parsedResponse = parseAIResponse(aiResponse)

      // Enhance approved meals with AI insights and calculate customization totals
      // Filter out any invalid mealIndex values first
      const validApprovedMeals = (parsedResponse.approvedMeals || []).filter((approved: any) => {
        const isValid = approved.mealIndex >= 0 && approved.mealIndex < scoredMeals.length
        if (!isValid) {
          console.warn(`⚠️ AI returned invalid mealIndex ${approved.mealIndex} (only ${scoredMeals.length} meals available)`)
        }
        return isValid
      })

      const approvedMeals = validApprovedMeals.map((approved: any) => {
        const originalMeal = scoredMeals[approved.mealIndex]

        // Parse customizations to calculate total macros
        let totalCalories = originalMeal.calories
        let totalProtein = originalMeal.protein
        let totalCarbs = originalMeal.carbs
        let totalFat = originalMeal.fat

        if (approved.customizations && approved.customizations.length > 0) {
          console.log(`📝 Processing customizations for: ${originalMeal.title}`)

          approved.customizations.forEach((customization: string) => {
            // Parse customization strings like "ADD DOUBLE PROTEIN +360cal +70g protein"
            const calMatch = customization.match(/\+(\d+)\s*cal/)
            const proteinMatch = customization.match(/\+(\d+)\s*g?\s*protein/)
            const carbsMatch = customization.match(/\+(\d+)\s*g?\s*carbs?/)
            const fatMatch = customization.match(/\+(\d+)\s*g?\s*fats?/)

            const addedCals = calMatch ? parseInt(calMatch[1]) : 0
            const addedProtein = proteinMatch ? parseInt(proteinMatch[1]) : 0
            const addedCarbs = carbsMatch ? parseInt(carbsMatch[1]) : 0
            const addedFat = fatMatch ? parseInt(fatMatch[1]) : 0

            if (addedCals > 0 || addedProtein > 0 || addedCarbs > 0 || addedFat > 0) {
              console.log(`  ➕ "${customization}":`, {
                calories: addedCals,
                protein: addedProtein,
                carbs: addedCarbs,
                fat: addedFat
              })

              totalCalories += addedCals
              totalProtein += addedProtein
              totalCarbs += addedCarbs
              totalFat += addedFat
            } else {
              console.warn(`  ⚠️ Could not parse customization: "${customization}"`)
            }
          })

          console.log(`  📊 Final totals: ${totalCalories}cal, ${totalProtein}g protein, ${totalCarbs}g carbs, ${totalFat}g fat`)
        }

        // Validate that the calculated totals match macronutrient math
        const calculatedCaloriesFromMacros = (totalProtein * 4) + (totalCarbs * 4) + (totalFat * 9)
        const caloriesDiff = Math.abs(totalCalories - calculatedCaloriesFromMacros)

        if (caloriesDiff > totalCalories * 0.1) {
          console.warn(`⚠️ Macro math doesn't match calories for: ${originalMeal.title}`)
          console.warn(`  Displayed: ${totalCalories}cal`)
          console.warn(`  Calculated from macros: ${calculatedCaloriesFromMacros}cal (${totalProtein}p×4 + ${totalCarbs}c×4 + ${totalFat}f×9)`)
          console.warn(`  Difference: ${caloriesDiff}cal`)
          console.warn(`  Using calculated value ✅`)

          totalCalories = Math.round(calculatedCaloriesFromMacros)
        }

        // Calculate smart rating for this meal
        const rating = rateMealForTarget(
          {
            calories: totalCalories,
            protein: totalProtein,
            carbs: totalCarbs,
            fat: totalFat
          },
          {
            calories: userTargets.remaining?.calories || 0,
            protein: userTargets.remaining?.protein || 0,
            carbs: userTargets.remaining?.carbs || 0,
            fat: userTargets.remaining?.fat || 0
          },
          mealDistribution.mealsRemaining,
          mealDistribution.targetCalories,
          mealDistribution.targetProtein
        )

        return {
          ...originalMeal,
          // Store both base and customized totals
          baseCalories: originalMeal.calories,
          baseProtein: originalMeal.protein,
          baseCarbs: originalMeal.carbs,
          baseFat: originalMeal.fat,
          // Override with calculated totals
          calories: totalCalories,
          protein: totalProtein,
          carbs: totalCarbs,
          fat: totalFat,
          aiScore: approved.score,
          aiReasoning: approved.reasoning,
          customizations: approved.customizations || [],
          macroImpact: approved.macroImpact,
          aiApproved: true,
          // Add smart fit ratings
          fitScore: rating.score,
          fitBadge: rating.badge,
          fitReasoning: rating.reasoning,
          caloriesFit: rating.caloriesFit,
          proteinFit: rating.proteinFit
        }
      }) || []

      // Sort by fit score (best recommendations first)
      approvedMeals.sort((a: any, b: any) => b.fitScore - a.fitScore)

      console.log('📊 Meal ratings (sorted by best fit first):')
      approvedMeals.forEach((m: any, idx: number) => {
        console.log(`  ${idx + 1}. [${m.fitScore}/100] ${m.fitBadge || 'NO BADGE'} - ${m.title}`)
        console.log(`     ${m.calories}cal, ${m.protein}g protein`)
        console.log(`     → ${m.fitReasoning}`)
      })

      const result = {
        success: true,
        meals: approvedMeals,
        coaching: parsedResponse,
        restaurantBrand,
        analysedCount: scoredMeals.length,
        approvedCount: approvedMeals.length,
        aiEnhanced: true,
        targetInfo: {
          mealsRemaining: mealDistribution.mealsRemaining,
          targetCaloriesThisMeal: mealDistribution.targetCalories,
          targetProteinThisMeal: mealDistribution.targetProtein
        }
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
