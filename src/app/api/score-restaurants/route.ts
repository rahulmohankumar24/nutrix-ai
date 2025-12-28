import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface Restaurant {
  id: string
  name: string
  type: string
  goalReason: string
  distance: string
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 })
    }

    const { restaurants, userGoal = 'recomp' } = await request.json()

    if (!restaurants || restaurants.length === 0) {
      return NextResponse.json({ scoredRestaurants: [] })
    }

    // Create a concise prompt for the AI to score restaurants
    const restaurantList = restaurants.map((r: Restaurant, idx: number) =>
      `${idx + 1}. ${r.name} (${r.type}) - ${r.goalReason}`
    ).join('\n')

    const goalDescriptions: Record<string, string> = {
      'recomp': 'body recomposition (build muscle while staying lean) - needs high protein, moderate carbs',
      'lean_bulk': 'lean bulk (build muscle with minimal fat gain) - needs high protein, high calories',
      'cut': 'fat loss while maintaining muscle - needs high protein, lower calories',
      'maintenance': 'maintain current physique - balanced macros'
    }

    const prompt = `You are a nutrition expert. Rate these restaurants for someone with goal: ${goalDescriptions[userGoal] || userGoal}.

Restaurants:
${restaurantList}

Rate each restaurant 1-100 based on:
- Protein availability (most important)
- Macro customization options
- Healthy food quality
- Portion control options

Respond with ONLY a JSON array of scores in order, like: [85, 72, 90, 65, ...]`

    const completion = await openai.responses.create({
      model: 'gpt-5.2',
      input: [
        {
          role: 'user',
          content: prompt
        }
      ]
    })

    const responseText = completion.output_text?.trim() || '[]'

    // Parse the scores
    let scores: number[]
    try {
      scores = JSON.parse(responseText)
    } catch (error) {
      // If parsing fails, extract numbers from the response
      const numbers = responseText.match(/\d+/g)
      scores = numbers ? numbers.map(n => parseInt(n)).filter(n => n >= 0 && n <= 100) : []
    }

    // If we don't have enough scores, fill with default value
    while (scores.length < restaurants.length) {
      scores.push(70)
    }

    // Attach scores to restaurants
    const scoredRestaurants = restaurants.map((r: Restaurant, idx: number) => ({
      ...r,
      aiScore: scores[idx] || 70
    }))

    return NextResponse.json({ scoredRestaurants })
  } catch (error) {
    console.error('Failed to score restaurants:', error)
    // Return restaurants with default scores on error
    const scoredRestaurants = (request.body as any)?.restaurants?.map((r: Restaurant) => ({
      ...r,
      aiScore: 70
    })) || []
    return NextResponse.json({ scoredRestaurants })
  }
}
