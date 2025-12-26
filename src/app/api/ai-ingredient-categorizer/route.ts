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

    const { ingredients, restaurantContext } = await request.json()

    if (!ingredients || !Array.isArray(ingredients)) {
      return NextResponse.json({ error: 'Ingredients array required' }, { status: 400 })
    }

    // Batch process ingredients efficiently
    const ingredientsList = ingredients.map((ing: any) =>
      `${ing.name} (${ing.calories}cal, ${ing.protein}g protein, ${ing.carbs}g carbs, ${ing.fat}g fat)`
    ).join('\n')

    const prompt = `You are an expert food categorization system. Analyze these restaurant ingredients and categorize them intelligently.

RESTAURANT: ${restaurantContext || 'Unknown'}

INGREDIENTS TO CATEGORIZE:
${ingredientsList}

TASK: Categorize each ingredient into the most appropriate category with reasoning. Consider:
- Primary nutritional function (protein source, energy source, etc.)
- How it's typically used in meal building
- Restaurant-specific context (e.g., at Chipotle, black beans are both protein AND base)
- Macro composition patterns

CATEGORIES:
- protein: Main protein sources (meat, fish, legumes, tofu)
- base: Foundation foods (grains, bread, lettuce bases)
- vegetables: Fresh/cooked vegetables, herbs
- sauces: Liquid/creamy additions (dressings, sauces, spreads)
- toppings: Final additions (cheese, nuts, crispy elements)
- healthy_fats: Primarily fat-based foods (avocado, oils, nuts)
- other: Anything that doesn't fit clearly

Return JSON with this structure:
{
  "categorizedIngredients": [
    {
      "name": "Grilled Chicken",
      "category": "protein",
      "primaryFunction": "High-quality complete protein source",
      "secondaryCategories": [],
      "buildingRole": "Main protein component for muscle building",
      "macroProfile": "High protein, low carb, moderate fat",
      "confidence": 0.95
    },
    {
      "name": "Black Beans",
      "category": "protein",
      "primaryFunction": "Plant-based protein with complex carbs",
      "secondaryCategories": ["base"],
      "buildingRole": "Can serve as protein or carb base for vegetarians",
      "macroProfile": "High protein, high carbs, low fat",
      "confidence": 0.85
    }
  ],
  "insights": {
    "totalIngredients": 10,
    "categoryDistribution": {"protein": 3, "base": 2, "vegetables": 3, "sauces": 1, "toppings": 1},
    "restaurantSpecificNotes": "This restaurant focuses on build-your-own bowls with flexible ingredient roles"
  }
}

IMPORTANT:
- Be precise but flexible - some ingredients serve multiple roles
- Consider macro composition (high protein = likely protein category)
- Account for restaurant context (Subway bread = base, Cava pita = can be topping)
- Provide confidence scores (0.7-1.0 range)
- Identify ingredients that could serve secondary roles`

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1, // Lower temperature for more consistent categorization
      max_tokens: 2000,
    })

    const aiResponse = completion.choices[0]?.message?.content
    if (!aiResponse) {
      return NextResponse.json({ error: 'No response from AI categorizer' }, { status: 500 })
    }

    try {
      const parsedResponse = JSON.parse(aiResponse)

      return NextResponse.json({
        success: true,
        categorization: parsedResponse,
        processingTime: Date.now(),
        model: "gpt-4o-mini"
      })
    } catch (parseError) {
      console.error('Failed to parse AI categorization response:', parseError)
      return NextResponse.json({
        success: false,
        error: 'Invalid AI response format',
        rawResponse: aiResponse
      }, { status: 500 })
    }

  } catch (error) {
    console.error('AI ingredient categorization error:', error)
    return NextResponse.json({ error: 'Failed to categorize ingredients' }, { status: 500 })
  }
}