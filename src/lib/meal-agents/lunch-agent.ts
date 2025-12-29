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
 * Calculate lunch target to reach ~2/3 of daily goals
 * Dynamically adjusts based on what was eaten at breakfast
 */
export function calculateLunchTarget(ctx: MealAgentContext): { calories: number; protein: number } {
  const targetMilestone = SIZE_MULTIPLIERS.lunch[ctx.size] // 0.60, 0.66, or 0.75

  // Calculate how much more is needed to reach the milestone
  const targetCalories = Math.max(0,
    Math.round((ctx.dailyTargets.calories * targetMilestone) - ctx.currentIntake.calories)
  )
  const targetProtein = Math.max(0,
    Math.round((ctx.dailyTargets.protein * targetMilestone) - ctx.currentIntake.protein)
  )

  return { calories: targetCalories, protein: targetProtein }
}

/**
 * Generate the LLM prompt for lunch scoring
 */
function getLunchPrompt(
  meals: MealOption[],
  target: { calories: number; protein: number },
  ctx: MealAgentContext
): string {
  const mealsList = meals.slice(0, 25).map((m, i) =>
    `${i + 1}. [${m.id}] ${m.restaurantBrand} - ${m.title}: ${m.calories}cal, ${m.protein}g protein, ${m.carbs}g carbs, ${m.fat}g fat`
  ).join('\n')

  const currentCalPct = Math.round((ctx.currentIntake.calories / ctx.dailyTargets.calories) * 100)
  const currentProPct = Math.round((ctx.currentIntake.protein / ctx.dailyTargets.protein) * 100)
  const targetMilestone = Math.round(SIZE_MULTIPLIERS.lunch[ctx.size] * 100)

  const situationDescription = currentCalPct === 0
    ? "User skipped breakfast - lunch needs to make up for it"
    : currentCalPct > 40
      ? "User had a big breakfast - lunch should be moderate"
      : "User had a light breakfast - lunch should fill the gap"

  const sizeDescription = {
    light: 'lighter lunch (target 60% of daily goals by end of meal)',
    regular: 'balanced lunch (target 66% of daily goals by end of meal)',
    hearty: 'substantial lunch (target 75% of daily goals by end of meal)'
  }

  return `You are a nutrition coach helping with LUNCH selection.

CURRENT PROGRESS:
- Already eaten today: ${ctx.currentIntake.calories} cal (${currentCalPct}%), ${ctx.currentIntake.protein}g protein (${currentProPct}%)
- Daily targets: ${ctx.dailyTargets.calories} cal, ${ctx.dailyTargets.protein}g protein
- Situation: ${situationDescription}

GOAL: Reach ${targetMilestone}% of daily targets by end of lunch
- Target for THIS meal: ${target.calories} calories, ${target.protein}g protein
- This leaves room for dinner to close out the day

User preference: ${ctx.size} - ${sizeDescription[ctx.size]}

AVAILABLE MEALS:
${mealsList}

SCORING RULES:
1. Score 0-100 based on how well the meal helps reach the ${targetMilestone}% milestone
2. BOTH calories AND protein should hit the target for high scores (80+)
3. ${currentCalPct === 0 ? 'Since breakfast was skipped, prioritize larger balanced meals' : currentCalPct > 40 ? 'Since breakfast was substantial, prioritize lighter options' : 'Balance is key - fill the gap from breakfast'}
4. Meals that hit protein target but miss calories (or vice versa) should score 60-75
5. Consider afternoon energy needs - avoid meals that might cause energy crashes

IDEAL SCORING:
- 90-100: Hits BOTH calorie and protein targets within 10%
- 75-89: Both macros within 20% of target
- 60-74: One macro close, one moderately off
- 40-59: Both macros significantly off target
- Below 40: Very poor fit for lunch needs

Return ONLY valid JSON array (no markdown, no explanation):
[{"id":"meal_id","score":85,"reasoning":"Brief reason"},...]

Return the top 8 highest scoring meals, sorted by score descending.`
}

/**
 * Score lunch meals using LLM
 */
async function scoreLunchMealsWithLLM(
  meals: MealOption[],
  target: { calories: number; protein: number },
  ctx: MealAgentContext
): Promise<Array<{ id: string; score: number; reasoning: string }>> {
  if (!process.env.OPENAI_API_KEY || meals.length === 0) {
    return []
  }

  const prompt = getLunchPrompt(meals, target, ctx)

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
    console.error('Lunch LLM scoring error:', error)
    return []
  }
}

/**
 * Fallback algorithmic scoring for lunch
 */
function scoreLunchAlgorithmically(
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
      reasoning: `${Math.round(calRatio * 100)}% cal, ${Math.round(proRatio * 100)}% protein of lunch target`
    }
  }).sort((a, b) => b.score - a.score)
}

/**
 * Run the lunch agent
 */
export async function runLunchAgent(ctx: MealAgentContext): Promise<MealAgentResult> {
  const target = calculateLunchTarget(ctx)

  // Calculate progress
  const progressCalories = Math.round((ctx.currentIntake.calories / ctx.dailyTargets.calories) * 100)
  const progressProtein = Math.round((ctx.currentIntake.protein / ctx.dailyTargets.protein) * 100)

  // Target milestone after lunch
  const targetMilestone = SIZE_MULTIPLIERS.lunch[ctx.size]

  // Score meals with LLM
  let scores = await scoreLunchMealsWithLLM(ctx.availableMeals, target, ctx)

  // Fallback to algorithmic if LLM fails
  if (scores.length === 0) {
    scores = scoreLunchAlgorithmically(ctx.availableMeals, target)
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

  // Build contextual message
  let message: string
  if (progressCalories === 0) {
    message = `Skipped breakfast? Here are lunch options to catch up - targeting ${target.calories} cal and ${target.protein}g protein.`
  } else if (progressCalories > 40) {
    message = `You've had ${ctx.currentIntake.calories} cal so far. Here are lighter lunch options to stay on track.`
  } else {
    message = `At ${progressCalories}% of daily calories. Lunch targeting ${target.calories} cal and ${target.protein}g protein to reach ${Math.round(targetMilestone * 100)}%.`
  }

  return {
    suggestions: scoredMeals,
    targetForMeal: target,
    message,
    agentType: 'lunch',
    urgencyLevel: 'moderate',
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
