import OpenAI from 'openai'
import {
  MealAgentContext,
  MealAgentResult,
  MealOption,
  ScoredMeal,
  SIZE_MULTIPLIERS
} from './types'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

/**
 * Calculate breakfast target based on daily goals and size preference
 * Breakfast targets ~1/3 of daily goals
 */
export function calculateBreakfastTarget(ctx: MealAgentContext): { calories: number; protein: number } {
  const multiplier = SIZE_MULTIPLIERS.breakfast[ctx.size]

  return {
    calories: Math.round(ctx.dailyTargets.calories * multiplier),
    protein: Math.round(ctx.dailyTargets.protein * multiplier)
  }
}

/**
 * Generate the LLM prompt for breakfast scoring
 */
function getBreakfastPrompt(
  meals: MealOption[],
  target: { calories: number; protein: number },
  dailyTargets: { calories: number; protein: number },
  size: 'light' | 'regular' | 'hearty'
): string {
  const mealsList = meals.slice(0, 25).map((m, i) =>
    `${i + 1}. [${m.id}] ${m.restaurantBrand} - ${m.title}: ${m.calories}cal, ${m.protein}g protein, ${m.carbs}g carbs, ${m.fat}g fat`
  ).join('\n')

  const sizeDescription = {
    light: 'lighter breakfast to leave room for larger meals later',
    regular: 'balanced breakfast (~1/3 of daily goals)',
    hearty: 'substantial breakfast to fuel a busy morning'
  }

  return `You are a nutrition coach helping with BREAKFAST selection.

USER'S GOAL: Start the day with approximately ${target.calories} calories and ${target.protein}g protein
This is ${Math.round(target.calories / dailyTargets.calories * 100)}% of their daily calorie goal and ${Math.round(target.protein / dailyTargets.protein * 100)}% of protein.

User preference: ${size} - ${sizeDescription[size]}

AVAILABLE MEALS:
${mealsList}

SCORING RULES:
1. Score 0-100 based on how well the meal hits the breakfast target
2. BOTH calories AND protein should be close to target for high scores (80+)
3. High-protein breakfast options are preferred for sustained energy
4. Meals that hit protein target but miss calories (or vice versa) should score 60-75
5. Significantly oversized meals for target should be penalized (score 40-60)
6. Significantly undersized meals should score 50-70 (leaves room but may leave hungry)

IDEAL SCORING:
- 90-100: Within 10% of BOTH calorie and protein targets
- 75-89: Within 20% of both targets
- 60-74: One macro close, one off by 20-30%
- 40-59: Both macros significantly off
- Below 40: Very poor fit

Return ONLY valid JSON array (no markdown, no explanation):
[{"id":"meal_id","score":85,"reasoning":"Brief reason"},...]

Return the top 8 highest scoring meals, sorted by score descending.`
}

/**
 * Score breakfast meals using LLM
 */
async function scoreBreakfastMealsWithLLM(
  meals: MealOption[],
  target: { calories: number; protein: number },
  dailyTargets: { calories: number; protein: number },
  size: 'light' | 'regular' | 'hearty'
): Promise<Array<{ id: string; score: number; reasoning: string }>> {
  if (!process.env.OPENAI_API_KEY || meals.length === 0) {
    return []
  }

  const prompt = getBreakfastPrompt(meals, target, dailyTargets, size)

  try {
    const completion = await openai.responses.create({
      model: 'gpt-5.2',
      input: [{ role: 'user', content: prompt + '\n\nRespond with valid JSON only.' }]
    })

    const response = completion.output_text
    if (!response) {
      throw new Error('No response from LLM')
    }

    let jsonStr = response.trim()
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    }

    return JSON.parse(jsonStr) as Array<{ id: string; score: number; reasoning: string }>
  } catch (error) {
    console.error('Breakfast LLM scoring error:', error)
    return []
  }
}

/**
 * Fallback algorithmic scoring for breakfast
 */
function scoreBreakfastAlgorithmically(
  meals: MealOption[],
  target: { calories: number; protein: number }
): Array<{ id: string; score: number; reasoning: string }> {
  return meals.map(meal => {
    const calRatio = target.calories > 0 ? meal.calories / target.calories : 0
    const proRatio = target.protein > 0 ? meal.protein / target.protein : 0

    // Calculate how close each macro is to target (1.0 = perfect)
    const calFit = 1 - Math.abs(1 - calRatio)
    const proFit = 1 - Math.abs(1 - proRatio)

    // Both macros must be good for high scores
    const combinedFit = (calFit + proFit) / 2
    const score = Math.round(Math.max(0, Math.min(100, combinedFit * 100)))

    return {
      id: meal.id,
      score,
      reasoning: `${Math.round(calRatio * 100)}% cal, ${Math.round(proRatio * 100)}% protein of target`
    }
  }).sort((a, b) => b.score - a.score)
}

/**
 * Run the breakfast agent
 */
export async function runBreakfastAgent(ctx: MealAgentContext): Promise<MealAgentResult> {
  const target = calculateBreakfastTarget(ctx)

  // Calculate progress
  const progressCalories = Math.round((ctx.currentIntake.calories / ctx.dailyTargets.calories) * 100)
  const progressProtein = Math.round((ctx.currentIntake.protein / ctx.dailyTargets.protein) * 100)

  // Target milestone after breakfast
  const targetMilestone = SIZE_MULTIPLIERS.breakfast[ctx.size]

  // Score meals with LLM
  let scores = await scoreBreakfastMealsWithLLM(
    ctx.availableMeals,
    target,
    ctx.dailyTargets,
    ctx.size
  )

  // Fallback to algorithmic if LLM fails
  if (scores.length === 0) {
    scores = scoreBreakfastAlgorithmically(ctx.availableMeals, target)
  }

  // Map scores to meals
  const scoreMap = new Map(scores.map(s => [s.id, s]))

  const scoredMeals: ScoredMeal[] = ctx.availableMeals
    .filter(meal => scoreMap.has(meal.id))
    .map(meal => {
      const scoreData = scoreMap.get(meal.id)!
      return {
        id: meal.id,
        name: meal.title,
        description: meal.description,
        restaurant: meal.restaurantBrand,
        calories: meal.calories,
        protein: meal.protein,
        carbs: meal.carbs,
        fat: meal.fat,
        score: scoreData.score,
        aiReasoning: scoreData.reasoning,
        distance: null,
        estimatedPrice: null,
        isPersonalized: meal.patternBoosted || false,
        personalizedReason: null,
        isAIScored: true
      }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)

  // Build message
  const sizeText = ctx.size === 'light' ? 'light' : ctx.size === 'hearty' ? 'hearty' : ''
  const message = progressCalories > 0
    ? `You've already eaten ${ctx.currentIntake.calories} cal. Here are ${sizeText} breakfast options to get you started.`
    : `Start your day strong with a ${sizeText} breakfast targeting ~${target.calories} cal and ${target.protein}g protein.`

  return {
    suggestions: scoredMeals,
    targetForMeal: target,
    message: message.trim(),
    agentType: 'breakfast',
    urgencyLevel: 'low',
    progressToGoal: {
      caloriesPct: progressCalories,
      proteinPct: progressProtein
    },
    mealMilestone: {
      current: progressCalories / 100,
      target: targetMilestone
    }
  }
}
