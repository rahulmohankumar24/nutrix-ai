import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { prisma } from '@/lib/prisma'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(request: NextRequest) {
  try {
    const { message, userId } = await request.json()

    if (!message || !userId) {
      return NextResponse.json(
        { error: 'Message and userId are required' },
        { status: 400 }
      )
    }

    // Use OpenAI to parse the meal information from user's message
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a helpful nutrition assistant that helps users log their meals.

When a user tells you what they ate, extract the meal information and respond in this JSON format:
{
  "mealName": "exact name of the meal/food",
  "estimatedCalories": number,
  "estimatedProtein": number (in grams),
  "estimatedCarbs": number (in grams),
  "estimatedFat": number (in grams),
  "servings": number (default 1),
  "userMessage": "a friendly confirmation message to the user",
  "shouldLog": true/false (true if this is a meal to log, false if just chatting)
}

Be conversational and friendly. If the user is just saying hello or asking a question, set shouldLog to false.
If they mention eating something, parse it and provide reasonable nutrition estimates based on typical serving sizes.

Examples:
User: "I had a chicken salad"
Response: {"mealName": "Chicken Salad", "estimatedCalories": 350, "estimatedProtein": 35, "estimatedCarbs": 12, "estimatedFat": 18, "servings": 1, "userMessage": "Got it! I've logged your chicken salad. That's a great protein-rich choice!", "shouldLog": true}

User: "Hey"
Response: {"shouldLog": false, "userMessage": "Hi! What did you eat today? Just tell me what you had and I'll log it for you."}

User: "2 slices of pizza"
Response: {"mealName": "Pizza", "estimatedCalories": 570, "estimatedProtein": 24, "estimatedCarbs": 68, "estimatedFat": 22, "servings": 2, "userMessage": "Logged 2 slices of pizza for you!", "shouldLog": true}`
        },
        {
          role: 'user',
          content: message
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7
    })

    const responseText = completion.choices[0]?.message?.content
    if (!responseText) {
      throw new Error('No response from OpenAI')
    }

    const parsedResponse = JSON.parse(responseText)

    // If this is a meal to log, create a food catalog item and log it
    if (parsedResponse.shouldLog) {
      // Create the food catalog item
      const foodCatalogItem = await prisma.foodCatalogItem.create({
        data: {
          source: 'user_logged',
          name: parsedResponse.mealName,
          calories: parsedResponse.estimatedCalories,
          protein: parsedResponse.estimatedProtein,
          carbs: parsedResponse.estimatedCarbs,
          fat: parsedResponse.estimatedFat,
          tags: '[]'
        }
      })

      // Log the meal
      await prisma.mealLog.create({
        data: {
          userId,
          foodCatalogItemId: foodCatalogItem.id,
          servings: parsedResponse.servings || 1,
          datetime: new Date()
        }
      })

      // Calculate total macros for this meal
      const totalCalories = parsedResponse.estimatedCalories * (parsedResponse.servings || 1)
      const totalProtein = parsedResponse.estimatedProtein * (parsedResponse.servings || 1)
      const totalCarbs = parsedResponse.estimatedCarbs * (parsedResponse.servings || 1)
      const totalFat = parsedResponse.estimatedFat * (parsedResponse.servings || 1)

      return NextResponse.json({
        success: true,
        message: parsedResponse.userMessage,
        mealLogged: true,
        mealData: {
          name: parsedResponse.mealName,
          calories: Math.round(totalCalories),
          protein: Math.round(totalProtein),
          carbs: Math.round(totalCarbs),
          fat: Math.round(totalFat),
          servings: parsedResponse.servings || 1
        }
      })
    }

    // Just chatting, no meal to log
    return NextResponse.json({
      success: true,
      message: parsedResponse.userMessage,
      mealLogged: false
    })

  } catch (error) {
    console.error('Chat log meal error:', error)
    return NextResponse.json(
      {
        error: 'Failed to process message',
        message: "Sorry, I had trouble understanding that. Could you try rephrasing what you ate?"
      },
      { status: 500 }
    )
  }
}
