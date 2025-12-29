import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateTargets } from '@/lib/calculations'
import { getUserDateStr, getDayBoundariesUTC, getUserHour } from '@/lib/timezone'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const timezone = searchParams.get('timezone') || 'America/Los_Angeles'
    const currentHourParam = searchParams.get('currentHour')

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    // Use passed currentHour or calculate from timezone
    const currentHour = currentHourParam
      ? parseInt(currentHourParam)
      : getUserHour(timezone)

    // Get user profile
    const profile = await prisma.profile.findUnique({
      where: { userId }
    })

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Get today's date range in user's timezone
    const userDateStr = getUserDateStr(timezone)
    const { startOfDay, endOfDay } = getDayBoundariesUTC(userDateStr, timezone)
    // For DailyTarget date field (stored as date without time)
    const today = new Date(`${userDateStr}T00:00:00.000Z`)

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
        datetime: { gte: startOfDay, lte: endOfDay }
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

    const timeOfDay = currentHour < 11 ? 'morning' : currentHour < 16 ? 'afternoon' : 'evening'

    // Check which meals are actually logged
    const loggedMealTypes = new Set(mealLogs.map(log => log.mealType || ''))
    const hasBreakfast = loggedMealTypes.has('breakfast')
    const hasLunch = loggedMealTypes.has('lunch')
    const hasDinner = loggedMealTypes.has('dinner')

    // Calculate actual meals remaining based on time AND what's been logged
    let mealsRemaining = 0
    if (currentHour < 11) {
      mealsRemaining = (hasBreakfast ? 0 : 1) + (hasLunch ? 0 : 1) + (hasDinner ? 0 : 1)
    } else if (currentHour < 16) {
      mealsRemaining = (hasLunch ? 0 : 1) + (hasDinner ? 0 : 1)
    } else {
      mealsRemaining = hasDinner ? 0 : 1
    }

    // Generate AI insights
    // Calculate percentages for context
    const caloriePercent = Math.round((current.calories / targets.calories) * 100)
    const proteinPercent = Math.round((current.protein / targets.protein) * 100)
    const isOverCalories = current.calories > targets.calories
    const isOverFat = current.fat > targets.fat

    // Build the meal context string
    const mealContextString = mealsRemaining === 0
      ? 'All meals logged for today'
      : `${mealsRemaining} meal${mealsRemaining > 1 ? 's' : ''} left today`

    const prompt = `You are a friendly nutrition coach giving a brief daily check-in. Write conversationally, like texting a friend.

USER CONTEXT:
Goal: ${profile.goal === 'recomp' ? 'body recomposition' : profile.goal === 'lean_bulk' ? 'lean muscle gain' : 'fat loss'}
Time: ${timeOfDay} (${mealContextString})
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
- IMPORTANT: If all meals are logged, do NOT reference specific meal times like "dinner" or "lunch". Instead, say "any more food" or "if you eat anything else"

GOOD examples:
- "You've eaten a bit more than planned, but protein is solid."
- "Go light for dinner - lean protein and veggies would be perfect." (only if dinner NOT logged)
- "You're right on track. Keep doing what you're doing."
- "If you have any more food, keep it light." (when all meals logged)

BAD examples (don't do this):
- "You're +1230 calories; protein met at 95%"
- "Aim for 0-300 calories, 10-15g protein"
- "Last meal: ≤10g carbs, 0-10g fat"
- "Go light for dinner" (when dinner is already logged)`

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
