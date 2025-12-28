import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { prisma } from '@/lib/prisma'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(request: NextRequest) {
  try {
    const { message, userId, currentHour: passedHour, timezone = 'America/Los_Angeles' } = await request.json()

    if (!message || !userId) {
      return NextResponse.json(
        { error: 'Message and userId are required' },
        { status: 400 }
      )
    }

    // Use passed currentHour or calculate from timezone (never calculate from server time)
    const currentHour = passedHour !== undefined
      ? passedHour
      : new Date(new Date().toLocaleString('en-US', { timeZone: timezone })).getHours()

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

    const timeContext = currentHour < 11 ? 'morning' : currentHour < 16 ? 'afternoon' : 'evening'

    const systemPrompt = `You are Rovia, a friendly nutrition coach. You can help users log meals AND answer nutrition questions.

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
- BE ACCURATE with calorie estimates - this is critical for the user's goals
- Use real nutritional data you know about fast food and restaurant items
- A typical fast food burger is 400-600 cal, a grilled cheese sandwich is 300-500 cal
- In-N-Out grilled cheese (no meat, just bun/cheese/veggies) is ~380 cal, animal style adds ~100 cal
- Don't inflate estimates - users rely on accuracy to hit their targets
- Account for servings/quantity mentioned (e.g., "2 tacos" = multiply by 2)
- When uncertain, estimate conservatively based on typical portion sizes

Respond with valid JSON only.`

    const completion = await openai.responses.create({
      model: 'gpt-5.2',
      input: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ]
    })

    const responseText = completion.output_text
    if (!responseText) {
      throw new Error('No response from OpenAI')
    }

    const parsed = JSON.parse(responseText)

    if (parsed.type === 'meal' && parsed.mealData) {
      const servings = parsed.mealData.servings || 1
      const mealName = parsed.mealData.mealName?.toLowerCase() || ''

      // Try to find a matching item in the database first (source of truth)
      let dbMatch = null

      // Check OrderTemplates (restaurant meals)
      const orderTemplates = await prisma.orderTemplate.findMany({
        where: {
          OR: [
            { title: { contains: mealName, mode: 'insensitive' } },
            { keywordsForDeliverySearch: { contains: mealName, mode: 'insensitive' } }
          ]
        },
        take: 5
      })

      // Find best match based on name similarity
      if (orderTemplates.length > 0) {
        // Score matches by how closely they match the meal name
        const scored = orderTemplates.map(t => {
          const titleLower = t.title.toLowerCase()
          const score = mealName.includes(titleLower) || titleLower.includes(mealName) ? 2 :
                       mealName.split(' ').filter((w: string) => titleLower.includes(w)).length
          return { template: t, score }
        }).sort((a, b) => b.score - a.score)

        if (scored[0]?.score > 0) {
          dbMatch = scored[0].template
        }
      }

      // If we found a database match, use its accurate data
      if (dbMatch) {
        return NextResponse.json({
          success: true,
          mealParsed: true,
          parsedMeal: {
            name: dbMatch.title,
            calories: Math.round(dbMatch.calories * servings),
            protein: Math.round(dbMatch.protein * servings),
            carbs: Math.round(dbMatch.carbs * servings),
            fat: Math.round(dbMatch.fat * servings),
            servings
          },
          message: parsed.message,
          source: 'database'
        })
      }

      // Fall back to AI estimate if no database match
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
        message: parsed.message,
        source: 'ai_estimate'
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
