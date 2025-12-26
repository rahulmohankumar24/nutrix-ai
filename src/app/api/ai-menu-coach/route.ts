import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 })
    }

    const { restaurantBrand, userTargets, timeOfDay = 'lunch', userProfile } = await request.json()

    if (!restaurantBrand || !userTargets) {
      return NextResponse.json({ error: 'Restaurant and user targets required' }, { status: 400 })
    }

    // Get available meals for this restaurant
    const availableMeals = await prisma.orderTemplate.findMany({
      where: {
        restaurantBrand: restaurantBrand.toLowerCase()
      },
      orderBy: {
        title: 'asc'
      }
    })

    if (availableMeals.length === 0) {
      return NextResponse.json({ error: 'No meals found for this restaurant' }, { status: 404 })
    }

    // Prepare meal data for AI
    const mealsList = availableMeals.map(meal => ({
      id: meal.id,
      title: meal.title,
      description: meal.description,
      calories: meal.calories,
      protein: meal.protein,
      carbs: meal.carbs,
      fat: meal.fat,
      tags: JSON.parse(meal.tags || '[]')
    }))

    const remainingMacros = {
      calories: userTargets.remaining.calories,
      protein: userTargets.remaining.protein,
      carbs: userTargets.remaining.carbs,
      fat: userTargets.remaining.fat
    }

    const currentProgress = {
      calories: `${userTargets.current.calories}/${userTargets.targets.calories}`,
      protein: `${userTargets.current.protein}g/${userTargets.targets.protein}g`,
      carbs: `${userTargets.current.carbs}g/${userTargets.targets.carbs}g`,
      fat: `${userTargets.current.fat}g/${userTargets.targets.fat}g`
    }

    // Time-based context
    const timeContext: Record<string, string> = {
      'breakfast': 'This is breakfast time - focus on energy for the day ahead',
      'lunch': 'This is lunch time - need sustained energy for afternoon',
      'dinner': 'This is dinner time - focus on recovery and meeting daily targets',
      'snack': 'This is snack time - small portions to fill macro gaps'
    }

    const prompt = `You are Mootra AI, an expert nutrition coach analyzing ${restaurantBrand} menu options for a user.

USER'S SITUATION:
- Time of meal: ${timeOfDay} (${timeContext[timeOfDay] || 'mid-day meal'})
- Current macro progress today: ${JSON.stringify(currentProgress)}
- Remaining daily targets: ${remainingMacros.calories} calories, ${remainingMacros.protein}g protein, ${remainingMacros.carbs}g carbs, ${remainingMacros.fat}g fat
- User goal: ${userProfile?.goal || 'balance nutrition'}
- Activity level: ${userProfile?.liftingDays || 3} lifting days/week, ${userProfile?.stepsLevel || 'medium'} daily steps

AVAILABLE MEALS AT ${restaurantBrand.toUpperCase()}:
${mealsList.map((meal, i) => `${i + 1}. ${meal.title} - ${meal.calories} cal, ${meal.protein}g protein, ${meal.carbs}g carbs, ${meal.fat}g fat
   Description: ${meal.description}`).join('\n')}

TASK: Analyze these meals and provide 3 SMART recommendations with detailed reasoning.

For each recommendation, consider:
1. How well it fits their remaining macro targets
2. Possible customizations (${restaurantBrand} allows adding/removing ingredients)
3. Why this meal makes sense for ${timeOfDay}
4. How it supports their fitness goal
5. Potential modifications to better meet targets

Return a JSON object with this structure:
{
  "recommendations": [
    {
      "mealId": "meal_id_from_list",
      "title": "Meal Name",
      "macroFitScore": 85,
      "reasoning": "Detailed explanation of why this meal is recommended",
      "customizations": [
        {
          "suggestion": "Add guacamole (+230 cal, +22g fat)",
          "reason": "You need more healthy fats to reach your target"
        }
      ],
      "macroImpact": "Will provide 45% of remaining protein needs, 30% of calories",
      "timeContextReason": "Perfect for lunch - provides sustained energy",
      "goalAlignment": "Supports muscle building with high protein content"
    }
  ],
  "overallAdvice": "General guidance about meal timing and macro balance",
  "restaurantTips": "Specific tips for ordering at this restaurant"
}

Focus on practical, actionable advice that helps the user make the best choice for their goals.`

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 2000,
    })

    const aiResponse = completion.choices[0]?.message?.content
    if (!aiResponse) {
      return NextResponse.json({ error: 'No response from AI coach' }, { status: 500 })
    }

    try {
      const parsedResponse = JSON.parse(aiResponse)
      return NextResponse.json({
        success: true,
        coaching: parsedResponse,
        restaurantBrand,
        analysedMealsCount: mealsList.length
      })
    } catch (parseError) {
      console.error('Failed to parse AI coaching response:', parseError)
      return NextResponse.json({
        success: false,
        error: 'Invalid AI response format',
        rawResponse: aiResponse
      }, { status: 500 })
    }

  } catch (error) {
    console.error('AI menu coach error:', error)
    return NextResponse.json({ error: 'Failed to generate menu coaching' }, { status: 500 })
  }
}