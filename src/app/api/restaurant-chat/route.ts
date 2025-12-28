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

    const { message, restaurantName, meals, conversationHistory } = await request.json()

    if (!message || !restaurantName) {
      return NextResponse.json({ error: 'Message and restaurant name required' }, { status: 400 })
    }

    // Build menu context
    const menuContext = meals && meals.length > 0
      ? meals.map((m: any) =>
          `- ${m.title}: ${m.calories}cal, ${m.protein}g protein, ${m.carbs}g carbs, ${m.fat}g fat${m.fitBadge ? ` [${m.fitBadge}]` : ''}\n  ${m.description || ''}`
        ).join('\n')
      : 'No specific menu items available.'

    // Build conversation history for context
    const historyMessages = (conversationHistory || []).map((msg: any) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    }))

    const systemPrompt = `You are a helpful nutrition assistant for ${restaurantName}. You help users decide what to order based on their dietary goals and preferences.

AVAILABLE MENU ITEMS:
${menuContext}

GUIDELINES:
- Be concise and friendly (2-3 sentences max unless they ask for details)
- Focus on nutrition facts when relevant
- Recommend specific items from the menu when possible
- If they ask about items not on the menu, say you can only help with the items shown
- Use the fit badges (PERFECT MATCH, HIGHLY RECOMMENDED, etc.) to guide recommendations
- Don't use emojis unless the user does first

Remember: You're helping them make a quick decision about what to eat, not writing an essay.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...historyMessages,
        { role: 'user', content: message }
      ],
      temperature: 0.7,
      max_tokens: 300
    })

    const response = completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.'

    return NextResponse.json({ response })
  } catch (error) {
    console.error('Restaurant chat error:', error)
    return NextResponse.json({ error: 'Failed to process chat' }, { status: 500 })
  }
}
