import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Nutrition scoring algorithm (same as restaurant meals)
function calculateNutritionScore(food: any, targets: any, timeOfDay: string) {
  const { remaining } = targets

  // Base score calculation - how well food fits remaining targets
  let score = 0
  let maxScore = 0

  // Protein score (40% weight) - critical for all times
  const proteinFit = Math.min(1, food.protein / Math.max(remaining.protein * 0.7, 10))
  score += proteinFit * 0.4 * 100
  maxScore += 0.4 * 100

  // Calorie score (30% weight) - avoid going way over
  const calorieFit = remaining.calories > 0 ?
    Math.min(1, Math.max(0, 1 - Math.abs(food.calories - remaining.calories * 0.3) / (remaining.calories * 0.5))) : 0.5
  score += calorieFit * 0.3 * 100
  maxScore += 0.3 * 100

  // Carb score (20% weight) - time-dependent
  let carbWeight = 0.2
  if (timeOfDay === 'breakfast' || timeOfDay === 'lunch') carbWeight = 0.25
  if (timeOfDay === 'dinner') carbWeight = 0.15

  const carbFit = remaining.carbs > 0 ? Math.min(1, food.carbs / Math.max(remaining.carbs * 0.4, 15)) : 0.5
  score += carbFit * carbWeight * 100
  maxScore += carbWeight * 100

  // Fat score (10% weight)
  const fatFit = remaining.fat > 0 ? Math.min(1, food.fat / Math.max(remaining.fat * 0.5, 10)) : 0.5
  score += fatFit * 0.1 * 100
  maxScore += 0.1 * 100

  // Snack-friendly bonus for smaller items
  if (timeOfDay === 'snack' && food.calories >= 100 && food.calories <= 300) score += 15
  if (timeOfDay === 'snack' && food.protein >= 10) score += 10

  // Penalize extremely high calories for snacks
  if (timeOfDay === 'snack' && food.calories > 400) score -= 20

  return Math.max(0, Math.min(100, score))
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userTargetsParam = searchParams.get('userTargets') // JSON string
    const timeOfDay = searchParams.get('timeOfDay') || 'snack'
    const source = searchParams.get('source') // home | grocery | restaurant

    let whereClause: any = {}

    if (source) {
      whereClause.source = source
    }

    // Get food items
    const foodItems = await prisma.foodCatalogItem.findMany({
      where: whereClause,
      orderBy: {
        name: 'asc'
      }
    })

    // Parse tags from JSON string
    let enhancedFoodItems = foodItems.map(food => ({
      ...food,
      tags: food.tags ? JSON.parse(food.tags) : []
    }))

    // If user targets provided, filter and score food items
    if (userTargetsParam) {
      try {
        const userTargets = JSON.parse(userTargetsParam)

        // Score all food items
        const scoredFoodItems = enhancedFoodItems.map(food => ({
          ...food,
          nutritionScore: calculateNutritionScore(food, userTargets, timeOfDay)
        }))

        // Sort by score and take top 15 for AI analysis (more variety for snacks)
        enhancedFoodItems = scoredFoodItems
          .sort((a, b) => b.nutritionScore - a.nutritionScore)
          .slice(0, 15)

      } catch (e) {
        console.error('Failed to parse user targets:', e)
        // Fallback to showing all food items if parsing fails
      }
    }

    return NextResponse.json({
      foods: enhancedFoodItems,
      count: enhancedFoodItems.length,
      filtered: !!userTargetsParam
    })
  } catch (error) {
    console.error('Failed to fetch food catalog:', error)
    return NextResponse.json({ error: 'Failed to fetch food items' }, { status: 500 })
  }
}

// Update a food catalog item's nutrition values
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { foodCatalogItemId, calories, protein, carbs, fat } = body

    if (!foodCatalogItemId) {
      return NextResponse.json({ error: 'Food catalog item ID required' }, { status: 400 })
    }

    // Build update data - only update provided fields
    const updateData: { calories?: number; protein?: number; carbs?: number; fat?: number } = {}
    if (calories !== undefined) updateData.calories = Math.round(calories)
    if (protein !== undefined) updateData.protein = Math.round(protein)
    if (carbs !== undefined) updateData.carbs = Math.round(carbs)
    if (fat !== undefined) updateData.fat = Math.round(fat)

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'At least one nutrition field required' }, { status: 400 })
    }

    const updatedItem = await prisma.foodCatalogItem.update({
      where: { id: foodCatalogItemId },
      data: updateData
    })

    return NextResponse.json({ success: true, food: updatedItem })
  } catch (error) {
    console.error('Failed to update food catalog item:', error)
    return NextResponse.json({ error: 'Failed to update food item' }, { status: 500 })
  }
}