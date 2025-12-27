import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { userId, name, calories, protein, carbs, fat, servings = 1, mealType } = await request.json()

    if (!userId || !name || calories === undefined || protein === undefined) {
      return NextResponse.json(
        { error: 'userId, name, calories, and protein are required' },
        { status: 400 }
      )
    }

    // Create the food catalog item
    const foodCatalogItem = await prisma.foodCatalogItem.create({
      data: {
        source: 'user_logged',
        name,
        calories: Math.round(calories / servings), // Store per-serving values
        protein: Math.round(protein / servings),
        carbs: Math.round((carbs || 0) / servings),
        fat: Math.round((fat || 0) / servings),
        tags: '[]'
      }
    })

    // Log the meal with the user-selected meal type
    const mealLog = await prisma.mealLog.create({
      data: {
        userId,
        foodCatalogItemId: foodCatalogItem.id,
        servings: parseFloat(String(servings)),
        datetime: new Date(),
        mealType: mealType || 'dinner' // Default to dinner if not specified
      },
      include: {
        foodCatalogItem: true
      }
    })

    return NextResponse.json({
      success: true,
      mealLog,
      message: `Logged "${name}" for ${mealType}`
    })
  } catch (error) {
    console.error('Failed to log meal directly:', error)
    return NextResponse.json(
      { error: 'Failed to log meal' },
      { status: 500 }
    )
  }
}
