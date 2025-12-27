import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { PrismaClient } from '@prisma/client'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 })
    }

    const { restaurantName, userTargets, timeOfDay = 'lunch', userProfile } = await request.json()

    if (!restaurantName || !userTargets) {
      return NextResponse.json({ error: 'Restaurant name and user targets required' }, { status: 400 })
    }

    console.log(`🔍 Analyzing restaurant: ${restaurantName}`)

    // Check if we have AI-generated meals in the database first
    try {
      const existingMeals = await prisma.aiGeneratedMeal.findMany({
        where: {
          restaurantName: {
            equals: restaurantName,
            mode: 'insensitive'
          }
        },
        include: {
          feedback: true
        },
        orderBy: {
          confidenceScore: 'desc'
        }
      })

      if (existingMeals.length > 0) {
        console.log(`✅ Found ${existingMeals.length} cached AI meals for ${restaurantName}`)

        // Apply feedback adjustments to the meals
        const adjustedMeals = existingMeals.map(meal => ({
          id: meal.id,
          title: meal.title,
          description: meal.description,
          calories: meal.calories + meal.avgCaloriesAdjustment,
          protein: meal.protein + meal.avgProteinAdjustment,
          carbs: meal.carbs + meal.avgCarbsAdjustment,
          fat: meal.fat + meal.avgFatAdjustment,
          reasoning: meal.reasoning,
          estimatedNutrition: meal.estimatedNutrition,
          source: meal.source,
          restaurantBrand: meal.restaurantName,
          tags: JSON.parse(meal.tags),
          feedbackCount: meal.feedbackCount,
          confidenceScore: meal.confidenceScore,
          isAIAnalyzed: true,
          aiGeneratedMealId: meal.id // Include DB ID for feedback
        }))

        return NextResponse.json({
          menuFound: true,
          meals: adjustedMeals.slice(0, 5), // Return top 5 by confidence
          restaurantInfo: {
            cuisineType: 'Unknown',
            generalAdvice: `These recommendations have been refined by ${existingMeals.reduce((sum, m) => sum + m.feedbackCount, 0)} user feedback${existingMeals.reduce((sum, m) => sum + m.feedbackCount, 0) > 0 ? ' reports' : ''}.`
          },
          coaching: {
            overallAdvice: 'Choose high-protein options to meet your goals. User feedback has helped refine these recommendations.'
          },
          cached: true
        })
      }
    } catch (dbError) {
      console.log('DB check failed, continuing with AI generation:', dbError)
      // Continue to AI generation if DB check fails
    }

    console.log(`🤖 Generating new AI recommendations for ${restaurantName}`)

    // Use GPT-4 with web search to find and analyze the menu
    const prompt = `You are a nutrition expert analyzing a restaurant menu for macro tracking.

Restaurant: ${restaurantName}
User's Goal: ${userProfile?.goal || 'recomp'}
Remaining Macros: ${userTargets.remaining?.calories || 0}cal, ${userTargets.remaining?.protein || 0}g protein, ${userTargets.remaining?.carbs || 0}g carbs, ${userTargets.remaining?.fat || 0}g fat
Meal Time: ${timeOfDay}

TASK:
1. Search for "${restaurantName} menu nutrition information" or "${restaurantName} calories protein"
2. Find the actual menu items with their nutritional information if available
3. If exact nutrition isn't available, make educated estimates based on typical ingredients and portions
4. Recommend 3-5 meals from their menu that best fit the user's macro targets

RESPOND WITH ONLY VALID JSON in this EXACT format:
{
  "menuFound": true/false,
  "meals": [
    {
      "id": "meal_1",
      "title": "Menu Item Name",
      "description": "Brief description of what's in it",
      "calories": 500,
      "protein": 40,
      "carbs": 45,
      "fat": 15,
      "reasoning": "Why this fits their goals",
      "estimatedNutrition": true/false,
      "source": "Where you found this info or 'estimated based on typical ingredients'"
    }
  ],
  "restaurantInfo": {
    "cuisineType": "type of cuisine",
    "generalAdvice": "General advice for eating here based on their goals"
  }
}

IMPORTANT:
- Focus on high-protein options if available
- If nutrition data isn't available online, make reasonable estimates
- Prioritize grilled/baked proteins over fried
- Suggest modifications if helpful (e.g., "ask for extra chicken, no cheese")
- Be honest if nutrition info is estimated vs actual`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 2000
    })

    const responseText = completion.choices[0].message.content?.trim() || '{}'

    console.log('Raw AI Response:', responseText)

    // Parse the AI response
    let result
    try {
      // Remove markdown code blocks if present
      const cleanedResponse = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      result = JSON.parse(cleanedResponse)
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError)
      // Return a fallback response
      return NextResponse.json({
        menuFound: false,
        meals: [],
        restaurantInfo: {
          cuisineType: 'Unknown',
          generalAdvice: `We couldn't find specific menu information for ${restaurantName}. When visiting, look for grilled proteins, vegetables, and whole grains to meet your nutrition goals.`
        }
      })
    }

    // Ensure all meals have the required fields
    const validatedMeals = (result.meals || []).map((meal: any, idx: number) => ({
      id: meal.id || `meal_${idx + 1}`,
      title: meal.title || 'Menu Item',
      description: meal.description || '',
      calories: Math.round(meal.calories || 0),
      protein: Math.round(meal.protein || 0),
      carbs: Math.round(meal.carbs || 0),
      fat: Math.round(meal.fat || 0),
      reasoning: meal.reasoning || '',
      estimatedNutrition: meal.estimatedNutrition !== false, // Default to true
      source: meal.source || 'AI estimate',
      restaurantBrand: restaurantName,
      tags: []
    }))

    console.log(`✅ Generated ${validatedMeals.length} meals for ${restaurantName}`)

    // Save AI-generated meals to database for future use
    try {
      const savedMeals = await Promise.all(
        validatedMeals.map(async (meal: any) => {
          const dbMeal = await prisma.aiGeneratedMeal.create({
            data: {
              restaurantName,
              title: meal.title,
              description: meal.description,
              calories: meal.calories,
              protein: meal.protein,
              carbs: meal.carbs,
              fat: meal.fat,
              reasoning: meal.reasoning,
              source: meal.estimatedNutrition ? 'ai_estimated' : 'ai_from_menu',
              estimatedNutrition: meal.estimatedNutrition,
              tags: JSON.stringify(meal.tags || []),
              confidenceScore: meal.estimatedNutrition ? 0.5 : 0.8, // Higher confidence for actual menu data
            }
          })
          return {
            ...meal,
            aiGeneratedMealId: dbMeal.id,
            isAIAnalyzed: true,
            feedbackCount: 0,
            confidenceScore: dbMeal.confidenceScore
          }
        })
      )

      console.log(`💾 Saved ${savedMeals.length} AI meals to database`)

      return NextResponse.json({
        menuFound: result.menuFound || false,
        meals: savedMeals,
        restaurantInfo: result.restaurantInfo || {
          cuisineType: 'Unknown',
          generalAdvice: 'Focus on lean proteins and vegetables'
        },
        coaching: {
          overallAdvice: result.restaurantInfo?.generalAdvice || 'Choose protein-rich options to meet your goals'
        }
      })
    } catch (dbError) {
      console.error('Failed to save to DB, returning meals anyway:', dbError)
      // Return meals even if DB save fails
      return NextResponse.json({
        menuFound: result.menuFound || false,
        meals: validatedMeals.map((m: any) => ({ ...m, isAIAnalyzed: true })),
        restaurantInfo: result.restaurantInfo || {
          cuisineType: 'Unknown',
          generalAdvice: 'Focus on lean proteins and vegetables'
        },
        coaching: {
          overallAdvice: result.restaurantInfo?.generalAdvice || 'Choose protein-rich options to meet your goals'
        }
      })
    }
  } catch (error) {
    console.error('Unknown restaurant analysis error:', error)
    return NextResponse.json(
      {
        error: 'Failed to analyze restaurant',
        menuFound: false,
        meals: [],
        restaurantInfo: {
          cuisineType: 'Unknown',
          generalAdvice: 'Focus on lean proteins and vegetables when visiting this restaurant'
        }
      },
      { status: 500 }
    )
  }
}
