import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { prisma } from '@/lib/prisma'
import { getUserHour } from '@/lib/timezone'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(request: NextRequest) {
  try {
    const { message, userId, parseOnly = false, currentHour: passedHour, timezone = 'America/Los_Angeles' } = await request.json()

    if (!message || !userId) {
      return NextResponse.json(
        { error: 'Message and userId are required' },
        { status: 400 }
      )
    }

    // Use passed currentHour or calculate from timezone (never calculate from server time)
    const currentHour = passedHour !== undefined
      ? passedHour
      : getUserHour(timezone)

    const timeContext = currentHour < 11 ? 'morning (breakfast time)'
                      : currentHour < 16 ? 'midday (lunch time)'
                      : 'evening (dinner time)'

    // Use OpenAI to parse the meal information from user's message
    const systemPrompt = `You are a helpful nutrition assistant that helps users log their meals.
Current time context: It's ${timeContext}.

When a user tells you what they ate, extract the meal information and respond in this JSON format:
{
  "mealName": "exact name of the meal/food (INCLUDE restaurant name if mentioned, e.g. 'Chipotle Chicken Bowl')",
  "restaurantName": "restaurant name if mentioned (e.g. 'chipotle', 'cava'), or null if homemade/unknown",
  "estimatedCalories": number,
  "estimatedProtein": number (in grams),
  "estimatedCarbs": number (in grams),
  "estimatedFat": number (in grams),
  "servings": number (default 1),
  "mealType": "breakfast" | "lunch" | "dinner" | "snack",
  "userMessage": "a friendly confirmation message to the user",
  "shouldLog": true/false (true if this is a meal to log, false if just chatting)
}

RESTAURANT DETECTION:
- If user mentions a restaurant (chipotle, cava, sweetgreen, subway, panera, starbucks, etc.), capture it in "restaurantName"
- Include the restaurant name in "mealName" for clarity (e.g., "Chipotle Chicken Bowl" not just "Chicken Bowl")

MEAL TYPE INFERENCE:
- Use the current time as a default, but infer from food type when obvious:
  - Breakfast foods (eggs, oatmeal, cereal, pancakes, toast) → breakfast
  - Lunch foods (sandwich, salad, soup) → lunch
  - Dinner foods (pasta, steak, large entrees) → dinner
  - Small items (protein bar, fruit, nuts, coffee) → snack
- If user explicitly says "for breakfast/lunch/dinner", use that regardless of time

Be conversational and friendly. If the user is just saying hello or asking a question, set shouldLog to false.
If they mention eating something, parse it and provide ACCURATE nutrition estimates.

CRITICAL - ACCURACY GUIDELINES:
- Use real nutritional data for known restaurants and foods
- Don't inflate or round up excessively - users depend on accuracy for their nutrition goals
- When uncertain, use conservative middle-ground estimates

QUANTITY HANDLING (VERY IMPORTANT):
- When user says a quantity (e.g., "2 tacos", "3 wings", "2 sides"), set "servings" to that number
- Estimate macros for ONE SINGLE ITEM, not the total
- The system will multiply automatically: if user says "2 tacos", you return per-taco macros with servings: 2
- Examples:
  - "2 chicken tacos" → estimate ONE taco (~170 cal, 10g protein), servings: 2
  - "3 mozzarella sticks" → estimate ONE stick (~80 cal, 4g protein), servings: 3
  - "2 sides of rice" → estimate ONE side (~150-200 cal), servings: 2
  - "half a burrito" → estimate full burrito macros, servings: 0.5
- "Sides" at restaurants are typically small portions (100-250 cal each)
- Do NOT multiply in your estimates - just provide per-unit values

COMMON PORTION SIZES:
- Restaurant side (rice, beans, veggies): 100-200 cal each
- Fast food burger: 400-600 cal each
- Taco: 150-250 cal each
- Chicken wing: 80-100 cal each
- Slice of pizza: 250-350 cal each
- Chipotle burrito bowl: 600-900 cal (as one serving)

Respond with valid JSON only.`

    const completion = await openai.responses.create({
      model: 'gpt-5.2',
      input: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ]
    })

    const responseText = completion.output_text
    if (!responseText) {
      throw new Error('No response from OpenAI')
    }

    const parsedResponse = JSON.parse(responseText)

    // If this is a meal to log
    if (parsedResponse.shouldLog) {
      const servings = parsedResponse.servings || 1
      const mealName = parsedResponse.mealName?.toLowerCase() || ''

      // Try to find a matching item in the database first (source of truth)
      let dbMatch = null
      const orderTemplates = await prisma.orderTemplate.findMany({
        where: {
          OR: [
            { title: { contains: mealName, mode: 'insensitive' } },
            { keywordsForDeliverySearch: { contains: mealName, mode: 'insensitive' } }
          ]
        },
        take: 5
      })

      if (orderTemplates.length > 0) {
        const scored = orderTemplates.map(t => {
          const titleLower = t.title.toLowerCase()
          const score = mealName.includes(titleLower) || titleLower.includes(mealName) ? 2 :
                       mealName.split(' ').filter((w: string) => titleLower.includes(w)).length
          return { template: t, score }
        }).sort((a, b) => b.score - a.score)

        if (scored[0]?.score > 0) {
          dbMatch = scored[0].template
        }
      }

      // Use database match if found, otherwise use AI estimate
      const finalCalories = dbMatch ? dbMatch.calories : parsedResponse.estimatedCalories
      const finalProtein = dbMatch ? dbMatch.protein : parsedResponse.estimatedProtein
      const finalCarbs = dbMatch ? dbMatch.carbs : parsedResponse.estimatedCarbs
      const finalFat = dbMatch ? dbMatch.fat : parsedResponse.estimatedFat
      const finalName = dbMatch ? dbMatch.title : parsedResponse.mealName

      const totalCalories = Math.round(finalCalories * servings)
      const totalProtein = Math.round(finalProtein * servings)
      const totalCarbs = Math.round(finalCarbs * servings)
      const totalFat = Math.round(finalFat * servings)

      // If parseOnly mode, just return the parsed data without logging
      if (parseOnly) {
        return NextResponse.json({
          success: true,
          mealParsed: true,
          parsedMeal: {
            name: finalName,
            calories: totalCalories,
            protein: totalProtein,
            carbs: totalCarbs,
            fat: totalFat,
            servings
          },
          message: parsedResponse.userMessage,
          source: dbMatch ? 'database' : 'ai_estimate'
        })
      }

      // Determine source - restaurant if dbMatch or AI detected a restaurant
      const isRestaurant = dbMatch || parsedResponse.restaurantName
      const restaurantName = parsedResponse.restaurantName?.toLowerCase() || ''

      // Otherwise, create and log the meal
      const foodCatalogItem = await prisma.foodCatalogItem.create({
        data: {
          source: isRestaurant ? 'restaurant' : 'user_logged',
          name: finalName,
          calories: finalCalories,
          protein: finalProtein,
          carbs: finalCarbs,
          fat: finalFat,
          tags: restaurantName ? JSON.stringify([restaurantName]) : '[]'
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
          name: finalName,
          calories: totalCalories,
          protein: totalProtein,
          carbs: totalCarbs,
          fat: totalFat,
          servings
        },
        source: dbMatch ? 'database' : 'ai_estimate'
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
