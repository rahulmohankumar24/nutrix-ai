import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(request: NextRequest) {
  try {
    const { userId, request: userRequest } = await request.json()

    if (!userId || !userRequest) {
      return NextResponse.json({ error: 'User ID and request required' }, { status: 400 })
    }

    // Get user profile for personalized suggestions
    const profile = await prisma.profile.findUnique({
      where: { userId }
    })

    // Get user's daily targets
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const dailyTarget = await prisma.dailyTarget.findFirst({
      where: {
        userId,
        date: {
          gte: today,
          lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
        }
      }
    })

    const targets = dailyTarget || {
      calories: 2000,
      protein: 150,
      carbs: 200,
      fat: 65
    }

    const goalContext = profile ? `
User's fitness goal: ${profile.goal}
Daily targets: ${targets.calories} calories, ${targets.protein}g protein, ${targets.carbs}g carbs, ${targets.fat}g fat
Activity: ${profile.liftingDays} lifting days/week, ${profile.stepsLevel} step level
` : ''

    const systemPrompt = `You are a helpful nutrition coach that suggests meal ideas based on user requests.
${goalContext}
Generate 2-3 practical meal ideas that match the user's request. Focus on meals that:
- Are realistic and easy to prepare
- Have accurate macro estimates
- Match the user's request for calories, protein, meal type, etc.

Return JSON in this exact format:
{
  "meals": [
    {
      "name": "Meal Name",
      "description": "Brief description",
      "prepTime": "15 min",
      "ingredients": ["ingredient 1", "ingredient 2"],
      "instructions": "Brief cooking instructions",
      "calories": 450,
      "protein": 35,
      "carbs": 40,
      "fat": 15,
      "mealType": "lunch",
      "difficulty": "easy"
    }
  ],
  "message": "Brief helpful message about the suggestions"
}`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Give me meal ideas for: ${userRequest}` }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      return NextResponse.json({ meals: [], message: 'Could not generate suggestions' })
    }

    const result = JSON.parse(content)

    return NextResponse.json({
      meals: result.meals || [],
      message: result.message || 'Here are some recipe ideas!'
    })
  } catch (error) {
    console.error('Failed to generate recipe ideas:', error)
    return NextResponse.json({ error: 'Failed to generate recipe ideas' }, { status: 500 })
  }
}
