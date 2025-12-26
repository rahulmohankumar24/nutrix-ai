import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { cache } from '@/lib/cache'
import { parseAIResponse } from '@/lib/ai-utils'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 })
    }

    const { restaurantName, restaurantType, userTargets, timeOfDay = 'lunch', userKnowledge } = await request.json()

    if (!restaurantName) {
      return NextResponse.json({ error: 'Restaurant name is required' }, { status: 400 })
    }

    // Check cache first
    const cacheKey = `estimate_${restaurantName.toLowerCase().replace(/\s+/g, '_')}_${timeOfDay}`
    const cachedResult = cache.get(cacheKey)
    if (cachedResult) {
      console.log('🚀 Restaurant estimation cache hit:', cacheKey)
      return NextResponse.json({
        ...cachedResult,
        cached: true
      })
    }

    const remainingMacros = userTargets?.remaining || { calories: 800, protein: 60, carbs: 80, fat: 30 }

    const prompt = `RESPOND WITH ONLY VALID JSON. NO EXPLANATORY TEXT BEFORE OR AFTER.

Estimate meals for "${restaurantName}" restaurant. User needs: ${remainingMacros.calories}cal, ${remainingMacros.protein}g protein for ${timeOfDay}.

RESTAURANT INFO:
- Name: ${restaurantName}
- Type: ${restaurantType || 'Unknown cuisine'}
${userKnowledge ? `- User Knowledge: ${userKnowledge}` : ''}

INSTRUCTIONS:
- Make educated guesses based on typical ${restaurantType || 'restaurant'} offerings
- Focus on common menu items that would exist at this type of establishment
- Provide realistic macro estimates based on typical portion sizes
- Include popular dishes that would fit the user's macro targets
- If user provided specific knowledge, incorporate that information

Return this exact JSON structure with 3-5 estimated meals:
{
  "estimatedMeals": [
    {
      "id": "est_meal_1",
      "title": "Grilled Chicken Salad",
      "description": "Fresh greens with grilled chicken breast",
      "calories": 450,
      "protein": 35,
      "carbs": 25,
      "fat": 18,
      "confidence": "medium",
      "reasoning": "Typical restaurant portion of grilled chicken (6oz) with mixed greens",
      "ingredients": "Mixed greens, grilled chicken breast, vegetables, light dressing",
      "orderingTips": "Ask for dressing on the side, request extra protein if needed"
    }
  ],
  "disclaimer": "These are AI-estimated macros based on typical ${restaurantType || 'restaurant'} portions. Actual values may vary.",
  "confidence": "medium",
  "needsVerification": true,
  "restaurantType": "${restaurantType || 'casual dining'}",
  "suggestions": {
    "dataNeeded": "Menu photos, specific dish names, or portion size information would improve accuracy",
    "userCanHelp": "Users can contribute actual macro data to improve future estimates"
  }
}`

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 2000,
    })

    const aiResponse = completion.choices[0]?.message?.content
    if (!aiResponse) {
      return NextResponse.json({ error: 'No response from AI estimator' }, { status: 500 })
    }

    try {
      const parsedResponse = parseAIResponse(aiResponse)

      const result = {
        success: true,
        estimated: true,
        restaurantName,
        restaurantType: restaurantType || 'Unknown',
        meals: parsedResponse.estimatedMeals || [],
        disclaimer: parsedResponse.disclaimer,
        confidence: parsedResponse.confidence || 'low',
        needsVerification: true,
        suggestions: parsedResponse.suggestions,
        userKnowledge: userKnowledge || null
      }

      // Cache estimated results for 4 hours (shorter than verified data)
      cache.set(cacheKey, result, 240)
      console.log('💾 Restaurant estimation cached:', cacheKey)

      return NextResponse.json(result)
    } catch (parseError) {
      console.error('Failed to parse AI estimation response:', parseError)
      console.error('Raw AI response:', aiResponse)
      return NextResponse.json({
        success: false,
        error: 'Failed to parse AI estimation',
        rawResponse: aiResponse
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Restaurant estimation error:', error)
    return NextResponse.json({ error: 'Failed to estimate restaurant meals' }, { status: 500 })
  }
}