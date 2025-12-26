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

    const { restaurantBrand, mealType = 'popular' } = await request.json()

    if (!restaurantBrand) {
      return NextResponse.json({ error: 'Restaurant brand required' }, { status: 400 })
    }

    // Get existing meals for context
    const existingMeals = await prisma.orderTemplate.findMany({
      where: {
        restaurantBrand: restaurantBrand.toLowerCase()
      },
      select: {
        title: true,
        description: true,
        calories: true,
        protein: true
      }
    })

    const existingMealsList = existingMeals.map(m => `${m.title}: ${m.description} (${m.calories}cal, ${m.protein}g protein)`).join('\n')

    const prompt = `You are a nutrition expert familiar with ${restaurantBrand} menu items and customizations.

Existing meals we already have:
${existingMealsList}

Generate 10 NEW meal variations for ${restaurantBrand} that we don't already have. Focus on:
- Popular customizations (double protein, extra vegetables, different bases)
- Healthy modifications (no rice, extra protein, light on sauces)
- Different protein combinations
- Meal variations for different dietary goals (high protein, low carb, balanced)

For each meal, provide realistic nutrition information based on ${restaurantBrand}'s actual ingredients.

Return a JSON array with this exact structure:
[
  {
    "title": "Meal name (be specific about customizations)",
    "description": "Detailed description of ingredients",
    "calories": 500,
    "protein": 35,
    "carbs": 40,
    "fat": 15,
    "tags": ["high-protein", "customized"],
    "keywordsForDeliverySearch": "keywords for finding this on delivery apps"
  }
]

Make sure nutrition values are realistic for ${restaurantBrand} portions and ingredients.`

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 2000,
    })

    const aiResponse = completion.choices[0]?.message?.content
    if (!aiResponse) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 })
    }

    let generatedMeals
    try {
      generatedMeals = JSON.parse(aiResponse)
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError)
      return NextResponse.json({ error: 'Invalid AI response format' }, { status: 500 })
    }

    // Validate and save new meals
    const createdMeals = []
    for (const meal of generatedMeals) {
      try {
        // Validate required fields
        if (!meal.title || !meal.description || !meal.calories || !meal.protein) {
          console.log('Skipping invalid meal:', meal)
          continue
        }

        // Check if meal already exists
        const existing = await prisma.orderTemplate.findFirst({
          where: {
            restaurantBrand: restaurantBrand.toLowerCase(),
            title: {
              contains: meal.title,
              mode: 'insensitive'
            }
          }
        })

        if (!existing) {
          const created = await prisma.orderTemplate.create({
            data: {
              restaurantBrand: restaurantBrand.toLowerCase(),
              title: meal.title,
              description: meal.description,
              calories: parseInt(meal.calories),
              protein: parseInt(meal.protein),
              carbs: parseInt(meal.carbs) || 0,
              fat: parseInt(meal.fat) || 0,
              tags: JSON.stringify(meal.tags || []),
              keywordsForDeliverySearch: meal.keywordsForDeliverySearch || meal.title
            }
          })
          createdMeals.push(created)
        }
      } catch (error) {
        console.error('Failed to create meal:', meal, error)
      }
    }

    return NextResponse.json({
      message: `Generated ${createdMeals.length} new AI-powered meal variations`,
      newMeals: createdMeals,
      totalGenerated: generatedMeals.length,
      restaurantBrand
    })

  } catch (error) {
    console.error('Failed to generate AI meals:', error)
    return NextResponse.json({ error: 'Failed to generate meals' }, { status: 500 })
  }
}