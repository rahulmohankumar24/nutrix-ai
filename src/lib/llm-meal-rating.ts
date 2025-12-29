/**
 * LLM-based meal rating system
 * Uses GPT-4o to evaluate meals holistically, requiring BOTH
 * protein AND calories to be close to targets for high scores
 */

import OpenAI from 'openai'

interface MealMacros {
  calories: number
  protein: number
  carbs: number
  fat: number
}

interface RemainingMacros {
  calories: number
  protein: number
  carbs: number
  fat: number
}

interface LLMMealRating {
  score: number // 0-100
  badge: 'PERFECT MATCH' | 'HIGHLY RECOMMENDED' | 'GOOD FIT' | 'OKAY' | null
  reasoning: string
  caloriesFit: number // 0-100
  proteinFit: number // 0-100
  overallFit: number // 0-100
}

interface LLMBatchRatingResult {
  ratings: Array<{
    mealIndex: number
    score: number
    reasoning: string
    caloriesFit: number
    proteinFit: number
  }>
  topRecommendation: number
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * Rate a single meal using LLM
 */
export async function rateMealWithLLM(
  meal: MealMacros,
  remaining: RemainingMacros,
  mealsRemaining: number,
  targetCaloriesPerMeal: number,
  targetProteinPerMeal: number
): Promise<LLMMealRating> {
  if (!process.env.OPENAI_API_KEY) {
    // Fallback to basic algorithmic scoring if no API key
    return fallbackRating(meal, targetCaloriesPerMeal, targetProteinPerMeal)
  }

  const prompt = `You are a nutrition scoring expert. Score this meal on how well it fits the user's targets.

CRITICAL RULE: A meal can ONLY score 85+ if it hits BOTH calories AND protein targets (within 15% of each).
Missing either target significantly should cap the score.

MEAL:
- Calories: ${meal.calories}
- Protein: ${meal.protein}g
- Carbs: ${meal.carbs}g
- Fat: ${meal.fat}g

TARGETS FOR THIS MEAL:
- Target Calories: ${targetCaloriesPerMeal}
- Target Protein: ${targetProteinPerMeal}g

CONTEXT:
- Remaining daily: ${remaining.calories}cal, ${remaining.protein}g protein
- Meals left today: ${mealsRemaining}
- This is ${mealsRemaining === 1 ? 'the LAST meal of the day - hitting targets is critical!' : `one of ${mealsRemaining} meals remaining`}

SCORING GUIDE:
- 90-100: Hits BOTH calories (85-115%) AND protein (85%+) targets
- 75-89: Hits one target well, other is 70-85% of target
- 60-74: Moderate fit - one or both targets 50-70%
- 40-59: Poor fit - significantly under on calories OR protein
- 0-39: Very poor - way under on both or extremely unbalanced

For LAST MEAL: Be STRICT about hitting calorie targets. Leaving 200+ calories on the table should significantly reduce score.

Return ONLY JSON:
{
  "score": 75,
  "reasoning": "Brief 1-sentence explanation",
  "caloriesFit": 80,
  "proteinFit": 95
}`

  try {
    const completion = await openai.responses.create({
      model: "gpt-5.2",
      input: prompt
    })

    const response = completion.output_text
    if (!response) {
      return fallbackRating(meal, targetCaloriesPerMeal, targetProteinPerMeal)
    }

    const parsed = JSON.parse(response)
    const score = Math.max(0, Math.min(100, parsed.score))

    return {
      score,
      badge: getBadge(score),
      reasoning: parsed.reasoning || 'AI-scored meal',
      caloriesFit: parsed.caloriesFit || 0,
      proteinFit: parsed.proteinFit || 0,
      overallFit: score
    }
  } catch (error) {
    console.error('LLM meal rating error:', error)
    return fallbackRating(meal, targetCaloriesPerMeal, targetProteinPerMeal)
  }
}

/**
 * Rate multiple meals in a single LLM call (more efficient)
 */
export async function rateMealsBatchWithLLM(
  meals: Array<{ meal: MealMacros; name?: string }>,
  remaining: RemainingMacros,
  mealsRemaining: number,
  targetCaloriesPerMeal: number,
  targetProteinPerMeal: number
): Promise<LLMBatchRatingResult> {
  if (!process.env.OPENAI_API_KEY || meals.length === 0) {
    return {
      ratings: meals.map((_, i) => ({
        mealIndex: i,
        score: 50,
        reasoning: 'No LLM available',
        caloriesFit: 50,
        proteinFit: 50
      })),
      topRecommendation: 0
    }
  }

  const mealsList = meals.map((m, i) =>
    `${i + 1}. ${m.name || 'Meal'}: ${m.meal.calories}cal, ${m.meal.protein}g protein, ${m.meal.carbs}g carbs, ${m.meal.fat}g fat`
  ).join('\n')

  const prompt = `You are a nutrition scoring expert. Score these meals on how well they fit the user's targets.

CRITICAL RULE: A meal can ONLY score 85+ if it hits BOTH calories AND protein targets (within 15% of each).
Missing EITHER target should cap the score. Both matter equally.

MEALS TO SCORE:
${mealsList}

TARGETS FOR THIS MEAL:
- Target Calories: ${targetCaloriesPerMeal}
- Target Protein: ${targetProteinPerMeal}g

CONTEXT:
- Remaining daily: ${remaining.calories}cal, ${remaining.protein}g protein
- Meals left today: ${mealsRemaining}
- ${mealsRemaining === 1 ? 'LAST MEAL - hitting BOTH calorie AND protein targets is critical!' : `${mealsRemaining} meals remaining`}

SCORING GUIDE (apply strictly):
- 90-100: BOTH calories 85-115% AND protein 85%+ of targets
- 75-89: One target hit well, other is 70-85%
- 60-74: Moderate fit - one or both at 50-70%
- 40-59: Poor - significantly under calories OR protein
- 0-39: Very poor - way under on both

IMPORTANT: Meals that hit protein but are 30%+ under calories should NOT score above 75.
Meals that hit calories but are 30%+ under protein should NOT score above 75.

Return ONLY JSON:
{
  "ratings": [
    {"mealIndex": 0, "score": 85, "reasoning": "Hits both targets well", "caloriesFit": 90, "proteinFit": 88},
    {"mealIndex": 1, "score": 65, "reasoning": "Good protein but 35% under calories", "caloriesFit": 65, "proteinFit": 95}
  ],
  "topRecommendation": 0
}`

  try {
    const completion = await openai.responses.create({
      model: "gpt-5.2",
      input: prompt
    })

    const response = completion.output_text
    if (!response) {
      throw new Error('No response')
    }

    return JSON.parse(response)
  } catch (error) {
    console.error('LLM batch rating error:', error)
    // Return basic fallback
    return {
      ratings: meals.map((m, i) => {
        const calFit = Math.min(100, (m.meal.calories / targetCaloriesPerMeal) * 100)
        const proFit = Math.min(100, (m.meal.protein / targetProteinPerMeal) * 100)
        const score = Math.round((calFit + proFit) / 2)
        return {
          mealIndex: i,
          score,
          reasoning: 'Algorithmic fallback',
          caloriesFit: Math.round(calFit),
          proteinFit: Math.round(proFit)
        }
      }),
      topRecommendation: 0
    }
  }
}

function getBadge(score: number): LLMMealRating['badge'] {
  if (score >= 85) return 'PERFECT MATCH'
  if (score >= 75) return 'HIGHLY RECOMMENDED'
  if (score >= 65) return 'GOOD FIT'
  if (score >= 55) return 'OKAY'
  return null
}

function fallbackRating(
  meal: MealMacros,
  targetCalories: number,
  targetProtein: number
): LLMMealRating {
  // Simple algorithmic fallback that requires BOTH to be close
  const caloriePct = targetCalories > 0 ? meal.calories / targetCalories : 0
  const proteinPct = targetProtein > 0 ? meal.protein / targetProtein : 0

  const caloriesFit = Math.max(0, 100 - Math.abs(1 - caloriePct) * 100)
  const proteinFit = Math.max(0, 100 - Math.abs(1 - proteinPct) * 80)

  // BOTH must be good for high score
  const minFit = Math.min(caloriesFit, proteinFit)
  const avgFit = (caloriesFit + proteinFit) / 2

  // Score is weighted toward the worse of the two
  const score = Math.round(minFit * 0.6 + avgFit * 0.4)

  let reasoning = ''
  if (score >= 85) {
    reasoning = `Hits both targets - ${meal.calories}cal and ${meal.protein}g protein`
  } else if (caloriesFit < proteinFit - 20) {
    reasoning = `Good protein but under on calories (${Math.round(caloriePct * 100)}% of target)`
  } else if (proteinFit < caloriesFit - 20) {
    reasoning = `Good calories but under on protein (${Math.round(proteinPct * 100)}% of target)`
  } else {
    reasoning = `Moderate fit - ${Math.round(caloriePct * 100)}% calories, ${Math.round(proteinPct * 100)}% protein`
  }

  return {
    score,
    badge: getBadge(score),
    reasoning,
    caloriesFit: Math.round(caloriesFit),
    proteinFit: Math.round(proteinFit),
    overallFit: score
  }
}
