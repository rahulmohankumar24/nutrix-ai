import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizeRestaurantName } from '@/lib/restaurant-matcher'

// Nutrition scoring algorithm
function calculateNutritionScore(meal: any, targets: any, timeOfDay: string) {
  const { remaining } = targets

  // Base score calculation - how well meal fits remaining targets
  let score = 0
  let maxScore = 0

  // Protein score (40% weight) - critical for all times
  const proteinFit = Math.min(1, meal.protein / Math.max(remaining.protein * 0.7, 10))
  score += proteinFit * 0.4 * 100
  maxScore += 0.4 * 100

  // Calorie score (30% weight) - avoid going way over
  const calorieFit = remaining.calories > 0 ?
    Math.min(1, Math.max(0, 1 - Math.abs(meal.calories - remaining.calories * 0.4) / (remaining.calories * 0.6))) : 0.5
  score += calorieFit * 0.3 * 100
  maxScore += 0.3 * 100

  // Carb score (20% weight) - time-dependent
  let carbWeight = 0.2
  if (timeOfDay === 'breakfast' || timeOfDay === 'lunch') carbWeight = 0.25
  if (timeOfDay === 'dinner') carbWeight = 0.15

  const carbFit = remaining.carbs > 0 ? Math.min(1, meal.carbs / Math.max(remaining.carbs * 0.5, 20)) : 0.5
  score += carbFit * carbWeight * 100
  maxScore += carbWeight * 100

  // Fat score (10% weight)
  const fatFit = remaining.fat > 0 ? Math.min(1, meal.fat / Math.max(remaining.fat * 0.6, 15)) : 0.5
  score += fatFit * 0.1 * 100
  maxScore += 0.1 * 100

  // Time of day bonus
  if (timeOfDay === 'breakfast' && meal.protein >= 20) score += 10
  if (timeOfDay === 'lunch' && meal.calories >= 400 && meal.calories <= 700) score += 10
  if (timeOfDay === 'dinner' && meal.protein >= 25) score += 10

  // Penalize extremely high calories if user has little remaining
  if (remaining.calories < 500 && meal.calories > remaining.calories * 1.5) {
    score -= 30
  }

  return Math.max(0, Math.min(100, score))
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const restaurantBrand = searchParams.get('restaurantBrand')
    const userTargetsParam = searchParams.get('userTargets') // JSON string
    const timeOfDay = searchParams.get('timeOfDay') || 'lunch'

    if (!restaurantBrand) {
      return NextResponse.json({ error: 'Restaurant brand required' }, { status: 400 })
    }

    // Normalize restaurant name to match database brand names
    const normalizedBrand = normalizeRestaurantName(restaurantBrand)
    console.log(`🏪 Restaurant name normalized: "${restaurantBrand}" -> "${normalizedBrand}"`)

    // Get meals for this restaurant brand
    const meals = await prisma.orderTemplate.findMany({
      where: {
        restaurantBrand: normalizedBrand
      },
      orderBy: {
        title: 'asc'
      }
    })

    // Parse tags from JSON string
    let enhancedMeals = meals.map(meal => ({
      ...meal,
      tags: meal.tags ? JSON.parse(meal.tags) : []
    }))

    // If user targets provided, filter and score meals
    if (userTargetsParam) {
      try {
        const userTargets = JSON.parse(userTargetsParam)

        // Score all meals
        const scoredMeals = enhancedMeals.map(meal => ({
          ...meal,
          nutritionScore: calculateNutritionScore(meal, userTargets, timeOfDay)
        }))

        // Sort by score and take top 10 for AI analysis
        enhancedMeals = scoredMeals
          .sort((a, b) => b.nutritionScore - a.nutritionScore)
          .slice(0, 10)

      } catch (e) {
        console.error('Failed to parse user targets:', e)
        // Fallback to showing all meals if parsing fails
      }
    }

    return NextResponse.json({
      meals: enhancedMeals,
      count: enhancedMeals.length,
      filtered: !!userTargetsParam
    })
  } catch (error) {
    console.error('Failed to fetch restaurant meals:', error)
    return NextResponse.json({ error: 'Failed to fetch meals' }, { status: 500 })
  }
}
