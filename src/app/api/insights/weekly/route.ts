import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

// Helper to get today's date string at midnight
function getTodayDateString(): string {
  const today = new Date()
  return today.toISOString().split('T')[0]
}

// Helper to check if cache was generated today (after midnight)
function isCacheFromToday(generatedAt: Date): boolean {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  return generatedAt >= todayStart
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    const todayStr = getTodayDateString()

    // Check for cached insight from today
    const cachedInsight = await prisma.weeklyInsightCache.findUnique({
      where: {
        userId_weekStartDate: {
          userId,
          weekStartDate: todayStr
        }
      }
    })

    // If cache exists and was generated today, return it immediately
    if (cachedInsight && isCacheFromToday(cachedInsight.generatedAt)) {
      const cachedDays = JSON.parse(cachedInsight.daysData)
      return NextResponse.json({
        days: cachedDays,
        summary: cachedInsight.summary,
        cached: true
      })
    }

    // No valid cache - generate fresh data
    const days: { dayName: string; date: string; calories: number; caloriesTarget: number; protein: number; proteinTarget: number; summary: string }[] = []

    const today = new Date()
    today.setHours(23, 59, 59, 999)

    // Get user profile for targets
    const profile = await prisma.profile.findUnique({
      where: { userId }
    })

    const targetProtein = profile?.weightLb ? Math.round(profile.weightLb * 0.8) : 150
    const targetCalories = 2000

    // Get meal logs for past 7 days
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 6)
    weekAgo.setHours(0, 0, 0, 0)

    const mealLogs = await prisma.mealLog.findMany({
      where: {
        userId,
        datetime: { gte: weekAgo, lte: today }
      },
      include: {
        orderTemplate: true,
        foodCatalogItem: true
      }
    })

    // Group by date
    const dailyTotals: Record<string, { calories: number; protein: number; carbs: number; fat: number }> = {}

    mealLogs.forEach(log => {
      const date = log.datetime.toISOString().split('T')[0]
      const item = log.orderTemplate || log.foodCatalogItem
      if (!item) return

      const servings = log.servings || 1
      if (!dailyTotals[date]) {
        dailyTotals[date] = { calories: 0, protein: 0, carbs: 0, fat: 0 }
      }
      dailyTotals[date].calories += Math.round(item.calories * servings)
      dailyTotals[date].protein += Math.round(item.protein * servings)
      dailyTotals[date].carbs += Math.round(item.carbs * servings)
      dailyTotals[date].fat += Math.round(item.fat * servings)
    })

    // Build days array for past 7 days
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      const totals = dailyTotals[dateStr] || { calories: 0, protein: 0, carbs: 0, fat: 0 }

      days.push({
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        calories: totals.calories,
        caloriesTarget: targetCalories,
        protein: totals.protein,
        proteinTarget: targetProtein,
        summary: ''
      })
    }

    // Generate AI summary
    const daysWithData = days.filter(d => d.calories > 0)
    let summary = ''

    if (daysWithData.length >= 1) {
      const dataSummary = days.map(d =>
        `${d.dayName} ${d.date}: ${d.calories > 0 ? `${d.calories} cal, ${d.protein}g protein` : 'No data'}`
      ).join('\n')

      try {
        const response = await openai.responses.create({
          model: 'gpt-4o-mini',
          input: [
            {
              role: 'system',
              content: `You are a nutrition coach giving a brief weekly summary. Be conversational and encouraging. Focus on the story of the week - what went well, what could improve. Keep it to 2-3 sentences max.`
            },
            {
              role: 'user',
              content: `User's goal: ${profile?.goal || 'general health'}
Target: ${targetCalories} cal, ${targetProtein}g protein per day

This week's data:
${dataSummary}

Give a brief, friendly summary of their week.`
            }
          ]
        })

        summary = response.output_text || ''
      } catch {
        summary = ''
      }
    }

    // Cache the result for today
    await prisma.weeklyInsightCache.upsert({
      where: {
        userId_weekStartDate: {
          userId,
          weekStartDate: todayStr
        }
      },
      update: {
        summary,
        daysData: JSON.stringify(days),
        generatedAt: new Date()
      },
      create: {
        userId,
        weekStartDate: todayStr,
        summary,
        daysData: JSON.stringify(days)
      }
    })

    return NextResponse.json({
      days,
      summary,
      cached: false
    })
  } catch (error) {
    console.error('Failed to generate weekly data:', error)
    return NextResponse.json({ error: 'Failed to generate insights' }, { status: 500 })
  }
}
