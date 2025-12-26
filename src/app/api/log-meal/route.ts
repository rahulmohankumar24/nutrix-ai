import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { userId, orderTemplateId, servings = 1 } = await request.json()

    if (!userId || !orderTemplateId) {
      return NextResponse.json({ error: 'User ID and meal template required' }, { status: 400 })
    }

    // Create meal log entry linking to the order template
    const mealLog = await prisma.mealLog.create({
      data: {
        userId,
        orderTemplateId,
        servings: parseFloat(servings),
        datetime: new Date()
      }
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