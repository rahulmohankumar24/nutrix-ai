import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateTargets } from '@/lib/calculations'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    // Get user profile
    const profile = await prisma.profile.findUnique({
      where: { userId }
    })

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Get today's date range
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Get targets
    let targets = await prisma.dailyTarget.findFirst({
      where: { userId, date: today }
    })

    if (!targets) {
      const calculatedTargets = calculateTargets(
        profile.heightIn,
        profile.weightLb,
        profile.age || 27,
        profile.sex as 'male' | 'female' | 'other',
        profile.goal as 'recomp' | 'lean_bulk' | 'cut',
        profile.liftingDays,
        profile.stepsLevel as 'low' | 'med' | 'high'
      )
      targets = {
        id: '',
        userId,
        date: today,
        calories: calculatedTargets.calories,
        protein: calculatedTargets.protein,
        carbs: calculatedTargets.carbs,
        fat: calculatedTargets.fat
      }
    }

    // Get today's meal logs
    const mealLogs = await prisma.mealLog.findMany({
      where: {
        userId,
        datetime: { gte: today, lt: tomorrow }
      },
      include: {
        orderTemplate: true,
        foodCatalogItem: true
      },
      orderBy: { datetime: 'asc' }
    })

    // Calculate current totals
    let current = { calories: 0, protein: 0, carbs: 0, fat: 0 }
    const mealNames: string[] = []

    mealLogs.forEach(log => {
      if (log.orderTemplate) {
        current.calories += Math.round(log.orderTemplate.calories * log.servings)
        current.protein += Math.round(log.orderTemplate.protein * log.servings)
        current.carbs += Math.round(log.orderTemplate.carbs * log.servings)
        current.fat += Math.round(log.orderTemplate.fat * log.servings)
        mealNames.push(log.orderTemplate.title || 'meal')
      } else if (log.foodCatalogItem) {
        current.calories += Math.round(log.foodCatalogItem.calories * log.servings)
        current.protein += Math.round(log.foodCatalogItem.protein * log.servings)
        current.carbs += Math.round(log.foodCatalogItem.carbs * log.servings)
        current.fat += Math.round(log.foodCatalogItem.fat * log.servings)
        mealNames.push(log.foodCatalogItem.name || 'meal')
      }
    })

    const remaining = {
      calories: Math.max(0, targets.calories - current.calories),
      protein: Math.max(0, targets.protein - current.protein),
      carbs: Math.max(0, targets.carbs - current.carbs),
      fat: Math.max(0, targets.fat - current.fat)
    }

    const hour = new Date().getHours()
    const timeOfDay = hour < 11 ? 'morning' : hour < 16 ? 'afternoon' : 'evening'
    const mealsRemaining = hour < 11 ? 3 : hour < 16 ? 2 : 1

    // Generate AI insights
    const prompt = `You are a concise nutrition coach. Analyze this user's day and provide 2-3 brief, actionable insights.

User Goal: ${profile.goal === 'recomp' ? 'body recomposition' : profile.goal === 'lean_bulk' ? 'lean muscle gain' : 'fat loss'}

Today's Progress:
- Calories: ${current.calories}/${targets.calories} (${remaining.calories} remaining)
- Protein: ${current.protein}g/${targets.protein}g (${remaining.protein}g remaining)
- Carbs: ${current.carbs}g/${targets.carbs}g
- Fat: ${current.fat}g/${targets.fat}g

Meals eaten today: ${mealNames.length > 0 ? mealNames.join(', ') : 'None yet'}
Time: ${timeOfDay} (roughly ${mealsRemaining} meal${mealsRemaining > 1 ? 's' : ''} left)

Respond with a JSON object with these fields:
- "status": One of "on_track", "needs_attention", "great_job" based on their progress
- "headline": A short 3-5 word status (e.g., "Solid protein start", "Need more protein", "Crushing it today")
- "insights": Array of 2-3 brief insights (max 12 words each), focusing on:
  1. How they're doing so far
  2. What to prioritize for remaining meals
  3. A specific actionable tip if relevant

Keep it encouraging but honest. Be specific about numbers when helpful.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 200,
      temperature: 0.7
    })

    const response = JSON.parse(completion.choices[0].message.content || '{}')

    return NextResponse.json({
      status: response.status || 'on_track',
      headline: response.headline || 'Keep going',
      insights: response.insights || ['Stay consistent with your meals'],
      current,
      remaining,
      targets: {
        calories: targets.calories,
        protein: targets.protein,
        carbs: targets.carbs,
        fat: targets.fat
      },
      mealsLogged: mealLogs.length,
      timeOfDay
    })

  } catch (error) {
    console.error('Daily insights error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate insights',
        status: 'on_track',
        headline: 'Keep going',
        insights: ['Log your meals to get personalized insights']
      },
      { status: 500 }
    )
  }
}
