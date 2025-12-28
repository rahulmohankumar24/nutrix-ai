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
    // Calculate percentages for context
    const caloriePercent = Math.round((current.calories / targets.calories) * 100)
    const proteinPercent = Math.round((current.protein / targets.protein) * 100)
    const isOverCalories = current.calories > targets.calories
    const isOverFat = current.fat > targets.fat

    const prompt = `You are a friendly nutrition coach giving a brief daily check-in. Write conversationally, like texting a friend.

USER CONTEXT:
Goal: ${profile.goal === 'recomp' ? 'body recomposition' : profile.goal === 'lean_bulk' ? 'lean muscle gain' : 'fat loss'}
Time: ${timeOfDay} (${mealsRemaining} meal${mealsRemaining > 1 ? 's' : ''} left today)
Meals so far: ${mealNames.length > 0 ? mealNames.join(', ') : 'None yet'}

TODAY'S STATUS:
- Calories: ${caloriePercent}% of target ${isOverCalories ? '(over by ' + (current.calories - targets.calories) + ')' : ''}
- Protein: ${proteinPercent}% of target
- Fat: ${isOverFat ? 'a bit high' : 'on track'}

Respond with JSON:
{
  "status": "on_track",
  "headline": "3-5 words max",
  "insights": ["insight 1", "insight 2"]
}

WRITING RULES:
- NO numbers, percentages, or calorie counts in your response
- Use descriptive words instead: "you're over", "right on track", "a bit high", "plenty of room"
- 2 insights max, each under 15 words
- Sound like a supportive friend, not a calculator
- Focus on actionable next steps in plain language

GOOD examples:
- "You've eaten a bit more than planned, but protein is solid."
- "Go light for dinner - lean protein and veggies would be perfect."
- "You're right on track. Keep doing what you're doing."

BAD examples (don't do this):
- "You're +1230 calories; protein met at 95%"
- "Aim for 0-300 calories, 10-15g protein"
- "Last meal: ≤10g carbs, 0-10g fat"`

    const completion = await openai.responses.create({
      model: 'gpt-5.2',
      input: [{ role: 'user', content: prompt + '\n\nRespond with valid JSON only.' }]
    })

    const response = JSON.parse(completion.output_text || '{}')

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
