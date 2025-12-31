import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(request: NextRequest) {
  try {
    const { image, context } = await request.json()

    if (!image) {
      return NextResponse.json({ error: 'Image required' }, { status: 400 })
    }

    const contextPrompt = context
      ? `The user provided this context: "${context}". Use this to help identify portion sizes or specific items.`
      : ''

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a nutrition expert analyzing food images. Estimate the nutritional content as accurately as possible.

Return a JSON object with this exact structure:
{
  "name": "Brief descriptive name of the meal/food",
  "calories": number,
  "protein": number (in grams),
  "carbs": number (in grams),
  "fat": number (in grams),
  "confidence": "high" | "medium" | "low",
  "notes": "Brief note about the estimation or any assumptions made"
}

Guidelines:
- Be specific with the meal name (e.g., "Grilled Chicken Salad with Ranch" not just "Salad")
- Estimate based on typical portion sizes visible in the image
- If multiple items, sum them up into one total
- Consider cooking methods visible (fried, grilled, etc.)
- If unsure, err slightly higher on calories for weight loss safety
- Return ONLY valid JSON, no markdown or extra text`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze this food image and estimate its nutritional content. ${contextPrompt}`
            },
            {
              type: 'image_url',
              image_url: {
                url: image,
                detail: 'high'
              }
            }
          ]
        }
      ],
      max_tokens: 500
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from AI')
    }

    // Parse the JSON response
    const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim()
    const parsed = JSON.parse(cleanedContent)

    return NextResponse.json({
      success: true,
      meal: {
        name: parsed.name,
        calories: Math.round(parsed.calories),
        protein: Math.round(parsed.protein),
        carbs: Math.round(parsed.carbs),
        fat: Math.round(parsed.fat),
        confidence: parsed.confidence,
        notes: parsed.notes
      }
    })
  } catch (error) {
    console.error('Food image analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze image' },
      { status: 500 }
    )
  }
}
