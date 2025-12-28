import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

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

    // Get user's remaining macros for the day
    let userMacros = targetMacros
    if (!userMacros) {
      const macroResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/macro-progress?userId=${userId}`)
      if (macroResponse.ok) {
        const macroData = await macroResponse.json()
        userMacros = macroData.remaining
      }
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

Return JSON with structure: {"meals": [...], "readyToEat": [...], "message": "..."}`

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

    return NextResponse.json({
      success: true,
      meals: parsed.meals || [],
      readyToEat: parsed.readyToEat || [],
      message: parsed.message || null,
      pantryItemCount: pantryItems.length
    })
  } catch (error) {
    console.error('Failed to suggest meals:', error)
    return NextResponse.json({ error: 'Failed to suggest meals' }, { status: 500 })
  }
}
