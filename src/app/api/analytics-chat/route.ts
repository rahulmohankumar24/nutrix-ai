import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { prisma } from '@/lib/prisma'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(request: NextRequest) {
  try {
    const { message, userId } = await request.json()

    if (!message || !userId) {
      return NextResponse.json(
        { error: 'Message and userId are required' },
        { status: 400 }
      )
    }

    // Fetch comprehensive user data for context
    const [profile, weeklyData, recentMeals, patterns] = await Promise.all([
      prisma.profile.findUnique({ where: { userId } }),
      fetchWeeklyStats(userId),
      fetchRecentMeals(userId),
      prisma.userPattern.findMany({
        where: { userId },
        orderBy: { confidence: 'desc' },
        take: 10
      })
    ])

    // Build rich context for the AI
    const userContext = buildUserContext(profile, weeklyData, recentMeals, patterns)

    const systemPrompt = `You are Rovia, a knowledgeable nutrition analyst. Users will ask questions about their eating habits, nutrition patterns, and health progress.

${userContext}

GUIDELINES:
1. Answer questions based on the user's actual data provided above
2. Be specific - reference actual numbers, days, and patterns from their data
3. Give actionable insights when relevant
4. Keep responses concise but informative (3-5 sentences max)
5. If asked about something not in their data, acknowledge the limitation
6. Be encouraging but honest about areas needing improvement
7. Use their goal (${profile?.goal || 'general health'}) to frame advice

Respond naturally as a helpful nutrition coach. Do NOT use markdown formatting.`

    const completion = await openai.responses.create({
      model: 'gpt-4o-mini',
      input: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ]
    })

    const responseText = completion.output_text
    if (!responseText) {
      throw new Error('No response from OpenAI')
    }

    return NextResponse.json({
      success: true,
      message: responseText
    })

  } catch (error) {
    console.error('Analytics chat error:', error)
    return NextResponse.json(
      {
        error: 'Failed to process message',
        message: "Sorry, I couldn't analyze that. Try asking another way?"
      },
      { status: 500 }
    )
  }
}

async function fetchWeeklyStats(userId: string) {
  const today = new Date()
  today.setHours(23, 59, 59, 999)

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
  const dailyTotals: Record<string, {
    calories: number
    protein: number
    carbs: number
    fat: number
    mealCount: number
    meals: string[]
  }> = {}

  mealLogs.forEach(log => {
    const date = log.datetime.toISOString().split('T')[0]
    const item = log.orderTemplate || log.foodCatalogItem
    if (!item) return

    const servings = log.servings || 1
    if (!dailyTotals[date]) {
      dailyTotals[date] = { calories: 0, protein: 0, carbs: 0, fat: 0, mealCount: 0, meals: [] }
    }
    dailyTotals[date].calories += Math.round(item.calories * servings)
    dailyTotals[date].protein += Math.round(item.protein * servings)
    dailyTotals[date].carbs += Math.round(item.carbs * servings)
    dailyTotals[date].fat += Math.round(item.fat * servings)
    dailyTotals[date].mealCount++

    const mealName = 'title' in item ? item.title : item.name
    dailyTotals[date].meals.push(mealName)
  })

  // Build daily summaries for last 7 days
  const days: { dayName: string; date: string; data: typeof dailyTotals[string] | null }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    days.push({
      dayName: d.toLocaleDateString('en-US', { weekday: 'long' }),
      date: dateStr,
      data: dailyTotals[dateStr] || null
    })
  }

  return { days, dailyTotals }
}

async function fetchRecentMeals(userId: string) {
  const oneWeekAgo = new Date()
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

  const mealLogs = await prisma.mealLog.findMany({
    where: {
      userId,
      datetime: { gte: oneWeekAgo }
    },
    include: {
      orderTemplate: true,
      foodCatalogItem: true
    },
    orderBy: { datetime: 'desc' },
    take: 20
  })

  return mealLogs.map(log => {
    const item = log.orderTemplate || log.foodCatalogItem
    if (!item) return null
    return {
      name: 'title' in item ? item.title : item.name,
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat,
      mealType: log.mealType,
      date: log.datetime.toISOString().split('T')[0],
      dayOfWeek: log.datetime.toLocaleDateString('en-US', { weekday: 'long' })
    }
  }).filter(Boolean)
}

function buildUserContext(
  profile: any,
  weeklyData: { days: any[]; dailyTotals: Record<string, any> },
  recentMeals: any[],
  patterns: any[]
) {
  let context = 'USER DATA:\n\n'

  // Profile info
  if (profile) {
    context += `PROFILE:
- Goal: ${profile.goal || 'not set'}
- Weight: ${profile.weightLb || 'unknown'} lbs
- Lifting days per week: ${profile.liftingDays || 0}
- Activity level: ${profile.stepsLevel || 'unknown'}
- Dietary constraints: ${profile.constraints || 'none'}
- Dislikes: ${profile.dislikes || 'none'}
\n`
  }

  // Calculate targets
  const targetProtein = profile?.weightLb ? Math.round(profile.weightLb * 0.8) : 150
  const targetCalories = 2000
  context += `DAILY TARGETS: ~${targetCalories} calories, ${targetProtein}g protein\n\n`

  // Weekly summary
  context += 'LAST 7 DAYS:\n'
  const daysWithData = weeklyData.days.filter(d => d.data)

  if (daysWithData.length === 0) {
    context += 'No meals logged in the past week.\n'
  } else {
    weeklyData.days.forEach(day => {
      if (day.data) {
        const d = day.data
        const calPercent = Math.round((d.calories / targetCalories) * 100)
        const proPercent = Math.round((d.protein / targetProtein) * 100)
        context += `- ${day.dayName} (${day.date}): ${d.calories} cal (${calPercent}%), ${d.protein}g protein (${proPercent}%), ${d.mealCount} meals\n`
      } else {
        context += `- ${day.dayName} (${day.date}): No data logged\n`
      }
    })

    // Calculate averages
    const avgCalories = Math.round(daysWithData.reduce((sum, d) => sum + d.data.calories, 0) / daysWithData.length)
    const avgProtein = Math.round(daysWithData.reduce((sum, d) => sum + d.data.protein, 0) / daysWithData.length)
    context += `\nWEEKLY AVERAGES: ${avgCalories} cal/day, ${avgProtein}g protein/day\n`
    context += `Days logged: ${daysWithData.length}/7\n`
  }

  // Recent meals
  if (recentMeals.length > 0) {
    context += '\nRECENT MEALS (last 10):\n'
    recentMeals.slice(0, 10).forEach(meal => {
      context += `- ${meal.name}: ${meal.calories} cal, ${meal.protein}g protein (${meal.mealType || 'meal'} on ${meal.dayOfWeek})\n`
    })

    // Find most frequent meals
    const mealFrequency: Record<string, number> = {}
    recentMeals.forEach(meal => {
      mealFrequency[meal.name] = (mealFrequency[meal.name] || 0) + 1
    })
    const topMeals = Object.entries(mealFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)

    if (topMeals.length > 0) {
      context += '\nMOST FREQUENT MEALS: ' + topMeals.map(([name, count]) => `${name} (${count}x)`).join(', ') + '\n'
    }
  }

  // Patterns
  if (patterns.length > 0) {
    context += '\nDETECTED PATTERNS:\n'
    patterns.slice(0, 5).forEach(p => {
      const value = typeof p.patternValue === 'string' ? JSON.parse(p.patternValue) : p.patternValue
      context += `- ${p.patternType}: ${p.patternKey} (confidence: ${Math.round(p.confidence * 100)}%)\n`
    })
  }

  return context
}
