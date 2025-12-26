import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { MacroProgress } from '@/lib/types'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Get today's date
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Get today's targets
    const dailyTarget = await prisma.dailyTarget.findFirst({
      where: {
        userId,
        date: today
      }
    })

    if (!dailyTarget) {
      return NextResponse.json(
        { error: 'No targets found for today' },
        { status: 404 }
      )
    }

    // Get today's logged meals
    const mealLogs = await prisma.mealLog.findMany({
      where: {
        userId,
        datetime: {
          gte: today,
          lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
        }
      },
      include: {
        foodCatalogItem: true,
        orderTemplate: true
      }
    })

    // Calculate current intake
    let currentCalories = 0
    let currentProtein = 0
    let currentCarbs = 0
    let currentFat = 0

    mealLogs.forEach((log: any) => {
      const item = log.foodCatalogItem || log.orderTemplate
      if (item) {
        const multiplier = log.servings
        currentCalories += item.calories * multiplier
        currentProtein += item.protein * multiplier
        currentCarbs += item.carbs * multiplier
        currentFat += item.fat * multiplier
      }
    })

    const macroProgress: MacroProgress = {
      targets: {
        calories: dailyTarget.calories,
        protein: dailyTarget.protein,
        carbs: dailyTarget.carbs,
        fat: dailyTarget.fat
      },
      current: {
        calories: Math.round(currentCalories),
        protein: Math.round(currentProtein),
        carbs: Math.round(currentCarbs),
        fat: Math.round(currentFat)
      },
      remaining: {
        calories: Math.max(0, dailyTarget.calories - Math.round(currentCalories)),
        protein: Math.max(0, dailyTarget.protein - Math.round(currentProtein)),
        carbs: Math.max(0, dailyTarget.carbs - Math.round(currentCarbs)),
        fat: Math.max(0, dailyTarget.fat - Math.round(currentFat))
      }
    }

    return NextResponse.json(macroProgress)
  } catch (error) {
    console.error('Macro progress error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch macro progress' },
      { status: 500 }
    )
  }
}