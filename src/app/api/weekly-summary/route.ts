import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Get the last 7 days (including today)
    const today = new Date()
    today.setHours(23, 59, 59, 999)

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
    sevenDaysAgo.setHours(0, 0, 0, 0)

    // Fetch all meal logs for the past 7 days
    const mealLogs = await prisma.mealLog.findMany({
      where: {
        userId,
        datetime: {
          gte: sevenDaysAgo,
          lte: today
        }
      },
      include: {
        orderTemplate: true,
        foodCatalogItem: true
      },
      orderBy: {
        datetime: 'asc'
      }
    })

    // Fetch daily targets for the past 7 days
    const dailyTargets = await prisma.dailyTarget.findMany({
      where: {
        userId,
        date: {
          gte: sevenDaysAgo,
          lte: today
        }
      }
    })

    // Get user profile for default targets if needed
    const profile = await prisma.profile.findUnique({
      where: { userId }
    })

    // Calculate default targets from profile if no daily targets exist
    let defaultTargets = { calories: 2000, protein: 150, carbs: 200, fat: 70 }
    if (profile && profile.weightLb && profile.heightIn) {
      // Simple target calculation based on profile
      const weightKg = profile.weightLb / 2.205
      const heightCm = profile.heightIn * 2.54
      const age = profile.age || 25

      const bmr = profile.sex === 'male'
        ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
        : 10 * weightKg + 6.25 * heightCm - 5 * age - 161

      const activityMultiplier = profile.stepsLevel === 'high' ? 1.55 : profile.stepsLevel === 'med' ? 1.375 : 1.2
      const liftingBonus = (profile.liftingDays || 0) * 50

      let tdee = Math.round(bmr * activityMultiplier + liftingBonus)

      // Adjust for goal
      if (profile.goal === 'cut') tdee -= 500
      else if (profile.goal === 'lean_bulk') tdee += 300

      // Only use calculated values if they're valid numbers
      if (!isNaN(tdee) && tdee > 0) {
        defaultTargets = {
          calories: tdee,
          protein: Math.round(profile.weightLb * 0.8), // 0.8g per lb
          carbs: Math.round((tdee * 0.4) / 4), // 40% from carbs
          fat: Math.round((tdee * 0.25) / 9) // 25% from fat
        }
      }
    }

    // Helper to get local date string (YYYY-MM-DD) from a Date
    const getLocalDateStr = (date: Date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    // Create a map of daily targets by date string
    const targetsByDate = new Map<string, typeof dailyTargets[0]>()
    dailyTargets.forEach(target => {
      const dateStr = getLocalDateStr(new Date(target.date))
      targetsByDate.set(dateStr, target)
    })

    // Group meal logs by LOCAL date and calculate daily totals
    const dailyTotals = new Map<string, { calories: number; protein: number; carbs: number; fat: number }>()

    mealLogs.forEach(log => {
      const dateStr = getLocalDateStr(new Date(log.datetime))
      const item = log.orderTemplate || log.foodCatalogItem
      if (!item) return

      const current = dailyTotals.get(dateStr) || { calories: 0, protein: 0, carbs: 0, fat: 0 }
      const servings = log.servings || 1

      dailyTotals.set(dateStr, {
        calories: current.calories + Math.round(item.calories * servings),
        protein: current.protein + Math.round(item.protein * servings),
        carbs: current.carbs + Math.round(item.carbs * servings),
        fat: current.fat + Math.round(item.fat * servings)
      })
    })

    // Build the 7-day array
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const fullDayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const days = []

    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      date.setHours(0, 0, 0, 0)
      const dateStr = getLocalDateStr(date)

      const totals = dailyTotals.get(dateStr) || { calories: 0, protein: 0, carbs: 0, fat: 0 }
      const targets = targetsByDate.get(dateStr)

      // Ensure targets are valid positive numbers
      let caloriesTarget = targets?.calories || defaultTargets.calories
      let proteinTarget = targets?.protein || defaultTargets.protein

      // Final safety check - use safe defaults if still invalid
      if (!caloriesTarget || caloriesTarget <= 0 || isNaN(caloriesTarget)) caloriesTarget = 2000
      if (!proteinTarget || proteinTarget <= 0 || isNaN(proteinTarget)) proteinTarget = 150

      // Calculate summary based on performance
      let summary = 'No data'
      if (totals.calories > 0) {
        const calPercent = (totals.calories / caloriesTarget) * 100
        const protPercent = (totals.protein / proteinTarget) * 100
        const avgPercent = (calPercent + protPercent) / 2

        if (avgPercent >= 90) summary = 'Excellent'
        else if (avgPercent >= 80) summary = 'Strong day'
        else if (avgPercent >= 70) summary = 'Good effort'
        else if (avgPercent >= 50) summary = 'Under target'
        else summary = 'Light day'
      }

      const isToday = i === 0

      days.push({
        label: dayNames[date.getDay()],
        dayName: fullDayNames[date.getDay()],
        date: dateStr,
        calories: totals.calories,
        caloriesTarget,
        protein: totals.protein,
        proteinTarget,
        carbs: totals.carbs,
        fat: totals.fat,
        summary,
        isCurrent: isToday
      })
    }

    return NextResponse.json({ days })
  } catch (error) {
    console.error('Failed to get weekly summary:', error)
    return NextResponse.json({ error: 'Failed to get weekly summary' }, { status: 500 })
  }
}
