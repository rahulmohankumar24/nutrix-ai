import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

interface MacroTargets {
  calories: number
  protein: number
  carbs: number
  fat: number
}

export async function POST(request: NextRequest) {
  try {
    const { userId, message, currentTargets } = await request.json()

    if (!userId || !message || !currentTargets) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Use AI to parse the user's intent
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a macro adjustment assistant. Parse the user's request and return JSON with the adjusted macro targets.

Current targets:
- Calories: ${currentTargets.calories}
- Protein: ${currentTargets.protein}g
- Carbs: ${currentTargets.carbs}g
- Fat: ${currentTargets.fat}g

Return a JSON object with:
- newTargets: { calories, protein, carbs, fat } - the updated values
- message: a brief confirmation message (e.g., "Increased protein to 180g")

Rules:
- If user says "increase X by Y", add Y to current X
- If user says "decrease X by Y", subtract Y from current X
- If user says "set X to Y", set X to Y
- If user says "more X" without a number, increase by ~10-15%
- If user says "less X" without a number, decrease by ~10-15%
- Keep values reasonable (calories: 1200-4000, protein: 50-300g, carbs: 50-500g, fat: 20-200g)
- If you can't understand the request, return { error: true }

Only return valid JSON, no other text.`
        },
        {
          role: 'user',
          content: message
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3
    })

    const result = JSON.parse(completion.choices[0].message.content || '{}')

    if (result.error) {
      return NextResponse.json({
        error: 'Could not understand request'
      }, { status: 400 })
    }

    const newTargets: MacroTargets = {
      calories: Math.round(Math.max(1200, Math.min(4000, result.newTargets.calories))),
      protein: Math.round(Math.max(50, Math.min(300, result.newTargets.protein))),
      carbs: Math.round(Math.max(50, Math.min(500, result.newTargets.carbs))),
      fat: Math.round(Math.max(20, Math.min(200, result.newTargets.fat)))
    }

    // Update today's daily target in database
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    await prisma.dailyTarget.upsert({
      where: {
        userId_date: {
          userId,
          date: today
        }
      },
      update: {
        calories: newTargets.calories,
        protein: newTargets.protein,
        carbs: newTargets.carbs,
        fat: newTargets.fat
      },
      create: {
        userId,
        date: today,
        calories: newTargets.calories,
        protein: newTargets.protein,
        carbs: newTargets.carbs,
        fat: newTargets.fat
      }
    })

    return NextResponse.json({
      newTargets,
      message: result.message || 'Targets updated!'
    })

  } catch (error) {
    console.error('Error adjusting macros:', error)
    return NextResponse.json({ error: 'Failed to adjust macros' }, { status: 500 })
  }
}
