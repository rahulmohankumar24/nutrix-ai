/**
 * Evaluation script for meal scoring logic
 * Tests that the scoring algorithm prioritizes protein and calories correctly
 *
 * Run with: npx ts-node scripts/eval-meal-scoring.ts
 */

// Use require for ts-node compatibility
const { rateMealForTarget } = require('../src/lib/meal-rating')

interface ScoringScenario {
  name: string
  description: string
  meal: { calories: number; protein: number; carbs: number; fat: number }
  remaining: { calories: number; protein: number; carbs: number; fat: number }
  mealsRemaining: number
  targetCalories: number
  targetProtein: number
  expectedBehavior: {
    minScore: number
    maxScore: number
    shouldHaveBadge: boolean
    description: string
  }
}

const scoringScenarios: ScoringScenario[] = [
  // ==================== PERFECT MATCHES ====================
  {
    name: 'Perfect Match - Last Meal',
    description: 'Meal exactly matches remaining targets',
    meal: { calories: 800, protein: 70, carbs: 80, fat: 25 },
    remaining: { calories: 850, protein: 75, carbs: 90, fat: 30 },
    mealsRemaining: 1,
    targetCalories: 800,
    targetProtein: 70,
    expectedBehavior: {
      minScore: 85,
      maxScore: 100,
      shouldHaveBadge: true,
      description: 'Should score very high and get PERFECT MATCH badge'
    }
  },
  {
    name: 'Perfect Match - Multiple Meals Left',
    description: 'Meal matches per-meal target with meals remaining',
    meal: { calories: 600, protein: 50, carbs: 60, fat: 20 },
    remaining: { calories: 1200, protein: 100, carbs: 120, fat: 40 },
    mealsRemaining: 2,
    targetCalories: 600,
    targetProtein: 50,
    expectedBehavior: {
      minScore: 80,
      maxScore: 100,
      shouldHaveBadge: true,
      description: 'Should score high for matching per-meal target'
    }
  },

  // ==================== HIGH PROTEIN PRIORITY ====================
  {
    name: 'High Protein - Exceeds Target',
    description: 'Meal has more protein than target (should be rewarded)',
    meal: { calories: 700, protein: 80, carbs: 50, fat: 25 },
    remaining: { calories: 800, protein: 60, carbs: 80, fat: 30 },
    mealsRemaining: 1,
    targetCalories: 750,
    targetProtein: 55,
    expectedBehavior: {
      minScore: 75,
      maxScore: 100,
      shouldHaveBadge: true,
      description: 'Should score well - exceeding protein is good'
    }
  },
  {
    name: 'Low Protein - Below Target',
    description: 'Meal has less protein than needed (should be penalized)',
    meal: { calories: 700, protein: 25, carbs: 100, fat: 30 },
    remaining: { calories: 800, protein: 70, carbs: 80, fat: 30 },
    mealsRemaining: 1,
    targetCalories: 750,
    targetProtein: 65,
    expectedBehavior: {
      minScore: 35,
      maxScore: 55,
      shouldHaveBadge: false, // 38% protein = no badge
      description: 'Should score low - missing protein by 62% should heavily penalize'
    }
  },
  {
    name: 'Protein Efficiency Champion',
    description: 'High protein per calorie ratio',
    meal: { calories: 400, protein: 60, carbs: 20, fat: 10 },
    remaining: { calories: 500, protein: 65, carbs: 40, fat: 15 },
    mealsRemaining: 1,
    targetCalories: 450,
    targetProtein: 60,
    expectedBehavior: {
      minScore: 80,
      maxScore: 100,
      shouldHaveBadge: true,
      description: 'Should score very high - excellent protein efficiency'
    }
  },

  // ==================== CALORIE FIT ====================
  {
    name: 'Calories Too High',
    description: 'Meal exceeds target calories significantly',
    meal: { calories: 1200, protein: 60, carbs: 120, fat: 50 },
    remaining: { calories: 700, protein: 55, carbs: 70, fat: 25 },
    mealsRemaining: 1,
    targetCalories: 650,
    targetProtein: 50,
    expectedBehavior: {
      minScore: 60,
      maxScore: 85, // Last meal is more forgiving for going over
      shouldHaveBadge: true,
      description: 'Should score moderately - over calories but hits protein on last meal'
    }
  },
  {
    name: 'Calories Too Low',
    description: 'Meal is too small for the target',
    meal: { calories: 300, protein: 25, carbs: 30, fat: 10 },
    remaining: { calories: 900, protein: 70, carbs: 90, fat: 30 },
    mealsRemaining: 1,
    targetCalories: 850,
    targetProtein: 65,
    expectedBehavior: {
      minScore: 30,
      maxScore: 60,
      shouldHaveBadge: false,
      description: 'Should score lower - wont hit calorie target'
    }
  },

  // ==================== LAST MEAL SCENARIOS ====================
  {
    name: 'Last Meal - Hit Both Targets',
    description: 'Final meal that hits both calorie and protein targets',
    meal: { calories: 850, protein: 75, carbs: 80, fat: 30 },
    remaining: { calories: 900, protein: 80, carbs: 90, fat: 35 },
    mealsRemaining: 1,
    targetCalories: 855,
    targetProtein: 76,
    expectedBehavior: {
      minScore: 85,
      maxScore: 100,
      shouldHaveBadge: true,
      description: 'Should get highest score - hits targets on last meal'
    }
  },
  {
    name: 'Last Meal - Miss Protein',
    description: 'Final meal that hits calories but misses protein',
    meal: { calories: 800, protein: 35, carbs: 100, fat: 35 },
    remaining: { calories: 850, protein: 75, carbs: 90, fat: 30 },
    mealsRemaining: 1,
    targetCalories: 800,
    targetProtein: 70,
    expectedBehavior: {
      minScore: 50,
      maxScore: 70,
      shouldHaveBadge: true,
      description: 'Should score moderate - 50% protein caps the score even with perfect calories'
    }
  },

  // ==================== MULTIPLE MEALS REMAINING ====================
  {
    name: 'Two Meals Left - Balanced',
    description: 'Good balanced meal with dinner still ahead',
    meal: { calories: 600, protein: 45, carbs: 60, fat: 20 },
    remaining: { calories: 1400, protein: 100, carbs: 150, fat: 45 },
    mealsRemaining: 2,
    targetCalories: 700,
    targetProtein: 50,
    expectedBehavior: {
      minScore: 70,
      maxScore: 95,
      shouldHaveBadge: true,
      description: 'Should score well - leaves room for dinner'
    }
  },
  {
    name: 'Three Meals Left - Breakfast',
    description: 'Reasonable breakfast with full day ahead',
    meal: { calories: 450, protein: 35, carbs: 45, fat: 15 },
    remaining: { calories: 2200, protein: 160, carbs: 250, fat: 70 },
    mealsRemaining: 3,
    targetCalories: 660,
    targetProtein: 48,
    expectedBehavior: {
      minScore: 60,
      maxScore: 85,
      shouldHaveBadge: false,
      description: 'Should be okay - slightly under target but acceptable'
    }
  },

  // ==================== EDGE CASES ====================
  {
    name: 'Zero Calories Remaining',
    description: 'Already at calorie goal',
    meal: { calories: 500, protein: 40, carbs: 50, fat: 15 },
    remaining: { calories: 0, protein: 30, carbs: 0, fat: 0 },
    mealsRemaining: 1,
    targetCalories: 0,
    targetProtein: 25,
    expectedBehavior: {
      minScore: 0,
      maxScore: 50,
      shouldHaveBadge: false,
      description: 'Should score low - over calorie goal'
    }
  },
  {
    name: 'Very High Protein Need',
    description: 'User needs to catch up on protein',
    meal: { calories: 600, protein: 70, carbs: 30, fat: 20 },
    remaining: { calories: 700, protein: 90, carbs: 60, fat: 25 },
    mealsRemaining: 1,
    targetCalories: 665,
    targetProtein: 85,
    expectedBehavior: {
      minScore: 85,
      maxScore: 100,
      shouldHaveBadge: true,
      description: 'Should score high - good protein catch-up meal on last meal'
    }
  },
  // ==================== CALORIE PRIORITY SCENARIOS ====================
  {
    name: 'Hits Protein But Way Under Calories',
    description: 'Meal hits protein target but only 50% of calorie target - should be penalized',
    meal: { calories: 400, protein: 70, carbs: 30, fat: 10 },
    remaining: { calories: 850, protein: 75, carbs: 90, fat: 30 },
    mealsRemaining: 1,
    targetCalories: 800,
    targetProtein: 70,
    expectedBehavior: {
      minScore: 50,
      maxScore: 75,
      shouldHaveBadge: true,
      description: 'Should score lower - missing 400 calories on last meal is significant'
    }
  },
  {
    name: 'Hits Protein But 30% Under Calories',
    description: 'Last meal hits protein but leaves 30% calories on table',
    meal: { calories: 560, protein: 65, carbs: 50, fat: 20 },
    remaining: { calories: 850, protein: 70, carbs: 90, fat: 30 },
    mealsRemaining: 1,
    targetCalories: 800,
    targetProtein: 65,
    expectedBehavior: {
      minScore: 60,
      maxScore: 80,
      shouldHaveBadge: true,
      description: 'Should score moderate - 70% calories caps score even with perfect protein'
    }
  },
  {
    name: 'Perfect Calories But Low Protein',
    description: 'Hits calorie target exactly but only 60% protein',
    meal: { calories: 800, protein: 42, carbs: 90, fat: 30 },
    remaining: { calories: 850, protein: 75, carbs: 90, fat: 30 },
    mealsRemaining: 1,
    targetCalories: 800,
    targetProtein: 70,
    expectedBehavior: {
      minScore: 65,
      maxScore: 85,
      shouldHaveBadge: true,
      description: 'Should score similar to hitting protein but missing calories - both matter'
    }
  },
  {
    name: 'Both Slightly Under - Calories and Protein',
    description: 'Misses both targets by 20% - should be penalized',
    meal: { calories: 640, protein: 56, carbs: 70, fat: 22 },
    remaining: { calories: 850, protein: 75, carbs: 90, fat: 30 },
    mealsRemaining: 1,
    targetCalories: 800,
    targetProtein: 70,
    expectedBehavior: {
      minScore: 70,
      maxScore: 90,
      shouldHaveBadge: true,
      description: 'Should score decent - 80% of both targets is acceptable'
    }
  },
  {
    name: 'Lunch - Under Calories Leaves Too Little for Dinner',
    description: 'Lunch only uses 30% of remaining - dinner will need to be huge',
    meal: { calories: 400, protein: 40, carbs: 45, fat: 12 },
    remaining: { calories: 1400, protein: 100, carbs: 150, fat: 45 },
    mealsRemaining: 2,
    targetCalories: 700,
    targetProtein: 50,
    expectedBehavior: {
      minScore: 50,
      maxScore: 75,
      shouldHaveBadge: true,
      description: 'Should score lower - leaving 1000cal for dinner is unrealistic'
    }
  },
  {
    name: 'Last Meal - Hit 95% of Both Targets',
    description: 'Nearly perfect meal hitting both calorie and protein',
    meal: { calories: 760, protein: 67, carbs: 80, fat: 28 },
    remaining: { calories: 850, protein: 75, carbs: 90, fat: 30 },
    mealsRemaining: 1,
    targetCalories: 800,
    targetProtein: 70,
    expectedBehavior: {
      minScore: 90,
      maxScore: 100,
      shouldHaveBadge: true,
      description: 'Should score very high - hitting 95% of both is excellent'
    }
  },
  {
    name: 'Extreme Calorie Deficit - Only 25% of Target',
    description: 'Tiny meal when user needs substantial calories',
    meal: { calories: 200, protein: 20, carbs: 15, fat: 8 },
    remaining: { calories: 900, protein: 70, carbs: 100, fat: 30 },
    mealsRemaining: 1,
    targetCalories: 850,
    targetProtein: 65,
    expectedBehavior: {
      minScore: 20,
      maxScore: 45,
      shouldHaveBadge: false,
      description: 'Should score very low - leaving 700+ calories on table'
    }
  },
  {
    name: 'Good Protein Efficiency But Small Portion',
    description: 'High protein per calorie but total calories too low',
    meal: { calories: 350, protein: 55, carbs: 15, fat: 8 },
    remaining: { calories: 800, protein: 65, carbs: 80, fat: 25 },
    mealsRemaining: 1,
    targetCalories: 750,
    targetProtein: 60,
    expectedBehavior: {
      minScore: 45,
      maxScore: 70,
      shouldHaveBadge: true,
      description: 'Should penalize despite good protein - missing 400 calories matters'
    }
  },
]

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
}

function runScoringEval() {
  console.log('\n' + '='.repeat(70))
  console.log(`${colors.cyan}MEAL SCORING EVALUATION${colors.reset}`)
  console.log('='.repeat(70) + '\n')

  let passed = 0
  let failed = 0
  const failures: string[] = []

  for (const scenario of scoringScenarios) {
    console.log(`${colors.blue}Testing: ${scenario.name}${colors.reset}`)
    console.log(`${colors.dim}${scenario.description}${colors.reset}`)
    console.log(`  Meal: ${scenario.meal.calories}cal, ${scenario.meal.protein}g protein`)
    console.log(`  Target: ${scenario.targetCalories}cal, ${scenario.targetProtein}g protein`)
    console.log(`  Remaining: ${scenario.remaining.calories}cal, ${scenario.remaining.protein}g protein`)
    console.log(`  Meals left: ${scenario.mealsRemaining}`)

    // Run the rating function
    const result = rateMealForTarget(
      scenario.meal,
      scenario.remaining,
      scenario.mealsRemaining,
      scenario.targetCalories,
      scenario.targetProtein
    )

    console.log(`  Score: ${result.score}/100`)
    console.log(`  Badge: ${result.badge || 'none'}`)
    console.log(`  Reasoning: ${result.reasoning}`)
    console.log(`  Fits: Calories ${result.caloriesFit}%, Protein ${result.proteinFit}%`)

    // Check expectations
    const scorePass = result.score >= scenario.expectedBehavior.minScore &&
                      result.score <= scenario.expectedBehavior.maxScore
    const badgePass = scenario.expectedBehavior.shouldHaveBadge ? !!result.badge : true

    if (scorePass && badgePass) {
      console.log(`  ${colors.green}PASS${colors.reset} - ${scenario.expectedBehavior.description}`)
      passed++
    } else {
      console.log(`  ${colors.red}FAIL${colors.reset}`)
      if (!scorePass) {
        console.log(`    Expected score: ${scenario.expectedBehavior.minScore}-${scenario.expectedBehavior.maxScore}, got: ${result.score}`)
      }
      if (!badgePass) {
        console.log(`    Expected badge: ${scenario.expectedBehavior.shouldHaveBadge ? 'yes' : 'no'}, got: ${result.badge || 'none'}`)
      }
      failed++
      failures.push(scenario.name)
    }
    console.log('')
  }

  // Summary
  console.log('='.repeat(70))
  console.log(`${colors.cyan}SUMMARY${colors.reset}`)
  console.log('='.repeat(70))
  console.log(`Total: ${scoringScenarios.length} scenarios`)
  console.log(`${colors.green}Passed: ${passed}${colors.reset}`)
  console.log(`${colors.red}Failed: ${failed}${colors.reset}`)

  if (failures.length > 0) {
    console.log(`\n${colors.red}Failed scenarios:${colors.reset}`)
    failures.forEach(f => console.log(`  - ${f}`))
  }

  console.log('\n')

  return failed === 0
}

// Run evaluation
const success = runScoringEval()
process.exit(success ? 0 : 1)
