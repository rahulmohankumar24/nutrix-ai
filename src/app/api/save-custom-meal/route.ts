import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const {
      userId,
      restaurantBrand,
      title,
      description,
      calories,
      protein,
      carbs,
      fat,
      ingredients,
      buildInstructions,
      customizations
    } = await request.json()

    if (!userId || !restaurantBrand || !title || calories === undefined || protein === undefined) {
      return NextResponse.json({
        error: 'Missing required fields: userId, restaurantBrand, title, calories, protein'
      }, { status: 400 })
    }

    // Create order template for this custom meal
    const orderTemplate = await prisma.orderTemplate.create({
      data: {
        restaurantBrand,
        title,
        description: buildInstructions || description || '',
        calories: parseFloat(calories),
        protein: parseFloat(protein),
        carbs: parseFloat(carbs || 0),
        fat: parseFloat(fat || 0),
        tags: JSON.stringify([
          'custom',
          restaurantBrand.toLowerCase(),
          ...(customizations && customizations.length > 0 ? ['customized'] : [])
        ]),
        keywordsForDeliverySearch: title.toLowerCase()
      }
    })

    // Immediately log the meal
    const mealLog = await prisma.mealLog.create({
      data: {
        userId,
        orderTemplateId: orderTemplate.id,
        servings: 1,
        datetime: new Date()
      },
      include: {
        orderTemplate: true
      }
    })

    return NextResponse.json({
      success: true,
      orderTemplate,
      mealLog,
      message: 'Meal saved and logged successfully'
    })
  } catch (error) {
    console.error('Failed to save custom meal:', error)
    return NextResponse.json({
      error: 'Failed to save custom meal',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
