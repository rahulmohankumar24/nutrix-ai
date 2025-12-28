import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Get user profile for targets
    const profile = await prisma.profile.findUnique({
      where: { userId }
    })

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Calculate default targets
    const weightKg = (profile.weightLb || 150) / 2.205
    const heightCm = (profile.heightIn || 70) * 2.54
    const age = profile.age || 25

    const bmr = profile.sex === 'male'
      ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
      : 10 * weightKg + 6.25 * heightCm - 5 * age - 161

    const activityMultiplier = profile.stepsLevel === 'high' ? 1.55 : profile.stepsLevel === 'med' ? 1.375 : 1.2
    const liftingBonus = (profile.liftingDays || 0) * 50

    let tdee = Math.round(bmr * activityMultiplier + liftingBonus)
    if (profile.goal === 'cut') tdee -= 500
    else if (profile.goal === 'lean_bulk') tdee += 300

    const targetCalories = tdee > 0 ? tdee : 2000
    const targetProtein = Math.round((profile.weightLb || 150) * 0.8)

    // Get all meal logs for the user to calculate stats
    const allMealLogs = await prisma.mealLog.findMany({
      where: { userId },
      include: {
        orderTemplate: true,
        foodCatalogItem: true
      },
      orderBy: {
        datetime: 'desc'
      }
    })

    // Helper to get local date string
    const getLocalDateStr = (date: Date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    // Group logs by date
    const logsByDate = new Map<string, { calories: number; protein: number }>()

    allMealLogs.forEach(log => {
      const dateStr = getLocalDateStr(new Date(log.datetime))
      const item = log.orderTemplate || log.foodCatalogItem
      if (!item) return

      const current = logsByDate.get(dateStr) || { calories: 0, protein: 0 }
      const servings = log.servings || 1

      logsByDate.set(dateStr, {
        calories: current.calories + Math.round(item.calories * servings),
        protein: current.protein + Math.round(item.protein * servings)
      })
    })

    // Calculate current streak (consecutive days with logs ending today or yesterday)
    const today = new Date()
    const todayStr = getLocalDateStr(today)

    let currentStreak = 0
    let checkDate = new Date()

    // Start from today, if no logs today, start from yesterday
    if (!logsByDate.has(todayStr)) {
      checkDate.setDate(checkDate.getDate() - 1)
    }

    while (true) {
      const dateStr = getLocalDateStr(checkDate)
      if (logsByDate.has(dateStr)) {
        currentStreak++
        checkDate.setDate(checkDate.getDate() - 1)
      } else {
        break
      }
    }

    // Calculate longest streak
    const sortedDates = Array.from(logsByDate.keys()).sort()
    let longestStreak = 0
    let tempStreak = 0
    let prevDate: Date | null = null

    for (const dateStr of sortedDates) {
      const currentDate = new Date(dateStr)

      if (prevDate) {
        const diffDays = Math.round((currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24))
        if (diffDays === 1) {
          tempStreak++
        } else {
          longestStreak = Math.max(longestStreak, tempStreak)
          tempStreak = 1
        }
      } else {
        tempStreak = 1
      }

      prevDate = currentDate
    }
    longestStreak = Math.max(longestStreak, tempStreak)

    // Total days logged
    const totalDaysLogged = logsByDate.size

    // Calculate this week's stats
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
    sevenDaysAgo.setHours(0, 0, 0, 0)

    let daysOnTrack = 0
    let totalCaloriesThisWeek = 0
    let totalProteinThisWeek = 0
    let daysWithDataThisWeek = 0

    for (let i = 0; i < 7; i++) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = getLocalDateStr(date)

      const dayData = logsByDate.get(dateStr)
      if (dayData) {
        daysWithDataThisWeek++
        totalCaloriesThisWeek += dayData.calories
        totalProteinThisWeek += dayData.protein

        // On track if within 10% of target for both calories and protein
        const calInRange = dayData.calories >= targetCalories * 0.8 && dayData.calories <= targetCalories * 1.2
        const protInRange = dayData.protein >= targetProtein * 0.8

        if (calInRange && protInRange) {
          daysOnTrack++
        }
      }
    }

    const avgCalories = daysWithDataThisWeek > 0 ? Math.round(totalCaloriesThisWeek / daysWithDataThisWeek) : 0
    const avgProtein = daysWithDataThisWeek > 0 ? Math.round(totalProteinThisWeek / daysWithDataThisWeek) : 0
    const weeklyGoalHit = daysWithDataThisWeek > 0 ? Math.round((daysOnTrack / 7) * 100) : 0

    return NextResponse.json({
      currentStreak,
      longestStreak,
      daysOnTrack,
      totalDaysLogged,
      avgCalories,
      avgProtein,
      weeklyGoalHit,
      targetCalories,
      targetProtein
    })
  } catch (error) {
    console.error('Failed to get weekly stats:', error)
    return NextResponse.json({ error: 'Failed to get weekly stats' }, { status: 500 })
  }
}
