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

    // Get user profile for targets
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

    // Calculate daily totals
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

    // Calculate targets
    const targetProtein = profile?.weightLb ? Math.round(profile.weightLb * 0.8) : 150
    const targetCalories = 2000

    // Build data summary for AI
    const dataSummary = Object.entries(dailyTotals).map(([date, totals]) => {
      const d = new Date(date)
      return `${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}: ${totals.calories} cal, ${totals.protein}g protein`
    }).join('\n')

    const response = await openai.responses.create({
      model: 'gpt-4o-mini',
      input: [
        {
          role: 'system',
          content: `You are a nutrition coach analyzing a user's eating patterns. Identify OPPORTUNITIES for improvement - areas where they could do better. Be constructive, not critical. Frame things positively.

Return JSON array with 2-3 opportunities:
[
  {
    "title": "Short title (3-5 words)",
    "description": "What could be improved (1-2 sentences)",
    "suggestion": "A specific, actionable tip to address this"
  }
]

Only return the JSON array, no other text.`
        },
        {
          role: 'user',
          content: `User's goal: ${profile?.goal || 'general health'}
Target protein: ${targetProtein}g/day
Target calories: ~${targetCalories}/day

Recent meal data:
${dataSummary}

Identify opportunities for improvement.`
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
    console.error('Failed to generate opportunities:', error)
    return NextResponse.json({ error: 'Failed to generate insights' }, { status: 500 })
  }
}
