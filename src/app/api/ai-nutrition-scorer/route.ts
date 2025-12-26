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

    const { meals, userTargets, userProfile, timeOfDay, preferences } = await request.json()

    if (!meals || !userTargets) {
      return NextResponse.json({ error: 'Meals and user targets required' }, { status: 400 })
    }

    // Prepare compact meal data for efficient processing
    const mealsList = meals.map((meal: any, index: number) =>
      `${index + 1}. ${meal.title || meal.name} (${meal.calories}cal, ${meal.protein}g protein, ${meal.carbs}g carbs, ${meal.fat}g fat)${meal.description ? ` - ${meal.description}` : ''}`
    ).join('\n')

    const remainingMacros = `${userTargets.remaining.calories}cal, ${userTargets.remaining.protein}g protein, ${userTargets.remaining.carbs}g carbs, ${userTargets.remaining.fat}g fat remaining`

    // Streamlined prompt for better speed and accuracy
    const prompt = `Score nutrition fit for ${timeOfDay} meal selection. User needs: ${remainingMacros}

MEALS:
${mealsList}

USER CONTEXT:
- Goal: ${userProfile?.goal || 'balance'} | Lifting: ${userProfile?.liftingDays || 3}x/week | Steps: ${userProfile?.stepsLevel || 'med'}
- Preferences: ${preferences ? Object.entries(preferences).map(([k,v]) => `${k}:${v}`).join(', ') : 'none specified'}

Score each meal 0-100 based on:
1. Macro fit to remaining targets (primary weight: 60%)
2. Timing appropriateness for ${timeOfDay} (weight: 25%)
3. Goal alignment & satiety (weight: 15%)

Return ONLY JSON:
{
  "scores": [
    {"mealIndex": 0, "score": 85, "reasoning": "Perfect protein fit, good calorie match", "macroFit": "High", "timingFit": "Excellent", "goalAlignment": "Strong"},
    {"mealIndex": 1, "score": 72, "reasoning": "Good overall but high calories", "macroFit": "Medium", "timingFit": "Good", "goalAlignment": "Medium"}
  ],
  "topRecommendation": 0,
  "insights": "Focus on higher protein options to meet remaining targets"
}`

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 1500,
    })

    const aiResponse = completion.choices[0]?.message?.content
    if (!aiResponse) {
      return NextResponse.json({ error: 'No response from AI scorer' }, { status: 500 })
    }

    try {
      const parsedResponse = JSON.parse(aiResponse)

      // Enhance meals with AI scores
      const scoredMeals = meals.map((meal: any, index: number) => {
        const aiScore = parsedResponse.scores?.find((s: any) => s.mealIndex === index) || {}
        return {
          ...meal,
          aiNutritionScore: aiScore.score || 0,
          aiReasoning: aiScore.reasoning,
          macroFit: aiScore.macroFit,
          timingFit: aiScore.timingFit,
          goalAlignment: aiScore.goalAlignment,
          aiEnhanced: true
        }
      })

      return NextResponse.json({
        success: true,
        scoredMeals,
        aiInsights: parsedResponse.insights,
        topRecommendation: parsedResponse.topRecommendation,
        processingTime: Date.now()
      })
    } catch (parseError) {
      console.error('Failed to parse AI scoring response:', parseError)
      return NextResponse.json({
        success: false,
        error: 'Invalid AI response format',
        rawResponse: aiResponse
      }, { status: 500 })
    }

  } catch (error) {
    console.error('AI nutrition scoring error:', error)
    return NextResponse.json({ error: 'Failed to score meals with AI' }, { status: 500 })
  }
}