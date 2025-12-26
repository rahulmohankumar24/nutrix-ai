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

    // Get available ingredients for this restaurant
    const ingredients = await prisma.foodCatalogItem.findMany({
      where: {
        source: 'restaurant',
        tags: {
          contains: restaurantBrand.toLowerCase()
        }
      },
      orderBy: {
        name: 'asc'
      }
    })

    if (ingredients.length === 0) {
      return NextResponse.json({ error: 'No ingredients found for this restaurant' }, { status: 404 })
    }

    // Categorize ingredients for AI
    const categorizedIngredients = categorizeIngredients(ingredients)

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
      'breakfast': 'Morning meal - focus on energy and protein to start the day',
      'lunch': 'Midday meal - sustained energy for afternoon productivity',
      'dinner': 'Evening meal - focus on recovery and meeting daily targets',
      'snack': 'Light meal - fill macro gaps without overeating'
    }

    const restaurantInstructions: Record<string, string> = {
      'cava': 'Build Mediterranean bowls with base, protein, vegetables, and sauces',
      'chipotle': 'Create burritos, bowls, or salads with rice/beans, protein, vegetables, and toppings',
      'subway': 'Design sandwiches with bread, protein, vegetables, and condiments',
      'sweetgreen': 'Construct salads with greens, protein, vegetables, and dressings'
    }

    // More efficient, focused prompt for faster AI response
    const prompt = `Build ${restaurantBrand} meals. User needs: ${remainingMacros.calories}cal, ${remainingMacros.protein}g protein remaining for ${timeOfDay}.

INGREDIENTS:
${Object.entries(categorizedIngredients).map(([cat, items]) =>
  `${cat.toUpperCase()}: ${(items as any[]).map(i => `${i.name}(${i.calories}c,${i.protein}p,${i.carbs}cb,${i.fat}f)`).join(', ')}`
).join('\n')}

Create 3 meal combos hitting targets. Return JSON:
{
  "customMeals": [
    {
      "id": "meal_1",
      "title": "Power Bowl",
      "description": "Brief combo description",
      "totalCalories": 485,
      "totalProtein": 42,
      "totalCarbs": 35,
      "totalFat": 18,
      "macroFitScore": 92,
      "ingredients": [
        {"name": "Grilled Chicken", "id": "ing_1", "calories": 180, "protein": 35, "carbs": 0, "fat": 4, "category": "protein"},
        {"name": "Brown Rice", "id": "ing_2", "calories": 220, "protein": 5, "carbs": 45, "fat": 2, "category": "base"}
      ],
      "reasoning": "High protein, good carbs",
      "buildInstructions": "Order: base + protein + veggies + sauce"
    }
  ],
  "overallAdvice": "Quick tip",
  "restaurantTips": "Ordering tip"
}

Requirements: Use exact ingredient names, sum macros correctly, realistic portions, fit remaining targets.`

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 3000,
    })

    const aiResponse = completion.choices[0]?.message?.content
    if (!aiResponse) {
      return NextResponse.json({ error: 'No response from AI meal builder' }, { status: 500 })
    }

    try {
      // Clean the AI response - remove markdown code blocks if present
      const cleanedResponse = aiResponse
        .replace(/```json\s*/g, '')
        .replace(/```\s*$/g, '')
        .trim()

      const parsedResponse = JSON.parse(cleanedResponse)

      return NextResponse.json({
        success: true,
        customMeals: parsedResponse.customMeals || [],
        coaching: parsedResponse,
        restaurantBrand,
        availableIngredients: ingredients.length,
        mealCount: parsedResponse.customMeals?.length || 0
      })
    } catch (parseError) {
      console.error('Failed to parse AI meal builder response:', parseError)
      return NextResponse.json({
        success: false,
        error: 'Invalid AI response format',
        rawResponse: aiResponse
      }, { status: 500 })
    }

  } catch (error) {
    console.error('AI meal builder error:', error)
    return NextResponse.json({ error: 'Failed to generate custom meals' }, { status: 500 })
  }
}

function categorizeIngredients(ingredients: any[]) {
  const result = {
    protein: [],
    base: [],
    vegetables: [],
    sauces: [],
    toppings: [],
    other: []
  }

  ingredients.forEach(ingredient => {
    const name = ingredient.name.toLowerCase()
    const tags = ingredient.tags ? JSON.parse(ingredient.tags) : []
    const lowerTags = tags.map((tag: string) => tag.toLowerCase())

    let category = 'other'

    // Check tags first
    if (lowerTags.includes('protein') || lowerTags.includes('meat')) {
      category = 'protein'
    } else if (lowerTags.includes('base') || lowerTags.includes('grain')) {
      category = 'base'
    } else if (lowerTags.includes('vegetable') || lowerTags.includes('veggie')) {
      category = 'vegetables'
    } else if (lowerTags.includes('sauce') || lowerTags.includes('dressing')) {
      category = 'sauces'
    } else if (lowerTags.includes('topping') || lowerTags.includes('extra')) {
      category = 'toppings'
    } else {
      // Fallback to name-based categorization
      if (name.includes('chicken') || name.includes('beef') || name.includes('lamb') ||
          name.includes('salmon') || name.includes('steak') || name.includes('pork') ||
          name.includes('tofu') || name.includes('falafel') || name.includes('meatball')) {
        category = 'protein'
      } else if (name.includes('rice') || name.includes('quinoa') || name.includes('pita') ||
                 name.includes('bread') || name.includes('tortilla') || name.includes('bowl') ||
                 name.includes('base') || name.includes('grain')) {
        category = 'base'
      } else if (name.includes('tomato') || name.includes('cucumber') || name.includes('onion') ||
                 name.includes('pepper') || name.includes('lettuce') || name.includes('spinach') ||
                 name.includes('cabbage') || name.includes('carrot') || name.includes('corn') ||
                 name.includes('bean') || name.includes('olive')) {
        category = 'vegetables'
      } else if (name.includes('sauce') || name.includes('dressing') || name.includes('hummus') ||
                 name.includes('vinaigrette') || name.includes('tahini') || name.includes('tzatziki')) {
        category = 'sauces'
      } else if (name.includes('cheese') || name.includes('avocado') || name.includes('nuts') ||
                 name.includes('seeds') || name.includes('crumble') || name.includes('chip')) {
        category = 'toppings'
      }
    }

    (result as any)[category].push(ingredient)
  })

  return result
}