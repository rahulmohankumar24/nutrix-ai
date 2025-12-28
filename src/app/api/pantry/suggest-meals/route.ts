import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'
import { calculateTargets } from '@/lib/calculations'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

// Helper function to get user's remaining macros directly from DB
async function getRemainingMacros(userId: string) {
  const timezone = 'America/Los_Angeles'
  const now = new Date()
  const userDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }))
  const today = new Date(userDate.getFullYear(), userDate.getMonth(), userDate.getDate())

  // Get or create daily target
  let dailyTarget = await prisma.dailyTarget.findFirst({
    where: { userId, date: today }
  })

  if (!dailyTarget) {
    const profile = await prisma.profile.findUnique({ where: { userId } })
    if (!profile) return null

    const calculated = calculateTargets(
      profile.heightIn,
      profile.weightLb,
      profile.age || 27,
      profile.sex as 'male' | 'female' | 'other',
      profile.goal as 'recomp' | 'lean_bulk' | 'cut',
      profile.liftingDays,
      profile.stepsLevel as 'low' | 'med' | 'high'
    )

    dailyTarget = await prisma.dailyTarget.create({
      data: {
        userId,
        date: today,
        calories: calculated.calories,
        protein: calculated.protein,
        carbs: calculated.carbs,
        fat: calculated.fat
      }
    })
  }

  // Get today's meal logs
  const mealLogs = await prisma.mealLog.findMany({
    where: {
      userId,
      datetime: {
        gte: today,
        lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
      }
    },
    include: {
      foodCatalogItem: true,
      orderTemplate: true
    }
  })

  // Calculate current intake
  let currentCalories = 0, currentProtein = 0, currentCarbs = 0, currentFat = 0
  mealLogs.forEach((log: any) => {
    const item = log.foodCatalogItem || log.orderTemplate
    if (item) {
      currentCalories += item.calories * log.servings
      currentProtein += item.protein * log.servings
      currentCarbs += item.carbs * log.servings
      currentFat += item.fat * log.servings
    }
  })

  return {
    calories: Math.max(0, dailyTarget.calories - Math.round(currentCalories)),
    protein: Math.max(0, dailyTarget.protein - Math.round(currentProtein)),
    carbs: Math.max(0, dailyTarget.carbs - Math.round(currentCarbs)),
    fat: Math.max(0, dailyTarget.fat - Math.round(currentFat))
  }
}

// POST: Get meal suggestions based on pantry items
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, mealType, maxTime, targetMacros } = body

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Get user's pantry items that are in stock
    const pantryItems = await prisma.pantryItem.findMany({
      where: {
        userId,
        inStock: true
      },
      orderBy: { category: 'asc' }
    })

    if (pantryItems.length === 0) {
      return NextResponse.json({
        suggestions: [],
        message: 'Add some items to your pantry first!'
      })
    }

    // Get user's remaining macros for the day (direct DB query, no HTTP fetch)
    let userMacros = targetMacros
    if (!userMacros) {
      userMacros = await getRemainingMacros(userId)
    }

    // Build prompt for AI
    const pantryList = pantryItems.map(item => {
      let str = `- ${item.name} (${item.category})`
      if (item.quantity) str += ` [${item.quantity}]`
      if (item.protein) str += ` - ${item.protein}g protein per serving`
      return str
    }).join('\n')

    const timeConstraint = maxTime ? `Keep prep time under ${maxTime} minutes.` : ''
    const mealTypeHint = mealType ? `This is for ${mealType}.` : ''

    const macroGuidance = userMacros
      ? `User needs: ${userMacros.calories} cal, ${userMacros.protein}g protein remaining today. Prioritize hitting protein.`
      : 'Focus on balanced, protein-rich meals.'

    const systemPrompt = `You are a smart home cooking assistant.

UNDERSTAND THE DIFFERENCE:
- READY-TO-EAT items (snacks, yogurt, fruit, trail mix, protein bars, cheese, deli meat, etc.) = Just suggest eating them as-is. Don't make "recipes" from snacks.
- RAW INGREDIENTS (chicken breast, rice, pasta, eggs, vegetables, ground beef, etc.) = These can be combined into actual cooked meals.

RULES:
1. If user only has ready-to-eat snacks, put them in "readyToEat" - don't invent fake recipes
2. Only create "meals" from actual cookable ingredients that need preparation
3. ONLY use ingredients from the user's list - assume basic staples (salt, pepper, oil)
4. Be realistic - if they can't make a real meal, say so
5. Don't pad the response with unnecessary suggestions

Return valid JSON only.`

    const userContent = `Here's what I have:

${pantryList}

${macroGuidance}

Be smart: ready-to-eat items (snacks, yogurt, etc.) should just be suggested as-is in "readyToEat". Only create actual "meals" if I have raw ingredients that need cooking.

Return JSON with this EXACT structure:
{
  "meals": [
    {
      "name": "Meal name",
      "description": "Brief description",
      "prepTime": "10 min",
      "calories": 400,
      "protein": 30,
      "carbs": 40,
      "fat": 15,
      "ingredients": ["ingredient 1", "ingredient 2"]
    }
  ],
  "readyToEat": [
    {
      "name": "Snack name",
      "portion": "1 cup or 1 bar or 2 oz etc",
      "calories": 150,
      "protein": 10
    }
  ],
  "message": "Brief friendly message about what you can make"
}`

    const response = await openai.responses.create({
      model: 'gpt-5.2',
      input: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
      ]
    })

    const content = response.output_text
    if (!content) {
      return NextResponse.json({ error: 'Failed to generate suggestions' }, { status: 500 })
    }

    let parsed
    try {
      parsed = JSON.parse(content)
    } catch {
      return NextResponse.json({ error: 'Failed to parse suggestions' }, { status: 500 })
    }

    // Normalize meals to ensure required fields exist
    const meals = (parsed.meals || [])
      .filter((meal: any) => meal && typeof meal.name === 'string' && meal.name.trim() && meal.calories > 0)
      .map((meal: any) => ({
        name: meal.name.trim(),
        description: meal.description || '',
        prepTime: meal.prepTime || '15 min',
        calories: Number(meal.calories) || 0,
        protein: Number(meal.protein) || 0,
        carbs: Number(meal.carbs) || 0,
        fat: Number(meal.fat) || 0,
        ingredients: meal.ingredients || []
      }))

    // Normalize readyToEat to ensure required fields exist
    const readyToEat = (parsed.readyToEat || [])
      .filter((item: any) => item && typeof item.name === 'string' && item.name.trim() && item.calories > 0)
      .map((item: any) => ({
        name: item.name.trim(),
        portion: item.portion || item.serving || '1 serving',
        calories: Number(item.calories) || 0,
        protein: Number(item.protein) || 0,
        note: item.note || ''
      }))

    return NextResponse.json({
      success: true,
      meals,
      readyToEat,
      message: parsed.message || null,
      pantryItemCount: pantryItems.length
    })
  } catch (error) {
    console.error('Failed to suggest meals:', error)
    return NextResponse.json({ error: 'Failed to suggest meals' }, { status: 500 })
  }
}
