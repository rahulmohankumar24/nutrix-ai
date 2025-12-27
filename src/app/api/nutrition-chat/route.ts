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

    // Fetch user's current macro progress and profile for context
    let userContext = ''
    try {
      const [profile, macroProgress] = await Promise.all([
        prisma.profile.findUnique({ where: { userId } }),
        fetchMacroProgress(userId)
      ])

      if (profile && macroProgress) {
        const remaining = macroProgress.remaining
        const current = macroProgress.current
        const targets = macroProgress.targets

        userContext = `
USER CONTEXT:
- Goal: ${profile.goal || 'general health'}
- Daily targets: ${targets.calories} cal, ${targets.protein}g protein, ${targets.carbs}g carbs, ${targets.fat}g fat
- Already eaten today: ${current.calories} cal, ${current.protein}g protein, ${current.carbs}g carbs, ${current.fat}g fat
- Remaining today: ${remaining.calories} cal, ${remaining.protein}g protein, ${remaining.carbs}g carbs, ${remaining.fat}g fat
- Progress: ${Math.round((current.calories / targets.calories) * 100)}% of daily calories, ${Math.round((current.protein / targets.protein) * 100)}% of protein
`
      }
    } catch (e) {
      console.log('Could not fetch user context:', e)
    }

    const currentHour = new Date().getHours()
    const timeContext = currentHour < 11 ? 'morning' : currentHour < 16 ? 'afternoon' : 'evening'

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are Rovia, a friendly nutrition coach. You can help users log meals AND answer nutrition questions.

Current time: ${timeContext}
${userContext}

RESPONSE FORMAT (always JSON):
{
  "type": "meal" | "advice" | "chat",
  "message": "your response to the user",

  // Only if type is "meal":
  "mealData": {
    "mealName": "name of meal",
    "estimatedCalories": number,
    "estimatedProtein": number,
    "estimatedCarbs": number,
    "estimatedFat": number,
    "servings": number
  }
}

BEHAVIOR:
1. If user mentions eating something → type: "meal", parse the food and estimate macros
2. If user asks a nutrition question → type: "advice", give personalized advice based on their goals/progress
3. If just chatting → type: "chat", be friendly and helpful

For ADVICE questions, consider:
- Their remaining macros for the day
- Their fitness goal (cut, bulk, recomp, etc.)
- Give specific, actionable suggestions
- Keep responses concise (2-3 sentences max)

For MEAL logging:
- Estimate realistic macro values
- Account for servings mentioned

Examples:
User: "I had 2 eggs and toast"
→ {"type": "meal", "message": "Got it!", "mealData": {"mealName": "Eggs and Toast", "estimatedCalories": 350, "estimatedProtein": 18, "estimatedCarbs": 28, "estimatedFat": 18, "servings": 1}}

User: "What should I eat for dinner?"
→ {"type": "advice", "message": "You have 800 cal and 60g protein left. A grilled chicken breast with veggies would be perfect - about 400 cal and 45g protein."}

User: "Am I on track today?"
→ {"type": "advice", "message": "You're at 65% of calories and 70% of protein. Looking good! Focus on protein-rich foods for your remaining meals."}`
        },
        {
          role: 'user',
          content: message
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7
    })

    const responseText = completion.choices[0]?.message?.content
    if (!responseText) {
      throw new Error('No response from OpenAI')
    }

    const parsed = JSON.parse(responseText)

    if (parsed.type === 'meal' && parsed.mealData) {
      const servings = parsed.mealData.servings || 1
      return NextResponse.json({
        success: true,
        mealParsed: true,
        parsedMeal: {
          name: parsed.mealData.mealName,
          calories: Math.round(parsed.mealData.estimatedCalories * servings),
          protein: Math.round(parsed.mealData.estimatedProtein * servings),
          carbs: Math.round(parsed.mealData.estimatedCarbs * servings),
          fat: Math.round(parsed.mealData.estimatedFat * servings),
          servings
        },
        message: parsed.message
      })
    }

    // Advice or chat response
    return NextResponse.json({
      success: true,
      mealParsed: false,
      message: parsed.message
    })

  } catch (error) {
    console.error('Nutrition chat error:', error)
    return NextResponse.json(
      {
        error: 'Failed to process message',
        message: "Sorry, I had trouble with that. Could you try again?"
      },
      { status: 500 }
    )
  }
}

async function fetchMacroProgress(userId: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const [profile, mealLogs, dailyTarget] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.mealLog.findMany({
      where: {
        userId,
        datetime: { gte: today, lt: tomorrow }
      },
      include: {
        orderTemplate: true,
        foodCatalogItem: true
      }
    }),
    prisma.dailyTarget.findFirst({
      where: {
        userId,
        date: { gte: today, lt: tomorrow }
      }
    })
  ])

  // Calculate current totals
  let current = { calories: 0, protein: 0, carbs: 0, fat: 0 }
  mealLogs.forEach(log => {
    const item = log.orderTemplate || log.foodCatalogItem
    if (!item) return
    const s = log.servings || 1
    current.calories += Math.round(item.calories * s)
    current.protein += Math.round(item.protein * s)
    current.carbs += Math.round(item.carbs * s)
    current.fat += Math.round(item.fat * s)
  })

  // Get targets
  let targets = { calories: 2000, protein: 150, carbs: 200, fat: 70 }
  if (dailyTarget) {
    targets = {
      calories: dailyTarget.calories,
      protein: dailyTarget.protein,
      carbs: dailyTarget.carbs,
      fat: dailyTarget.fat
    }
  } else if (profile) {
    // Calculate from profile
    const weightKg = (profile.weightLb || 150) / 2.205
    const heightCm = (profile.heightIn || 70) * 2.54
    const age = profile.age || 25
    const bmr = profile.sex === 'male'
      ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
      : 10 * weightKg + 6.25 * heightCm - 5 * age - 161
    const multiplier = profile.stepsLevel === 'high' ? 1.55 : profile.stepsLevel === 'med' ? 1.375 : 1.2
    let tdee = Math.round(bmr * multiplier + (profile.liftingDays || 0) * 50)
    if (profile.goal === 'cut') tdee -= 500
    else if (profile.goal === 'lean_bulk') tdee += 300

    targets = {
      calories: tdee,
      protein: Math.round((profile.weightLb || 150) * 0.8),
      carbs: Math.round((tdee * 0.4) / 4),
      fat: Math.round((tdee * 0.25) / 9)
    }
  }

  return {
    current,
    targets,
    remaining: {
      calories: Math.max(0, targets.calories - current.calories),
      protein: Math.max(0, targets.protein - current.protein),
      carbs: Math.max(0, targets.carbs - current.carbs),
      fat: Math.max(0, targets.fat - current.fat)
    }
  }
}
