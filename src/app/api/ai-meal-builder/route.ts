import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'
import { cache, generateAIMealCacheKey } from '@/lib/cache'
import { parseAIResponse } from '@/lib/ai-utils'
import { calculateRealisticMealTarget } from '@/lib/meal-distribution'
import { rateMealForTarget } from '@/lib/meal-rating'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 })
    }

    const { restaurantBrand, userTargets, timeOfDay = 'lunch', currentTime, currentHour, userProfile, userId, userSchedule, bypassCache = false } = await request.json()

    if (!restaurantBrand || !userTargets) {
      return NextResponse.json({ error: 'Restaurant and user targets required' }, { status: 400 })
    }

    // Validate userTargets structure
    if (!userTargets.remaining || !userTargets.current || !userTargets.targets) {
      return NextResponse.json({
        error: 'userTargets must include remaining, current, and targets properties',
        received: Object.keys(userTargets || {})
      }, { status: 400 })
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📊 AI MEAL BUILDER - STARTING')
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

    console.log('')
    console.log('🎯 AI WILL BE TOLD TO CREATE MEALS WITH:')
    console.log(`  Target for THIS meal: ${mealDistribution.targetCalories}cal, ${mealDistribution.targetProtein}g protein`)
    console.log(`  Meals remaining today: ${mealDistribution.mealsRemaining}`)
    console.log(`  Context: ${mealDistribution.reasoning}`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    // Check cache first (unless bypassed)
    const cacheKey = generateAIMealCacheKey(
      restaurantBrand,
      userId || 'anonymous',
      timeOfDay,
      userTargets.remaining.calories,
      userTargets.remaining.protein
    )

    if (!bypassCache) {
      const cachedResult = cache.get(cacheKey)
      if (cachedResult) {
        console.log('🚀 AI meal cache hit:', cacheKey)
        return NextResponse.json({
          ...cachedResult,
          cached: true,
          cacheKey
        })
      }
    } else {
      console.log('🔄 Cache bypassed for:', cacheKey)
    }

    // Get available ingredients for this restaurant
    const ingredients = await prisma.foodCatalogItem.findMany({
      where: {
        source: 'restaurant',
        tags: {
          contains: restaurantBrand.toLowerCase()
        }
      },
      orderBy: {
        name: 'asc'
      }
    })

    if (ingredients.length === 0) {
      return NextResponse.json({ error: 'No ingredients found for this restaurant' }, { status: 404 })
    }

    // Categorize ingredients for AI
    const categorizedIngredients = categorizeIngredients(ingredients)

    const remainingMacros = {
      calories: userTargets.remaining?.calories || 0,
      protein: userTargets.remaining?.protein || 0,
      carbs: userTargets.remaining?.carbs || 0,
      fat: userTargets.remaining?.fat || 0
    }


    // More efficient, focused prompt for faster AI response
    const prompt = `RESPOND WITH ONLY VALID JSON. NO EXPLANATORY TEXT BEFORE OR AFTER.

CURRENT TIME: ${currentTime || 'unknown'} (it is ${timeOfDay} time)
Build ${restaurantBrand} meals for ${mealDistribution.mealType}. User has ${remainingMacros.calories}cal remaining TODAY. Target for this meal: ~${mealDistribution.targetCalories}cal and ${mealDistribution.targetProtein}g protein.

IMPORTANT: This is a proper ${timeOfDay} meal (breakfast/lunch/dinner) - NOT a snack. Focus on complete, substantial meals.

CONTEXT: ${mealDistribution.reasoning}

CRITICAL INSTRUCTIONS:
- CREATE 5 VARIED OPTIONS with different calorie/protein levels
- OPTION 1: LIGHT (~${Math.round(mealDistribution.targetCalories * 0.65)}cal, ~${Math.round(mealDistribution.targetProtein * 0.7)}g protein) - smaller portions, single protein
- OPTION 2: MODERATE (~${Math.round(mealDistribution.targetCalories * 0.85)}cal, ~${Math.round(mealDistribution.targetProtein * 0.9)}g protein) - standard portions
- OPTION 3: TARGET (~${mealDistribution.targetCalories}cal, ~${mealDistribution.targetProtein}g protein) - hits the target perfectly
- OPTION 4: PROTEIN-PACKED (~${Math.round(mealDistribution.targetCalories * 1.1)}cal, ~${Math.round(mealDistribution.targetProtein * 1.3)}g protein) - double protein, extra meat
- OPTION 5: MAX (~${Math.min(Math.round(mealDistribution.targetCalories * 1.3), 1200)}cal, ~${Math.round(mealDistribution.targetProtein * 1.5)}g protein) - aggressive portions with all add-ons
- For ${restaurantBrand.toLowerCase()}: use "double protein", "extra chicken", "guacamole", "cheese", portion sizes to vary calories/protein
- Each meal MUST have different ingredient quantities to achieve the calorie/protein variation

INGREDIENTS:
${Object.entries(categorizedIngredients).map(([cat, items]) =>
  `${cat.toUpperCase()}: ${(items as any[]).map(i => `${i.name}(${i.calories}c,${i.protein}p,${i.carbs}cb,${i.fat}f)`).join(', ')}`
).join('\n')}

IMPORTANT: Your TARGET meal should be around ${mealDistribution.targetCalories} calories. The OPTION 3 "TARGET" meal MUST be close to ${mealDistribution.targetCalories}cal, not lower!

Return this exact JSON structure with 5 VARIED meals:
{
  "customMeals": [
    {
      "id": "meal_1",
      "title": "Light ${mealDistribution.mealType}",
      "description": "Smaller portion, fewer calories",
      "totalCalories": ${Math.round(mealDistribution.targetCalories * 0.65)},
      "totalProtein": ${Math.round(mealDistribution.targetProtein * 0.7)},
      "totalCarbs": ${Math.round(mealDistribution.targetCarbs * 0.7)},
      "totalFat": ${Math.round(mealDistribution.targetFat * 0.7)},
      "macroFitScore": 85,
      "ingredients": [
        {"name": "Chicken", "id": "ing_1", "calories": 180, "protein": 32, "carbs": 0, "fat": 7, "category": "protein"},
        {"name": "Brown Rice", "id": "ing_2", "calories": 105, "protein": 2, "carbs": 18, "fat": 3, "category": "base"}
      ],
      "reasoning": "Lighter option if you're not too hungry or saving calories for later",
      "buildInstructions": "Order: half rice + regular protein + veggies"
    },
    {
      "id": "meal_2",
      "title": "Balanced ${mealDistribution.mealType}",
      "description": "Standard portions",
      "totalCalories": ${Math.round(mealDistribution.targetCalories * 0.85)},
      "totalProtein": ${Math.round(mealDistribution.targetProtein * 0.9)},
      "totalCarbs": ${Math.round(mealDistribution.targetCarbs * 0.9)},
      "totalFat": ${Math.round(mealDistribution.targetFat * 0.9)},
      "macroFitScore": 90,
      "ingredients": [
        {"name": "Chicken", "id": "ing_1", "calories": 180, "protein": 32, "carbs": 0, "fat": 7, "category": "protein"},
        {"name": "Brown Rice", "id": "ing_2", "calories": 210, "protein": 4, "carbs": 36, "fat": 6, "category": "base"}
      ],
      "reasoning": "Well-balanced standard meal",
      "buildInstructions": "Order: regular portions of base + protein + veggies"
    },
    {
      "id": "meal_3",
      "title": "Target ${mealDistribution.mealType}",
      "description": "Hits your macro targets perfectly",
      "totalCalories": ${mealDistribution.targetCalories},
      "totalProtein": ${mealDistribution.targetProtein},
      "totalCarbs": ${mealDistribution.targetCarbs},
      "totalFat": ${mealDistribution.targetFat},
      "macroFitScore": 95,
      "ingredients": [
        {"name": "Chicken", "id": "ing_1", "calories": 180, "protein": 32, "carbs": 0, "fat": 7, "category": "protein"},
        {"name": "Brown Rice", "id": "ing_2", "calories": 210, "protein": 4, "carbs": 36, "fat": 6, "category": "base"}
      ],
      "reasoning": "Perfect for hitting your ${mealDistribution.mealType} targets",
      "buildInstructions": "Order: base + protein + add-ons to hit target"
    },
    {
      "id": "meal_4",
      "title": "Protein-Packed ${mealDistribution.mealType}",
      "description": "Extra protein for muscle building",
      "totalCalories": ${Math.round(mealDistribution.targetCalories * 1.1)},
      "totalProtein": ${Math.round(mealDistribution.targetProtein * 1.3)},
      "totalCarbs": ${Math.round(mealDistribution.targetCarbs * 1.0)},
      "totalFat": ${Math.round(mealDistribution.targetFat * 1.2)},
      "macroFitScore": 92,
      "ingredients": [
        {"name": "Double Chicken", "id": "ing_1", "calories": 360, "protein": 64, "carbs": 0, "fat": 14, "category": "protein"},
        {"name": "Brown Rice", "id": "ing_2", "calories": 210, "protein": 4, "carbs": 36, "fat": 6, "category": "base"}
      ],
      "reasoning": "High protein option with double meat",
      "buildInstructions": "Order: base + DOUBLE PROTEIN + veggies"
    },
    {
      "id": "meal_5",
      "title": "Maximum ${mealDistribution.mealType}",
      "description": "Largest option with all add-ons",
      "totalCalories": ${Math.min(Math.round(mealDistribution.targetCalories * 1.3), 1200)},
      "totalProtein": ${Math.round(mealDistribution.targetProtein * 1.5)},
      "totalCarbs": ${Math.round(mealDistribution.targetCarbs * 1.2)},
      "totalFat": ${Math.round(mealDistribution.targetFat * 1.4)},
      "macroFitScore": 88,
      "ingredients": [
        {"name": "Double Chicken", "id": "ing_1", "calories": 360, "protein": 64, "carbs": 0, "fat": 14, "category": "protein"},
        {"name": "Brown Rice", "id": "ing_2", "calories": 210, "protein": 4, "carbs": 36, "fat": 6, "category": "base"}
      ],
      "reasoning": "${mealDistribution.mealsRemaining === 1 ? 'Last meal - maximize everything to hit daily targets' : 'Aggressive portions if you need to catch up on macros'}",
      "buildInstructions": "Order: base + DOUBLE PROTEIN + all toppings (guac, cheese, etc.)"
    }
  ],
  "overallAdvice": "${mealDistribution.reasoning} Choose the option that best fits your hunger level and remaining targets.",
  "restaurantTips": "Use portion sizes and add-ons to customize calories and protein to your needs"
}`

    console.log('')
    console.log('🤖 PROMPT BEING SENT TO AI:')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(prompt.substring(0, 800) + '...[truncated]')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 4000, // Increased for 5 varied meal options
    })

    const aiResponse = completion.choices[0]?.message?.content

    console.log('')
    console.log('🤖 AI RESPONSE RECEIVED')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    if (aiResponse) {
      console.log(aiResponse.substring(0, 500) + '...[truncated]')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    }

    if (!aiResponse) {
      return NextResponse.json({ error: 'No response from AI meal builder' }, { status: 500 })
    }

    try {
      const parsedResponse = parseAIResponse(aiResponse)

      // CRITICAL FIX: Validate and recalculate nutrition totals from ingredients
      // The AI sometimes makes math errors, so we recalculate from ingredients
      const validatedMeals = parsedResponse.customMeals?.map((meal: any) => {
        if (!meal.ingredients || meal.ingredients.length === 0) {
          console.warn('⚠️ Meal has no ingredients, using AI totals:', meal.title)
          return meal
        }

        // Recalculate totals from actual ingredients
        const calculatedTotals = meal.ingredients.reduce((totals: any, ingredient: any) => {
          return {
            calories: totals.calories + (ingredient.calories || 0),
            protein: totals.protein + (ingredient.protein || 0),
            carbs: totals.carbs + (ingredient.carbs || 0),
            fat: totals.fat + (ingredient.fat || 0)
          }
        }, { calories: 0, protein: 0, carbs: 0, fat: 0 })

        // Check if AI totals match calculated totals (with 5% tolerance)
        const caloriesDiff = Math.abs(meal.totalCalories - calculatedTotals.calories)
        const proteinDiff = Math.abs(meal.totalProtein - calculatedTotals.protein)

        if (caloriesDiff > meal.totalCalories * 0.05 || proteinDiff > meal.totalProtein * 0.05) {
          console.warn('⚠️ AI math error detected for meal:', meal.title)
          console.warn('  AI totals:', {
            calories: meal.totalCalories,
            protein: meal.totalProtein,
            carbs: meal.totalCarbs,
            fat: meal.totalFat
          })
          console.warn('  Calculated totals:', calculatedTotals)
          console.warn('  Using calculated totals instead ✅')
        }

        // Always use calculated totals to ensure accuracy
        return {
          ...meal,
          totalCalories: calculatedTotals.calories,
          totalProtein: calculatedTotals.protein,
          totalCarbs: calculatedTotals.carbs,
          totalFat: calculatedTotals.fat,
          aiTotals: { // Keep AI's original totals for debugging
            calories: meal.totalCalories,
            protein: meal.totalProtein,
            carbs: meal.totalCarbs,
            fat: meal.totalFat
          }
        }
      }) || []

      // Add smart ratings and sort by best fit
      const ratedMeals = validatedMeals.map((meal: any) => {
        const rating = rateMealForTarget(
          {
            calories: meal.totalCalories,
            protein: meal.totalProtein,
            carbs: meal.totalCarbs,
            fat: meal.totalFat
          },
          remainingMacros,
          mealDistribution.mealsRemaining,
          mealDistribution.targetCalories,
          mealDistribution.targetProtein
        )

        return {
          ...meal,
          fitScore: rating.score,
          fitBadge: rating.badge,
          fitReasoning: rating.reasoning,
          caloriesFit: rating.caloriesFit,
          proteinFit: rating.proteinFit
        }
      }).sort((a: any, b: any) => b.fitScore - a.fitScore) // Sort by best fit first

      console.log('📊 Meal ratings (sorted by best fit first):')
      ratedMeals.forEach((m: any, idx: number) => {
        console.log(`  ${idx + 1}. [${m.fitScore}/100] ${m.fitBadge || 'NO BADGE'} - ${m.title}`)
        console.log(`     ${m.totalCalories}cal, ${m.totalProtein}g protein`)
        console.log(`     → ${m.fitReasoning}`)
      })

      const result = {
        success: true,
        customMeals: ratedMeals,
        coaching: parsedResponse,
        restaurantBrand,
        availableIngredients: ingredients.length,
        mealCount: ratedMeals.length,
        targetInfo: {
          mealsRemaining: mealDistribution.mealsRemaining,
          targetCaloriesThisMeal: mealDistribution.targetCalories,
          targetProteinThisMeal: mealDistribution.targetProtein
        }
      }

      // Cache the result for 2 hours
      cache.set(cacheKey, result, 120)
      console.log('💾 AI meal cached:', cacheKey)

      return NextResponse.json(result)
    } catch (parseError) {
      console.error('Failed to parse AI meal builder response:', parseError)
      console.error('Raw AI response:', aiResponse)
      return NextResponse.json({
        success: false,
        error: 'Invalid AI response format',
        rawResponse: aiResponse,
        parseError: parseError instanceof Error ? parseError.message : String(parseError)
      }, { status: 500 })
    }

  } catch (error) {
    console.error('AI meal builder error:', error)
    return NextResponse.json({ error: 'Failed to generate custom meals' }, { status: 500 })
  }
}

function categorizeIngredients(ingredients: any[]) {
  const result = {
    protein: [],
    base: [],
    vegetables: [],
    sauces: [],
    toppings: [],
    other: []
  }

  ingredients.forEach(ingredient => {
    const name = ingredient.name.toLowerCase()
    const tags = ingredient.tags ? JSON.parse(ingredient.tags) : []
    const lowerTags = tags.map((tag: string) => tag.toLowerCase())

    let category = 'other'

    // Check tags first
    if (lowerTags.includes('protein') || lowerTags.includes('meat')) {
      category = 'protein'
    } else if (lowerTags.includes('base') || lowerTags.includes('grain')) {
      category = 'base'
    } else if (lowerTags.includes('vegetable') || lowerTags.includes('veggie')) {
      category = 'vegetables'
    } else if (lowerTags.includes('sauce') || lowerTags.includes('dressing')) {
      category = 'sauces'
    } else if (lowerTags.includes('topping') || lowerTags.includes('extra')) {
      category = 'toppings'
    } else {
      // Fallback to name-based categorization
      if (name.includes('chicken') || name.includes('beef') || name.includes('lamb') ||
          name.includes('salmon') || name.includes('steak') || name.includes('pork') ||
          name.includes('tofu') || name.includes('falafel') || name.includes('meatball')) {
        category = 'protein'
      } else if (name.includes('rice') || name.includes('quinoa') || name.includes('pita') ||
                 name.includes('bread') || name.includes('tortilla') || name.includes('bowl') ||
                 name.includes('base') || name.includes('grain')) {
        category = 'base'
      } else if (name.includes('tomato') || name.includes('cucumber') || name.includes('onion') ||
                 name.includes('pepper') || name.includes('lettuce') || name.includes('spinach') ||
                 name.includes('cabbage') || name.includes('carrot') || name.includes('corn') ||
                 name.includes('bean') || name.includes('olive')) {
        category = 'vegetables'
      } else if (name.includes('sauce') || name.includes('dressing') || name.includes('hummus') ||
                 name.includes('vinaigrette') || name.includes('tahini') || name.includes('tzatziki')) {
        category = 'sauces'
      } else if (name.includes('cheese') || name.includes('avocado') || name.includes('nuts') ||
                 name.includes('seeds') || name.includes('crumble') || name.includes('chip')) {
        category = 'toppings'
      }
    }

    (result as any)[category].push(ingredient)
  })

  return result
}