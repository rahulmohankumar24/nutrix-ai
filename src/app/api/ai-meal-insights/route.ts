import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 })
    }

    const { meals, userTargets, restaurantName } = await request.json()

    if (!meals || !userTargets || !restaurantName) {
      return NextResponse.json({ error: 'Missing required data' }, { status: 400 })
    }

    // Create AI insights for each meal
    const enhancedMeals = await Promise.all(
      meals.map(async (meal: any) => {
        try {
          const prompt = `You are Mootra AI, a nutrition expert. Analyze this meal from ${restaurantName} for someone with these remaining daily targets: ${userTargets.calories} calories, ${userTargets.protein}g protein, ${userTargets.carbs}g carbs, ${userTargets.fat}g fat.

Meal: ${meal.title}
Description: ${meal.description}
Nutrition: ${meal.calories} calories, ${meal.protein}g protein, ${meal.carbs}g carbs, ${meal.fat}g fat

Provide:
1. A compelling 1-sentence description highlighting what makes this meal special or appealing
2. A personalized nutrition insight (1-2 sentences) about how this fits their goals

Respond in JSON format:
{
  "aiDescription": "compelling description",
  "personalizedNote": "personalized insight"
}

Keep it concise, helpful, and encouraging.`

          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            max_tokens: 200,
          })

          const aiResponse = completion.choices[0]?.message?.content
          if (aiResponse) {
            const parsed = JSON.parse(aiResponse)
            return {
              ...meal,
              aiDescription: parsed.aiDescription,
              personalizedNote: parsed.personalizedNote
            }
          }
        } catch (aiError) {
          console.error('Failed to generate AI insight for meal:', meal.title, aiError)
        }

        return meal
      })
    )

    return NextResponse.json({ enhancedMeals })
  } catch (error) {
    console.error('Failed to generate AI insights:', error)
    return NextResponse.json({ error: 'Failed to generate insights' }, { status: 500 })
  }
}