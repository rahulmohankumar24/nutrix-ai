import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Infer meal type from current hour if not provided
function inferMealType(hour: number): string {
  if (hour < 11) return 'breakfast'
  if (hour < 16) return 'lunch'
  return 'dinner'
}

export async function POST(request: NextRequest) {
  try {
    const { userId, orderTemplateId, foodCatalogItemId, servings = 1, mealType } = await request.json()

    if (!userId || (!orderTemplateId && !foodCatalogItemId)) {
      return NextResponse.json({ error: 'User ID and either meal template or food catalog item required' }, { status: 400 })
    }

    const now = new Date()
    const inferredMealType = mealType || inferMealType(now.getHours())

    // Create meal log entry linking to either order template or food catalog item
    const data: any = {
      userId,
      servings: parseFloat(servings),
      datetime: now,
      mealType: inferredMealType
    }

    if (orderTemplateId) {
      data.orderTemplateId = orderTemplateId
    }

    if (foodCatalogItemId) {
      data.foodCatalogItemId = foodCatalogItemId
    }

    const mealLog = await prisma.mealLog.create({
      data
    })

    return NextResponse.json({ success: true, mealLog })
  } catch (error) {
    console.error('Failed to log meal:', error)
    return NextResponse.json({ error: 'Failed to log meal' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const date = searchParams.get('date') // YYYY-MM-DD format

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Get today's date if no date provided
    const targetDate = date ? new Date(date) : new Date()
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0))
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999))

    // Get meal logs for the specified date with related data
    const mealLogs = await prisma.mealLog.findMany({
      where: {
        userId,
        datetime: {
          gte: startOfDay,
          lte: endOfDay
        }
      },
      include: {
        orderTemplate: true,
        foodCatalogItem: true
      },
      orderBy: {
        datetime: 'desc'
      }
    })

    // Calculate totals for the day
    const totals = mealLogs.reduce((acc, meal) => {
      const template = meal.orderTemplate || meal.foodCatalogItem
      if (!template) return acc

      const servings = meal.servings || 1
      return {
        calories: acc.calories + (template.calories * servings),
        protein: acc.protein + (template.protein * servings),
        carbs: acc.carbs + (template.carbs * servings),
        fat: acc.fat + (template.fat * servings)
      }
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 })

    return NextResponse.json({
      mealLogs,
      totals,
      count: mealLogs.length
    })
  } catch (error) {
    console.error('Failed to get meal logs:', error)
    return NextResponse.json({ error: 'Failed to get meal logs' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const mealLogId = searchParams.get('mealLogId')
    const userId = searchParams.get('userId')

    if (!mealLogId || !userId) {
      return NextResponse.json({ error: 'Meal log ID and user ID required' }, { status: 400 })
    }

    // Verify the meal log belongs to the user before deleting
    const mealLog = await prisma.mealLog.findFirst({
      where: {
        id: mealLogId,
        userId: userId
      }
    })

    if (!mealLog) {
      return NextResponse.json({ error: 'Meal log not found' }, { status: 404 })
    }

    // Delete the meal log
    await prisma.mealLog.delete({
      where: {
        id: mealLogId
      }
    })

    return NextResponse.json({ success: true, message: 'Meal log deleted' })
  } catch (error) {
    console.error('Failed to delete meal log:', error)
    return NextResponse.json({ error: 'Failed to delete meal log' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { mealLogId, userId, servings, mealType } = body

    if (!mealLogId || !userId) {
      return NextResponse.json({ error: 'Meal log ID and user ID required' }, { status: 400 })
    }

    if (servings === undefined && mealType === undefined) {
      return NextResponse.json({ error: 'At least servings or mealType required' }, { status: 400 })
    }

    // Verify the meal log belongs to the user before updating
    const existingMealLog = await prisma.mealLog.findFirst({
      where: {
        id: mealLogId,
        userId: userId
      }
    })

    if (!existingMealLog) {
      return NextResponse.json({ error: 'Meal log not found' }, { status: 404 })
    }

    // Build update data
    const updateData: { servings?: number; mealType?: string } = {}
    if (servings !== undefined) {
      updateData.servings = parseFloat(servings)
    }
    if (mealType !== undefined) {
      updateData.mealType = mealType
    }

    // Update the meal log
    const updatedMealLog = await prisma.mealLog.update({
      where: {
        id: mealLogId
      },
      data: updateData,
      include: {
        orderTemplate: true,
        foodCatalogItem: true
      }
    })

    return NextResponse.json({ success: true, mealLog: updatedMealLog })
  } catch (error) {
    console.error('Failed to update meal log:', error)
    return NextResponse.json({ error: 'Failed to update meal log' }, { status: 500 })
  }
}