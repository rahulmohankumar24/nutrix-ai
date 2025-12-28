import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Get meal logs from the past 14 days
    const twoWeeksAgo = new Date()
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)

    const mealLogs = await prisma.mealLog.findMany({
      where: {
        userId,
        datetime: { gte: twoWeeksAgo }
      },
      include: {
        orderTemplate: true,
        foodCatalogItem: true
      },
      orderBy: { datetime: 'asc' }
    })

    // Get user profile
    const profile = await prisma.profile.findUnique({
      where: { userId }
    })

    // Count unique days with logs
    const uniqueDays = new Set(
      mealLogs.map(log => log.datetime.toISOString().split('T')[0])
    )
    const daysLogged = uniqueDays.size

    if (daysLogged < 3) {
      return NextResponse.json({
        insights: [],
        daysLogged,
        message: 'Need more data'
      })
    }

    // Analyze meal timing patterns
    const mealsByHour: Record<number, number> = {}
    const mealsByDay: Record<string, number> = {}
    const mealTypes: Record<string, number> = {}

    mealLogs.forEach(log => {
      const hour = log.datetime.getHours()
      const dayName = log.datetime.toLocaleDateString('en-US', { weekday: 'long' })
      const mealType = log.mealType || 'unknown'

      mealsByHour[hour] = (mealsByHour[hour] || 0) + 1
      mealsByDay[dayName] = (mealsByDay[dayName] || 0) + 1
      mealTypes[mealType] = (mealTypes[mealType] || 0) + 1
    })

    // Calculate daily totals for weekday vs weekend
    const dailyData: { date: string; dayName: string; calories: number; protein: number }[] = []

    const dailyTotals: Record<string, { calories: number; protein: number }> = {}
    mealLogs.forEach(log => {
      const date = log.datetime.toISOString().split('T')[0]
      const item = log.orderTemplate || log.foodCatalogItem
      if (!item) return

      const servings = log.servings || 1
      if (!dailyTotals[date]) {
        dailyTotals[date] = { calories: 0, protein: 0 }
      }
      dailyTotals[date].calories += Math.round(item.calories * servings)
      dailyTotals[date].protein += Math.round(item.protein * servings)
    })

    Object.entries(dailyTotals).forEach(([date, totals]) => {
      const d = new Date(date)
      dailyData.push({
        date,
        dayName: d.toLocaleDateString('en-US', { weekday: 'long' }),
        ...totals
      })
    })

    // Build pattern summary
    const patternSummary = `
Meal timing (by hour): ${Object.entries(mealsByHour).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([h, c]) => `${h}:00 (${c} meals)`).join(', ')}
Meals by day: ${Object.entries(mealsByDay).sort((a, b) => b[1] - a[1]).map(([d, c]) => `${d}: ${c}`).join(', ')}
Meal types: ${Object.entries(mealTypes).map(([t, c]) => `${t}: ${c}`).join(', ')}

Daily breakdown:
${dailyData.map(d => `${d.dayName} ${d.date}: ${d.calories} cal, ${d.protein}g protein`).join('\n')}
`

    const response = await openai.responses.create({
      model: 'gpt-4o-mini',
      input: [
        {
          role: 'system',
          content: `You are a nutrition coach analyzing eating PATTERNS. Look for recurring behaviors, timing patterns, weekday vs weekend differences, etc. Be observational, not judgmental.

Return JSON array with 3-4 patterns:
[
  {
    "title": "Short pattern name (3-5 words)",
    "description": "Description of the pattern (1-2 sentences)",
    "frequency": "How often this occurs (e.g., 'Most days', '3x per week', 'Weekends')"
  }
]

Only return the JSON array, no other text.`
        },
        {
          role: 'user',
          content: `User's goal: ${profile?.goal || 'general health'}

Pattern data:
${patternSummary}

Identify recurring patterns in their eating behavior.`
        }
      ]
    })

    let insights = []
    try {
      const content = response.output_text || '[]'
      insights = JSON.parse(content)
    } catch {
      insights = []
    }

    return NextResponse.json({
      insights,
      daysLogged
    })
  } catch (error) {
    console.error('Failed to generate patterns:', error)
    return NextResponse.json({ error: 'Failed to generate insights' }, { status: 500 })
  }
}
