import { NextRequest, NextResponse } from 'next/server'
import { OpenAI } from 'openai'
import { PreferencesResponseSchema } from '@/lib/types'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(request: NextRequest) {
  try {
    const { freeText } = await request.json()

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    const prompt = `Parse the following user description about their body situation and goals into structured preferences. Return valid JSON only.

User description: "${freeText}"

Extract:
- eating_pattern: "mostly_eat_out" | "mostly_home" | "mixed" (based on their lifestyle)
- dislikes_detected: string[] (foods mentioned they don't like)
- preferred_cuisines: string[] (cuisines they mention liking)
- time_to_cook: "none" | "15min" | "30min+" (based on their lifestyle/schedule)
- budget: "low" | "medium" | "high" (optional, only if mentioned)
- coaching_notes: string (1-2 sentences of encouragement/advice based on their goals)

Return JSON in this exact format:
{
  "eating_pattern": "mixed",
  "dislikes_detected": ["mushrooms"],
  "preferred_cuisines": ["mexican", "asian"],
  "time_to_cook": "15min",
  "budget": "medium",
  "coaching_notes": "Focus on protein at each meal and don't stress about perfection - consistency beats intensity."
}`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a nutrition expert. Extract structured preferences from user descriptions. Return only valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 500,
      temperature: 0.3
    })

    const responseText = completion.choices[0]?.message?.content?.trim()
    if (!responseText) {
      throw new Error('No response from OpenAI')
    }

    let parsedResponse
    try {
      parsedResponse = JSON.parse(responseText)
    } catch (parseError) {
      // Retry once if JSON parsing fails
      console.error('JSON parsing failed, retrying...')

      const retryCompletion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Return ONLY valid JSON. No markdown, no explanations.'
          },
          {
            role: 'user',
            content: `Parse this into JSON: ${freeText}`
          }
        ],
        max_tokens: 300,
        temperature: 0.1
      })

      const retryText = retryCompletion.choices[0]?.message?.content?.trim()
      if (!retryText) throw new Error('Retry failed')

      parsedResponse = JSON.parse(retryText)
    }

    // Validate with Zod
    const validatedResponse = PreferencesResponseSchema.parse(parsedResponse)

    return NextResponse.json(validatedResponse)
  } catch (error) {
    console.error('Preferences parsing error:', error)

    // Return fallback preferences if OpenAI fails
    return NextResponse.json({
      eating_pattern: 'mixed',
      dislikes_detected: [],
      preferred_cuisines: [],
      time_to_cook: '15min',
      coaching_notes: 'Focus on consistency with your nutrition goals. Small progress every day adds up!'
    })
  }
}