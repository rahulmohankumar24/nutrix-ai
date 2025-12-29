import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'
import { calculateHealthAnalysis, HealthAnalysisResult, analyzeNutrition, NutritionInsight } from '@/lib/health/analyzer'
import { KNOWN_CHAINS } from '@/lib/chains'
import { getDayBoundariesUTC, getUserDateStr } from '@/lib/timezone'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

// Try to extract restaurant name from meal name
function extractRestaurantFromMealName(mealName: string): string | null {
  const nameLower = mealName.toLowerCase()

  for (const chain of KNOWN_CHAINS) {
    if (nameLower.includes(chain.toLowerCase())) {
      return chain
    }
  }

  // Common patterns like "chipotle chicken bowl", "cava bowl", etc.
  const patterns = [
    /^(chipotle|cava|sweetgreen|panera|subway|starbucks|chick-fil-a|shake shack|in-n-out|panda express)/i,
    /(from|at|@)\s+(chipotle|cava|sweetgreen|panera|subway|starbucks|chick-fil-a|shake shack|in-n-out|panda express)/i
  ]

  for (const pattern of patterns) {
    const match = nameLower.match(pattern)
    if (match) {
      // Return the captured restaurant name
      const restaurant = match[1] || match[2]
      if (restaurant && !['from', 'at', '@'].includes(restaurant)) {
        return restaurant
      }
    }
  }

  return null
}

interface HealthAnalysisResponse extends HealthAnalysisResult {
  recommendations: {
    title: string
    action: string
    impact: string
  }[]
  nutritionInsights: NutritionInsight[]
  allMealsCount: number
  hasFruits: boolean
  hasVeggies: boolean
  hasFiber: boolean
  hasProbiotics: boolean
  dailySummary?: string
}

// Generate AI summary for today's eating
async function generateDailySummary(
  meals: Array<{ name: string; calories: number; protein: number; carbs: number; fat: number }>,
  nutritionInsights: NutritionInsight[],
  ingredientConcerns: string[],
  userGoal: string
): Promise<string> {
  if (meals.length === 0) {
    return ''
  }

  const totalCals = meals.reduce((sum, m) => sum + m.calories, 0)
  const totalProtein = meals.reduce((sum, m) => sum + m.protein, 0)
  const mealNames = meals.map(m => m.name).join(', ')
  const positiveInsights = nutritionInsights.filter(i => i.category === 'positive').map(i => i.title)
  const warningInsights = nutritionInsights.filter(i => i.category === 'warning').map(i => i.title)

  const prompt = `Generate a brief, friendly 1-2 sentence health summary for someone tracking their nutrition today.

CONTEXT:
- Goal: ${userGoal}
- Meals eaten: ${mealNames}
- Total so far: ${totalCals} cal, ${totalProtein}g protein
- Positives: ${positiveInsights.length > 0 ? positiveInsights.join(', ') : 'none detected'}
- Areas to watch: ${warningInsights.length > 0 ? warningInsights.join(', ') : 'none'}
- Ingredient concerns: ${ingredientConcerns.length > 0 ? ingredientConcerns.slice(0, 2).join(', ') : 'none'}

Write a concise, supportive summary (max 25 words). Be specific about what they ate. No emojis. Focus on actionable insight or encouragement.

Consider mentioning if they're missing: probiotics (yogurt, kefir, kimchi), fiber, fruits, or vegetables.

Examples:
- "Good protein from your chicken bowl. Consider adding greens to your next meal."
- "Solid start with oatmeal. Try adding yogurt or kefir for gut health."
- "Your salad added great fiber. A probiotic snack would round out the day."

Return just the summary text, nothing else.`

  try {
    const response = await openai.responses.create({
      model: 'gpt-4o-mini',
      input: [
        { role: 'user', content: prompt }
      ]
    })

    return response.output_text?.trim() || ''
  } catch (error) {
    console.error('Failed to generate daily summary:', error)
    return ''
  }
}

// Generate AI recommendations based on analysis
async function generateRecommendations(
  analysis: HealthAnalysisResult,
  userGoal: string
): Promise<{ title: string; action: string; impact: string }[]> {
  if (analysis.topConcerns.length === 0 && analysis.flaggedIngredients.length === 0) {
    return [{
      title: 'Keep it up!',
      action: 'Your ingredient choices are clean. Continue prioritizing whole foods.',
      impact: 'Maintaining good internal health'
    }]
  }

  const prompt = `You are a health-conscious nutrition advisor. Based on the user's meal analysis, provide 3-4 specific, actionable recommendations.

USER CONTEXT:
- Goal: ${userGoal}
- Meals analyzed: ${analysis.mealsAnalyzed} (last 30 days)
- Overall health score: ${analysis.overallScore}/100 (Grade: ${analysis.grade})

TOP CONCERNS:
${analysis.topConcerns.map(c => `- ${c.title}: ${c.frequency}`).join('\n')}

FLAGGED INGREDIENTS (most frequent):
${analysis.flaggedIngredients.slice(0, 8).map(f => `- ${f.name} (${f.category}): found in ${f.foundInMeals.slice(0, 3).join(', ')}`).join('\n')}

RESTAURANT BREAKDOWN:
${analysis.restaurantBreakdown.slice(0, 5).map(r => `- ${r.restaurant}: Score ${r.avgScore}, ${r.mealCount} meals`).join('\n')}

Provide recommendations as JSON array:
[
  {
    "title": "Short action title (3-5 words)",
    "action": "Specific actionable advice (1-2 sentences)",
    "impact": "Brief benefit description (5-10 words)"
  }
]

Focus on:
1. Specific swaps at restaurants they frequent
2. Reducing their biggest ingredient concerns
3. Highlighting cleaner alternatives
4. Practical, not preachy advice

Return valid JSON array only.`

  try {
    const response = await openai.responses.create({
      model: 'gpt-4o-mini',
      input: [
        { role: 'system', content: 'You are a helpful nutrition advisor. Return only valid JSON.' },
        { role: 'user', content: prompt }
      ]
    })

    const content = response.output_text
    if (!content) {
      throw new Error('No response')
    }

    const recommendations = JSON.parse(content)
    return Array.isArray(recommendations) ? recommendations.slice(0, 4) : []
  } catch (error) {
    console.error('Failed to generate recommendations:', error)
    // Fallback recommendations
    return [{
      title: 'Watch the seed oils',
      action: 'Many restaurant meals contain soybean or canola oil. Ask for olive oil when possible.',
      impact: 'Reducing omega-6 intake'
    }, {
      title: 'Choose cleaner proteins',
      action: 'Opt for grilled over fried options to avoid breading with added oils.',
      impact: 'Fewer processed ingredients'
    }]
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const todayOnly = searchParams.get('today') === 'true'
    const timezone = searchParams.get('timezone') || 'America/Los_Angeles'

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Check if user is Pro
    const profile = await prisma.profile.findUnique({
      where: { userId }
    })

    if (!profile?.isPro) {
      return NextResponse.json({
        error: 'Pro subscription required',
        isPro: false
      }, { status: 403 })
    }

    // Get date range based on todayOnly parameter
    let startDate: Date
    let endDate: Date | undefined
    if (todayOnly) {
      // Get today's boundaries in user's timezone
      const userDateStr = getUserDateStr(timezone)
      const boundaries = getDayBoundariesUTC(userDateStr, timezone)
      startDate = boundaries.startOfDay
      endDate = boundaries.endOfDay
    } else {
      // Get last 30 days
      startDate = new Date()
      startDate.setDate(startDate.getDate() - 30)
      endDate = undefined
    }

    // Get meals from OrderTemplate (restaurant picker)
    const orderTemplateMeals = await prisma.mealLog.findMany({
      where: {
        userId,
        datetime: endDate ? { gte: startDate, lte: endDate } : { gte: startDate },
        orderTemplateId: { not: null }
      },
      include: {
        orderTemplate: true
      },
      orderBy: { datetime: 'desc' }
    })

    // Get meals from FoodCatalogItem (chat-logged meals)
    const catalogMeals = await prisma.mealLog.findMany({
      where: {
        userId,
        datetime: endDate ? { gte: startDate, lte: endDate } : { gte: startDate },
        foodCatalogItemId: { not: null },
        orderTemplateId: null // Don't double-count
      },
      include: {
        foodCatalogItem: true
      },
      orderBy: { datetime: 'desc' }
    })

    // Transform OrderTemplate meals
    const mealsFromTemplates = orderTemplateMeals
      .filter(log => log.orderTemplate)
      .map(log => ({
        id: log.id,
        mealName: log.orderTemplate!.title,
        restaurantBrand: log.orderTemplate!.restaurantBrand,
        description: log.orderTemplate!.description,
        datetime: log.datetime
      }))

    // Transform FoodCatalogItem meals - include ALL meals for nutrition, detect restaurant for ingredient analysis
    const mealsFromCatalog = catalogMeals
      .filter(log => log.foodCatalogItem)
      .map(log => {
        const item = log.foodCatalogItem!

        // Try to get restaurant from tags first, then from name
        let restaurantFromTags: string | null = null
        try {
          const tags = JSON.parse(item.tags || '[]')
          if (Array.isArray(tags) && tags.length > 0) {
            // Check if any tag is a known chain
            for (const tag of tags) {
              if (KNOWN_CHAINS.some(chain => chain.toLowerCase() === tag.toLowerCase())) {
                restaurantFromTags = tag
                break
              }
            }
          }
        } catch {}

        const detectedRestaurant = restaurantFromTags || extractRestaurantFromMealName(item.name)

        return {
          id: log.id,
          mealName: item.name,
          restaurantBrand: detectedRestaurant || '',
          description: item.ingredientsText || item.name,
          datetime: log.datetime,
          calories: item.calories,
          protein: item.protein,
          carbs: item.carbs,
          fat: item.fat,
          servings: log.servings
        }
      })

    // For ingredient analysis (restaurant meals only)
    const restaurantMealsForAnalysis = [
      ...mealsFromTemplates,
      ...mealsFromCatalog.filter(meal => meal.restaurantBrand)
    ].sort((a, b) => b.datetime.getTime() - a.datetime.getTime())

    // For nutrition analysis (ALL meals)
    const allMealsForNutrition = [
      ...orderTemplateMeals.filter(log => log.orderTemplate).map(log => ({
        name: log.orderTemplate!.title,
        calories: Math.round(log.orderTemplate!.calories * log.servings),
        protein: Math.round(log.orderTemplate!.protein * log.servings),
        carbs: Math.round(log.orderTemplate!.carbs * log.servings),
        fat: Math.round(log.orderTemplate!.fat * log.servings)
      })),
      ...mealsFromCatalog.map(meal => ({
        name: meal.mealName,
        calories: Math.round(meal.calories * meal.servings),
        protein: Math.round(meal.protein * meal.servings),
        carbs: Math.round(meal.carbs * meal.servings),
        fat: Math.round(meal.fat * meal.servings)
      }))
    ]

    // Run ingredient health analysis (restaurant meals)
    const analysis = calculateHealthAnalysis(restaurantMealsForAnalysis)

    // Run nutrition analysis (ALL meals)
    const nutritionAnalysis = analyzeNutrition(allMealsForNutrition)

    // Generate AI recommendations (skip for today-only quick lookups)
    const recommendations = todayOnly ? [] : await generateRecommendations(analysis, profile.goal)

    // Generate daily summary for today's view
    const dailySummary = todayOnly && allMealsForNutrition.length > 0
      ? await generateDailySummary(
          allMealsForNutrition,
          nutritionAnalysis.insights,
          analysis.topConcerns.map(c => c.title),
          profile.goal
        )
      : undefined

    const response: HealthAnalysisResponse = {
      ...analysis,
      recommendations,
      nutritionInsights: nutritionAnalysis.insights,
      allMealsCount: allMealsForNutrition.length,
      hasFruits: nutritionAnalysis.hasFruits,
      hasVeggies: nutritionAnalysis.hasVeggies,
      hasFiber: nutritionAnalysis.hasFiber,
      hasProbiotics: nutritionAnalysis.hasProbiotics,
      dailySummary
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Health analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze health data' },
      { status: 500 }
    )
  }
}

// POST: Force refresh analysis
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Check if user is Pro
    const profile = await prisma.profile.findUnique({
      where: { userId }
    })

    if (!profile?.isPro) {
      return NextResponse.json({
        error: 'Pro subscription required',
        isPro: false
      }, { status: 403 })
    }

    // Get meal logs from the last 30 days
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // Get meals from OrderTemplate (restaurant picker)
    const orderTemplateMeals = await prisma.mealLog.findMany({
      where: {
        userId,
        datetime: { gte: thirtyDaysAgo },
        orderTemplateId: { not: null }
      },
      include: {
        orderTemplate: true
      },
      orderBy: { datetime: 'desc' }
    })

    // Get meals from FoodCatalogItem (chat-logged meals)
    const catalogMeals = await prisma.mealLog.findMany({
      where: {
        userId,
        datetime: { gte: thirtyDaysAgo },
        foodCatalogItemId: { not: null },
        orderTemplateId: null
      },
      include: {
        foodCatalogItem: true
      },
      orderBy: { datetime: 'desc' }
    })

    // Transform OrderTemplate meals
    const mealsFromTemplates = orderTemplateMeals
      .filter(log => log.orderTemplate)
      .map(log => ({
        id: log.id,
        mealName: log.orderTemplate!.title,
        restaurantBrand: log.orderTemplate!.restaurantBrand,
        description: log.orderTemplate!.description,
        datetime: log.datetime
      }))

    // Transform FoodCatalogItem meals - include ALL meals for nutrition
    const mealsFromCatalog = catalogMeals
      .filter(log => log.foodCatalogItem)
      .map(log => {
        const item = log.foodCatalogItem!

        // Try to get restaurant from tags first, then from name
        let restaurantFromTags: string | null = null
        try {
          const tags = JSON.parse(item.tags || '[]')
          if (Array.isArray(tags) && tags.length > 0) {
            for (const tag of tags) {
              if (KNOWN_CHAINS.some(chain => chain.toLowerCase() === tag.toLowerCase())) {
                restaurantFromTags = tag
                break
              }
            }
          }
        } catch {}

        const detectedRestaurant = restaurantFromTags || extractRestaurantFromMealName(item.name)
        return {
          id: log.id,
          mealName: item.name,
          restaurantBrand: detectedRestaurant || '',
          description: item.ingredientsText || item.name,
          datetime: log.datetime,
          calories: item.calories,
          protein: item.protein,
          carbs: item.carbs,
          fat: item.fat,
          servings: log.servings
        }
      })

    // For ingredient analysis (restaurant meals only)
    const restaurantMealsForAnalysis = [
      ...mealsFromTemplates,
      ...mealsFromCatalog.filter(meal => meal.restaurantBrand)
    ].sort((a, b) => b.datetime.getTime() - a.datetime.getTime())

    // For nutrition analysis (ALL meals)
    const allMealsForNutrition = [
      ...orderTemplateMeals.filter(log => log.orderTemplate).map(log => ({
        name: log.orderTemplate!.title,
        calories: Math.round(log.orderTemplate!.calories * log.servings),
        protein: Math.round(log.orderTemplate!.protein * log.servings),
        carbs: Math.round(log.orderTemplate!.carbs * log.servings),
        fat: Math.round(log.orderTemplate!.fat * log.servings)
      })),
      ...mealsFromCatalog.map(meal => ({
        name: meal.mealName,
        calories: Math.round(meal.calories * meal.servings),
        protein: Math.round(meal.protein * meal.servings),
        carbs: Math.round(meal.carbs * meal.servings),
        fat: Math.round(meal.fat * meal.servings)
      }))
    ]

    const analysis = calculateHealthAnalysis(restaurantMealsForAnalysis)
    const nutritionAnalysis = analyzeNutrition(allMealsForNutrition)
    const recommendations = await generateRecommendations(analysis, profile.goal)

    const response: HealthAnalysisResponse = {
      ...analysis,
      recommendations,
      nutritionInsights: nutritionAnalysis.insights,
      allMealsCount: allMealsForNutrition.length,
      hasFruits: nutritionAnalysis.hasFruits,
      hasVeggies: nutritionAnalysis.hasVeggies,
      hasFiber: nutritionAnalysis.hasFiber,
      hasProbiotics: nutritionAnalysis.hasProbiotics
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Health analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze health data' },
      { status: 500 }
    )
  }
}
