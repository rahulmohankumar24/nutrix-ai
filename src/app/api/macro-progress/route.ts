import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { MacroProgress } from '@/lib/types'
import { calculateTargets } from '@/lib/calculations'

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

    let dailyTargetToUse = dailyTarget

    if (!dailyTarget) {
      // Get user profile to calculate targets
      const profile = await prisma.profile.findUnique({
        where: { userId }
      })

      if (!profile) {
        return NextResponse.json(
          { error: 'User profile not found' },
          { status: 404 }
        )
      }

      // Calculate targets based on profile
      const calculatedTargets = calculateTargets(
        profile.heightIn,
        profile.weightLb,
        profile.age || 27,
        profile.sex as 'male' | 'female' | 'other',
        profile.goal as 'recomp' | 'lean_bulk' | 'cut',
        profile.liftingDays,
        profile.stepsLevel as 'low' | 'med' | 'high'
      )

      // Create today's targets
      dailyTargetToUse = await prisma.dailyTarget.create({
        data: {
          userId,
          date: today,
          calories: calculatedTargets.calories,
          protein: calculatedTargets.protein,
          carbs: calculatedTargets.carbs,
          fat: calculatedTargets.fat
        }
      })
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
        calories: dailyTargetToUse?.calories || 0,
        protein: dailyTargetToUse?.protein || 0,
        carbs: dailyTargetToUse?.carbs || 0,
        fat: dailyTargetToUse?.fat || 0
      },
      current: {
        calories: Math.round(currentCalories),
        protein: Math.round(currentProtein),
        carbs: Math.round(currentCarbs),
        fat: Math.round(currentFat)
      },
      remaining: {
        calories: Math.max(0, (dailyTargetToUse?.calories || 0) - Math.round(currentCalories)),
        protein: Math.max(0, (dailyTargetToUse?.protein || 0) - Math.round(currentProtein)),
        carbs: Math.max(0, (dailyTargetToUse?.carbs || 0) - Math.round(currentCarbs)),
        fat: Math.max(0, (dailyTargetToUse?.fat || 0) - Math.round(currentFat))
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