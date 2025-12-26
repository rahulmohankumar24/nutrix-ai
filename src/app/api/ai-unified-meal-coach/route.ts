import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Efficient scoring for pre-filtering
function quickScore(meal: any, targets: any, timeOfDay: string): number {
  const { remaining } = targets
  let score = 0

  // Protein fit (most important)
  const proteinFit = Math.min(1, meal.protein / Math.max(remaining.protein * 0.7, 10))
  score += proteinFit * 50

  // Calorie fit
  const calorieFit = remaining.calories > 0 ?
    Math.max(0, 1 - Math.abs(meal.calories - remaining.calories * 0.4) / (remaining.calories * 0.6)) : 0.5
  score += calorieFit * 30

  // Time bonus
  if (timeOfDay === 'breakfast' && meal.protein >= 20) score += 10
  if (timeOfDay === 'lunch' && meal.calories >= 400 && meal.calories <= 700) score += 10
  if (timeOfDay === 'dinner' && meal.protein >= 25) score += 10

  return Math.max(0, Math.min(100, score))
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 })
    }

    const { restaurantBrand, userTargets, timeOfDay = 'lunch', userProfile, useAI = true } = await request.json()

    if (!restaurantBrand || !userTargets) {
      return NextResponse.json({ error: 'Restaurant and user targets required' }, { status: 400 })
    }

    // Get available meals for this restaurant brand
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

    // Quick algorithmic pre-filtering to reduce AI workload
    const scoredMeals = availableMeals.map(meal => ({
      ...meal,
      tags: meal.tags ? JSON.parse(meal.tags) : [],
      quickScore: quickScore(meal, userTargets, timeOfDay)
    })).sort((a, b) => b.quickScore - a.quickScore).slice(0, 8) // Top 8 candidates

    if (!useAI) {
      return NextResponse.json({
        success: true,
        meals: scoredMeals.slice(0, 5), // Top 5 without AI analysis
        coaching: { message: "Pre-filtered meals based on nutrition targets" },
        algorithmicFiltering: true
      })
    }

    // AI analysis of top candidates
    const remainingMacros = `${userTargets.remaining.calories}cal, ${userTargets.remaining.protein}g protein, ${userTargets.remaining.carbs}g carbs, ${userTargets.remaining.fat}g fat`

    const mealsList = scoredMeals.map((meal, i) =>
      `${i + 1}. ${meal.title} (${meal.calories}cal, ${meal.protein}p, ${meal.carbs}cb, ${meal.fat}f)`
    ).join('\n')

    const prompt = `${restaurantBrand} ${timeOfDay} meal analysis. User needs: ${remainingMacros}. Goal: ${userProfile?.goal || 'balance'}.

CRITICAL COACHING INSTRUCTIONS:
- If meals are too low in calories/protein, AGGRESSIVELY suggest add-ons and modifications
- Cost is NOT a concern - prioritize hitting nutrition goals
- For ${restaurantBrand}: suggest "double protein", "extra chicken", "add guacamole", "add cheese", "extra portions"
- Don't just approve low-calorie meals - enhance them with high-calorie, high-protein additions

PRE-FILTERED OPTIONS:
${mealsList}

Analyze & return JSON with ENHANCED meal recommendations:
{
  "approvedMeals": [
    {"mealIndex": 0, "score": 85, "reasoning": "Base meal good, enhanced with double protein", "customizations": ["ADD DOUBLE PROTEIN +360cal +70g protein", "ADD guacamole +230cal", "ADD cheese +100cal"], "macroImpact": "Now hits 80% of protein target with modifications"}
  ],
  "overallAdvice": "Don't hesitate to add extra protein and high-calorie items to hit your targets",
  "restaurantTips": "Ask for double protein, extra portions, and calorie-dense add-ons like guac, cheese, nuts. Cost shouldn't limit your nutrition goals."
}`

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 1000, // Reduced for faster response
    })

    const aiResponse = completion.choices[0]?.message?.content
    if (!aiResponse) {
      return NextResponse.json({ error: 'No response from AI coach' }, { status: 500 })
    }

    try {
      // Clean the AI response - remove markdown code blocks if present
      const cleanedResponse = aiResponse
        .replace(/```json\s*/g, '')
        .replace(/```\s*$/g, '')
        .trim()

      const parsedResponse = JSON.parse(cleanedResponse)

      // Enhance approved meals with AI insights
      const approvedMeals = parsedResponse.approvedMeals?.map((approved: any) => {
        const originalMeal = scoredMeals[approved.mealIndex]
        return {
          ...originalMeal,
          aiScore: approved.score,
          aiReasoning: approved.reasoning,
          customizations: approved.customizations || [],
          macroImpact: approved.macroImpact,
          aiApproved: true
        }
      }) || []

      return NextResponse.json({
        success: true,
        meals: approvedMeals,
        coaching: parsedResponse,
        restaurantBrand,
        analysedCount: scoredMeals.length,
        approvedCount: approvedMeals.length,
        aiEnhanced: true
      })
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError)

      // Fallback to algorithmic results
      return NextResponse.json({
        success: true,
        meals: scoredMeals.slice(0, 5),
        coaching: {
          message: "AI analysis failed, showing algorithmically filtered results",
          overallAdvice: "Choose meals that match your remaining protein and calorie targets"
        },
        restaurantBrand,
        algorithmicFallback: true
      })
    }

  } catch (error) {
    console.error('Unified meal coach error:', error)
    return NextResponse.json({ error: 'Failed to analyze meals' }, { status: 500 })
  }
}