import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { prisma } from '@/lib/prisma'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(request: NextRequest) {
  try {
    const { message, userId, parseOnly = false } = await request.json()

    if (!message || !userId) {
      return NextResponse.json(
        { error: 'Message and userId are required' },
        { status: 400 }
      )
    }

    // Get current hour for meal type inference
    const currentHour = new Date().getHours()
    const timeContext = currentHour < 11 ? 'morning (breakfast time)'
                      : currentHour < 16 ? 'midday (lunch time)'
                      : 'evening (dinner time)'

    // Use OpenAI to parse the meal information from user's message
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a helpful nutrition assistant that helps users log their meals.
Current time context: It's ${timeContext}.

When a user tells you what they ate, extract the meal information and respond in this JSON format:
{
  "mealName": "exact name of the meal/food",
  "estimatedCalories": number,
  "estimatedProtein": number (in grams),
  "estimatedCarbs": number (in grams),
  "estimatedFat": number (in grams),
  "servings": number (default 1),
  "mealType": "breakfast" | "lunch" | "dinner" | "snack",
  "userMessage": "a friendly confirmation message to the user",
  "shouldLog": true/false (true if this is a meal to log, false if just chatting)
}

MEAL TYPE INFERENCE:
- Use the current time as a default, but infer from food type when obvious:
  - Breakfast foods (eggs, oatmeal, cereal, pancakes, toast) → breakfast
  - Lunch foods (sandwich, salad, soup) → lunch
  - Dinner foods (pasta, steak, large entrees) → dinner
  - Small items (protein bar, fruit, nuts, coffee) → snack
- If user explicitly says "for breakfast/lunch/dinner", use that regardless of time

Be conversational and friendly. If the user is just saying hello or asking a question, set shouldLog to false.
If they mention eating something, parse it and provide reasonable nutrition estimates based on typical serving sizes.

Examples:
User: "I had a chicken salad"
Response: {"mealName": "Chicken Salad", "estimatedCalories": 350, "estimatedProtein": 35, "estimatedCarbs": 12, "estimatedFat": 18, "servings": 1, "mealType": "lunch", "userMessage": "Got it! I've logged your chicken salad for lunch. That's a great protein-rich choice!", "shouldLog": true}

User: "Hey"
Response: {"shouldLog": false, "userMessage": "Hi! What did you eat today? Just tell me what you had and I'll log it for you."}

User: "2 slices of pizza"
Response: {"mealName": "Pizza", "estimatedCalories": 570, "estimatedProtein": 24, "estimatedCarbs": 68, "estimatedFat": 22, "servings": 2, "mealType": "dinner", "userMessage": "Logged 2 slices of pizza for dinner!", "shouldLog": true}

User: "had eggs and toast for breakfast"
Response: {"mealName": "Eggs and Toast", "estimatedCalories": 350, "estimatedProtein": 18, "estimatedCarbs": 28, "estimatedFat": 18, "servings": 1, "mealType": "breakfast", "userMessage": "Logged your eggs and toast for breakfast!", "shouldLog": true}`
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

    // If this is a meal to log
    if (parsedResponse.shouldLog) {
      const servings = parsedResponse.servings || 1
      const totalCalories = Math.round(parsedResponse.estimatedCalories * servings)
      const totalProtein = Math.round(parsedResponse.estimatedProtein * servings)
      const totalCarbs = Math.round(parsedResponse.estimatedCarbs * servings)
      const totalFat = Math.round(parsedResponse.estimatedFat * servings)

      // If parseOnly mode, just return the parsed data without logging
      if (parseOnly) {
        return NextResponse.json({
          success: true,
          mealParsed: true,
          parsedMeal: {
            name: parsedResponse.mealName,
            calories: totalCalories,
            protein: totalProtein,
            carbs: totalCarbs,
            fat: totalFat,
            servings
          },
          message: parsedResponse.userMessage
        })
      }

      // Otherwise, create and log the meal
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

      // Determine meal type - use AI inference or fall back to time-based
      const inferredMealType = parsedResponse.mealType ||
        (currentHour < 11 ? 'breakfast' : currentHour < 16 ? 'lunch' : 'dinner')

      // Log the meal
      await prisma.mealLog.create({
        data: {
          userId,
          foodCatalogItemId: foodCatalogItem.id,
          servings,
          datetime: new Date(),
          mealType: inferredMealType
        }
      })

      return NextResponse.json({
        success: true,
        message: parsedResponse.userMessage,
        mealLogged: true,
        mealData: {
          name: parsedResponse.mealName,
          calories: totalCalories,
          protein: totalProtein,
          carbs: totalCarbs,
          fat: totalFat,
          servings
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
