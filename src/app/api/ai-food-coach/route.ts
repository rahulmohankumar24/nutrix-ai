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

    const { source, userTargets, timeOfDay = 'snack', userProfile } = await request.json()

    if (!userTargets) {
      return NextResponse.json({ error: 'User targets required' }, { status: 400 })
    }

    // Get available food items for this source
    const whereClause: any = {}
    if (source) {
      whereClause.source = source
    }

    const availableFoods = await prisma.foodCatalogItem.findMany({
      where: whereClause,
      orderBy: {
        name: 'asc'
      }
    })

    if (availableFoods.length === 0) {
      return NextResponse.json({ error: 'No food items found' }, { status: 404 })
    }

    // Score and filter foods (same logic as food-catalog API)
    const scoredFoods = availableFoods.map(food => {
      const { remaining } = userTargets
      let score = 0

      const proteinFit = Math.min(1, food.protein / Math.max(remaining.protein * 0.7, 10))
      score += proteinFit * 0.4 * 100

      const calorieFit = remaining.calories > 0 ?
        Math.min(1, Math.max(0, 1 - Math.abs(food.calories - remaining.calories * 0.3) / (remaining.calories * 0.5))) : 0.5
      score += calorieFit * 0.3 * 100

      let carbWeight = 0.2
      if (timeOfDay === 'breakfast' || timeOfDay === 'lunch') carbWeight = 0.25
      if (timeOfDay === 'dinner') carbWeight = 0.15

      const carbFit = remaining.carbs > 0 ? Math.min(1, food.carbs / Math.max(remaining.carbs * 0.4, 15)) : 0.5
      score += carbFit * carbWeight * 100

      const fatFit = remaining.fat > 0 ? Math.min(1, food.fat / Math.max(remaining.fat * 0.5, 10)) : 0.5
      score += fatFit * 0.1 * 100

      if (timeOfDay === 'snack' && food.calories >= 100 && food.calories <= 300) score += 15
      if (timeOfDay === 'snack' && food.protein >= 10) score += 10
      if (timeOfDay === 'snack' && food.calories > 400) score -= 20

      return {
        ...food,
        nutritionScore: Math.max(0, Math.min(100, score))
      }
    })

    // Get top 15 candidates
    const topFoods = scoredFoods
      .sort((a, b) => b.nutritionScore - a.nutritionScore)
      .slice(0, 15)

    // Prepare food data for AI
    const foodsList = topFoods.map(food => ({
      id: food.id,
      name: food.name,
      source: food.source,
      calories: food.calories,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
      tags: JSON.parse(food.tags || '[]')
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

    const timeContext: Record<string, string> = {
      'breakfast': 'Morning fuel - focus on energy and protein',
      'lunch': 'Midday energy - sustained nutrition',
      'dinner': 'Evening meal - focus on recovery and meeting daily targets',
      'snack': 'Smart snacking - fill macro gaps without overeating'
    }

    const sourceContext: Record<string, string> = {
      'home': 'Home foods - what you can make or have at home',
      'grocery': 'Grocery items - foods you can buy at the store',
      'restaurant': 'Restaurant foods - dining out options'
    }

    const prompt = `You are Rovia, an expert nutrition coach analyzing ${source || 'food'} options for a user.

USER'S SITUATION:
- Time of meal: ${timeOfDay} (${timeContext[timeOfDay] || 'nutrition timing'})
- Current macro progress today: ${JSON.stringify(currentProgress)}
- Remaining daily targets: ${remainingMacros.calories} calories, ${remainingMacros.protein}g protein, ${remainingMacros.carbs}g carbs, ${remainingMacros.fat}g fat
- User goal: ${userProfile?.goal || 'balanced nutrition'}
- Activity level: ${userProfile?.liftingDays || 3} lifting days/week, ${userProfile?.stepsLevel || 'medium'} daily steps

TOP RECOMMENDED ${source?.toUpperCase() || 'FOOD'} OPTIONS:
${foodsList.map((food, i) => `${i + 1}. ${food.name} (${food.source}) - ${food.calories} cal, ${food.protein}g protein, ${food.carbs}g carbs, ${food.fat}g fat`).join('\n')}

NOTE: These ${foodsList.length} foods have been pre-filtered based on your nutrition targets and current time. They represent the best nutritional matches for your needs.

TASK: Analyze these TOP foods and recommend 3-5 BEST options with detailed reasoning.

Return a JSON object with this structure:
{
  "approvedFoods": [
    {
      "foodId": "food_id_from_list",
      "name": "Food Name",
      "source": "home",
      "calories": 150,
      "protein": 12,
      "carbs": 15,
      "fat": 8,
      "macroFitScore": 85,
      "reasoning": "Detailed explanation of why this food is recommended",
      "preparationTips": "How to prepare or optimize this food",
      "macroImpact": "Will provide 25% of remaining protein needs",
      "timeContextReason": "Perfect for snacking - provides sustained energy",
      "goalAlignment": "Supports muscle building with quality protein"
    }
  ],
  "rejectedCount": 3,
  "overallAdvice": "General guidance about food choices and macro balance",
  "tips": "Specific tips for ${source || 'food'} selection and timing"
}

IMPORTANT: Only include foods in "approvedFoods" that you genuinely recommend for their current goals and nutrition targets. Reject foods that don't fit well, even if they were pre-filtered.`

    const completion = await openai.responses.create({
      model: "gpt-5.2",
      input: [{ role: "user", content: prompt }]
    })

    const aiResponse = completion.output_text
    if (!aiResponse) {
      return NextResponse.json({ error: 'No response from AI coach' }, { status: 500 })
    }

    try {
      const parsedResponse = JSON.parse(aiResponse)

      // Enhance approved foods with original data
      const enhancedApprovedFoods = parsedResponse.approvedFoods?.map((approvedFood: any) => {
        const originalFood = foodsList.find(f => f.id === approvedFood.foodId)
        return {
          ...originalFood,
          ...approvedFood,
          aiApproved: true
        }
      }) || []

      return NextResponse.json({
        success: true,
        approvedFoods: enhancedApprovedFoods,
        coaching: parsedResponse,
        source: source || 'all',
        analysedFoodsCount: foodsList.length,
        approvedCount: enhancedApprovedFoods.length
      })
    } catch (parseError) {
      console.error('Failed to parse AI food coaching response:', parseError)
      return NextResponse.json({
        success: false,
        error: 'Invalid AI response format',
        rawResponse: aiResponse
      }, { status: 500 })
    }

  } catch (error) {
    console.error('AI food coach error:', error)
    return NextResponse.json({ error: 'Failed to generate food coaching' }, { status: 500 })
  }
}