import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

// POST: Scan a receipt image and extract grocery items
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { imageBase64, imageUrl } = body

    if (!imageBase64 && !imageUrl) {
      return NextResponse.json({ error: 'Image required (base64 or URL)' }, { status: 400 })
    }

    // Prepare image for GPT-5.2 responses.create API (uses 'input_image' type)
    const imageContent = imageBase64
      ? { type: 'input_image' as const, image_url: `data:image/jpeg;base64,${imageBase64}`, detail: 'auto' as const }
      : { type: 'input_image' as const, image_url: imageUrl, detail: 'auto' as const }

    const systemPrompt = `You are a grocery receipt analyzer. Extract food items from the receipt image.

For each item, determine:
1. name: Clean product name (remove brand codes, sizes)
2. category: One of: protein, carb, vegetable, fruit, dairy, snack, condiment, beverage, other
3. quantity: If visible (e.g., "2 lbs", "1 bag", "6 pack")

Focus on FOOD ITEMS only. Skip:
- Non-food items (cleaning supplies, etc.)
- Store loyalty/rewards info
- Payment details
- Tax lines

Return JSON only: {"items": [...]}`

    const response = await openai.responses.create({
      model: 'gpt-5.2',
      input: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'input_text' as const, text: 'Extract all food items from this receipt. Return as JSON array with {name, category, quantity} for each item.' },
            imageContent
          ]
        }
      ]
    })

    const content = response.output_text
    if (!content) {
      return NextResponse.json({ error: 'Failed to analyze receipt' }, { status: 500 })
    }

    let parsed
    try {
      parsed = JSON.parse(content)
    } catch {
      return NextResponse.json({ error: 'Failed to parse receipt data' }, { status: 500 })
    }

    const items = parsed.items || parsed.groceries || parsed.products || []

    // Enhance items with estimated nutrition for common items
    const enhancedItems = items.map((item: any) => ({
      name: item.name,
      category: item.category || 'other',
      quantity: item.quantity || null,
      source: 'receipt_scan',
      // We'll let the user confirm/edit these
      calories: null,
      protein: null,
      carbs: null,
      fat: null
    }))

    return NextResponse.json({
      success: true,
      items: enhancedItems,
      rawCount: items.length
    })
  } catch (error) {
    console.error('Failed to scan receipt:', error)
    return NextResponse.json({ error: 'Failed to scan receipt' }, { status: 500 })
  }
}
