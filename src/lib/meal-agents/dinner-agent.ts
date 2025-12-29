import OpenAI from 'openai'
import {
  MealAgentContext,
  MealAgentResult,
  MealOption,
  ScoredMeal,
  UrgencyLevel,
  SIZE_MULTIPLIERS,
  DINNER_URGENCY_THRESHOLDS
} from './types'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

/**
 * Determine dinner urgency level based on current hour
 */
export function getDinnerUrgency(hour: number): { level: UrgencyLevel; remainingPct: number } {
  // Late night (12 AM - 5 AM) - critical
  if (hour >= 0 && hour < 5) {
    return { level: 'critical', remainingPct: DINNER_URGENCY_THRESHOLDS.lateNight.pct }
  }
  // Late evening (10 PM - 12 AM) - critical
  if (hour >= 22) {
    return { level: 'critical', remainingPct: DINNER_URGENCY_THRESHOLDS.late.pct }
  }
  // Mid evening (8 PM - 10 PM) - high
  if (hour >= 20) {
    return { level: 'high', remainingPct: DINNER_URGENCY_THRESHOLDS.mid.pct }
  }
  // Early dinner (4 PM - 8 PM) - moderate
  return { level: 'moderate', remainingPct: DINNER_URGENCY_THRESHOLDS.early.pct }
}

/**
 * Calculate dinner target - aggressive to hit remaining goals
 */
export function calculateDinnerTarget(ctx: MealAgentContext): { calories: number; protein: number } {
  const { remainingPct } = getDinnerUrgency(ctx.currentHour)

  // Apply size adjustments
  const sizeAdjust = SIZE_MULTIPLIERS.dinner[ctx.size]
  const adjustedPct = Math.min(1.10, remainingPct + sizeAdjust)

  return {
    calories: Math.round(ctx.remaining.calories * adjustedPct),
    protein: Math.round(ctx.remaining.protein * adjustedPct)
  }
}

/**
 * Generate the LLM prompt for dinner scoring
 */
function getDinnerPrompt(
  meals: MealOption[],
  target: { calories: number; protein: number },
  ctx: MealAgentContext,
  urgency: { level: UrgencyLevel; remainingPct: number }
): string {
  const mealsList = meals.slice(0, 25).map((m, i) =>
    `${i + 1}. [${m.id}] ${m.restaurantBrand} - ${m.title}: ${m.calories}cal, ${m.protein}g protein, ${m.carbs}g carbs, ${m.fat}g fat`
  ).join('\n')

  const progressCalories = Math.round((ctx.currentIntake.calories / ctx.dailyTargets.calories) * 100)
  const progressProtein = Math.round((ctx.currentIntake.protein / ctx.dailyTargets.protein) * 100)

  const urgencyDescriptions = {
    moderate: 'Dinner time - aim to get close to targets',
    high: 'Getting late - prioritize hitting targets',
    critical: 'LAST CHANCE - must hit remaining targets tonight',
    low: 'Early dinner - flexible timing'
  }

  const sizeDescription = {
    light: 'lighter dinner (cap at 85% of remaining)',
    regular: 'balanced dinner (95% of remaining)',
    hearty: 'substantial dinner (100%+ of remaining, slight overage OK)'
  }

  return `You are a nutrition coach helping with DINNER selection.

URGENCY: ${urgency.level.toUpperCase()} (${ctx.currentHour}:00)
${urgencyDescriptions[urgency.level]}

CURRENT STATUS:
- Eaten today: ${ctx.currentIntake.calories} cal (${progressCalories}%), ${ctx.currentIntake.protein}g protein (${progressProtein}%)
- Remaining: ${ctx.remaining.calories} cal, ${ctx.remaining.protein}g protein
- Daily targets: ${ctx.dailyTargets.calories} cal, ${ctx.dailyTargets.protein}g protein

GOAL: ${urgency.level === 'critical' ? 'MUST' : 'Should'} hit remaining targets
- Target for dinner: ${target.calories} calories, ${target.protein}g protein

User preference: ${ctx.size} - ${sizeDescription[ctx.size]}

AVAILABLE MEALS:
${mealsList}

CRITICAL SCORING RULES:
1. Score 0-100 based on how well the meal hits the dinner target
2. BOTH calories AND protein MUST be close for high scores (80+)
3. ${urgency.level === 'critical' ? 'This is the LAST meal of the day - prioritize hitting BOTH targets' : 'Balance hitting targets with reasonable portions'}
4. Meals leaving significant macros on the table should score LOW
5. High-protein meals are preferred when protein gap is large
6. A meal hitting protein but missing calories should NOT score above 75
7. A meal hitting calories but missing protein should NOT score above 75

URGENCY-BASED THRESHOLDS:
${urgency.level === 'critical' ? `
- CRITICAL: Meals MUST hit 90-110% of BOTH targets to score 85+
- Meals missing either target by >15% should score below 70
- This is non-negotiable - the day ends soon` :
urgency.level === 'high' ? `
- HIGH: Meals should hit 85-110% of both targets for score 80+
- Some flexibility but prioritize completeness` :
`- MODERATE: Aim for 80-105% of targets
- Room for adjustment with snacks/dessert if needed`}

Return ONLY valid JSON array (no markdown, no explanation):
[{"id":"meal_id","score":85,"reasoning":"Brief reason"},...]

Return the top 8 highest scoring meals, sorted by score descending.`
}

/**
 * Score dinner meals using LLM
 */
async function scoreDinnerMealsWithLLM(
  meals: MealOption[],
  target: { calories: number; protein: number },
  ctx: MealAgentContext,
  urgency: { level: UrgencyLevel; remainingPct: number }
): Promise<Array<{ id: string; score: number; reasoning: string }>> {
  if (!process.env.OPENAI_API_KEY || meals.length === 0) {
    return []
  }

  const prompt = getDinnerPrompt(meals, target, ctx, urgency)

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
    console.error('Dinner LLM scoring error:', error)
    return []
  }
}

/**
 * Fallback algorithmic scoring for dinner
 * More aggressive about hitting BOTH targets
 */
function scoreDinnerAlgorithmically(
  meals: MealOption[],
  target: { calories: number; protein: number },
  urgency: UrgencyLevel
): Array<{ id: string; score: number; reasoning: string }> {
  return meals.map(meal => {
    const calRatio = target.calories > 0 ? meal.calories / target.calories : 0
    const proRatio = target.protein > 0 ? meal.protein / target.protein : 0

    // Calculate how close each macro is to target (1.0 = perfect)
    const calFit = 1 - Math.abs(1 - calRatio)
    const proFit = 1 - Math.abs(1 - proRatio)

    // For dinner, BOTH macros must be good - use minimum as penalty
    const minFit = Math.min(calFit, proFit)
    const avgFit = (calFit + proFit) / 2

    // Weight towards minimum more heavily for critical urgency
    const urgencyWeight = urgency === 'critical' ? 0.7 : urgency === 'high' ? 0.6 : 0.5
    const combinedFit = (minFit * urgencyWeight) + (avgFit * (1 - urgencyWeight))

    const score = Math.round(Math.max(0, Math.min(100, combinedFit * 100)))

    return {
      id: meal.id,
      score,
      reasoning: `${Math.round(calRatio * 100)}% cal, ${Math.round(proRatio * 100)}% protein of dinner target`
    }
  }).sort((a, b) => b.score - a.score)
}

/**
 * Run the dinner agent
 */
export async function runDinnerAgent(ctx: MealAgentContext): Promise<MealAgentResult> {
  const urgency = getDinnerUrgency(ctx.currentHour)
  const target = calculateDinnerTarget(ctx)

  // Calculate progress
  const progressCalories = Math.round((ctx.currentIntake.calories / ctx.dailyTargets.calories) * 100)
  const progressProtein = Math.round((ctx.currentIntake.protein / ctx.dailyTargets.protein) * 100)

  // Score meals with LLM
  let scores = await scoreDinnerMealsWithLLM(ctx.availableMeals, target, ctx, urgency)

  // Fallback to algorithmic if LLM fails
  if (scores.length === 0) {
    scores = scoreDinnerAlgorithmically(ctx.availableMeals, target, urgency.level)
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

  // Build contextual message based on urgency
  let message: string
  switch (urgency.level) {
    case 'critical':
      message = `Last chance! You need ${ctx.remaining.calories} cal and ${ctx.remaining.protein}g protein to hit your targets.`
      break
    case 'high':
      message = `Getting late - aim for ${target.calories} cal and ${target.protein}g protein to close out the day strong.`
      break
    default:
      message = `Dinner time! Target ${target.calories} cal and ${target.protein}g protein (${Math.round(urgency.remainingPct * 100)}% of remaining).`
  }

  return {
    suggestions: scoredMeals,
    targetForMeal: target,
    message,
    agentType: 'dinner',
    urgencyLevel: urgency.level,
    progressToGoal: {
      caloriesPct: progressCalories,
      proteinPct: progressProtein
    },
    mealMilestone: {
      current: progressCalories / 100,
      target: 1.0 // Dinner aims for 100%
    }
  }
}
