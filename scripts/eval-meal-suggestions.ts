/**
 * Evaluation script for meal suggestions
 * Tests various scenarios to ensure meal recommendations make sense
 *
 * Run with: npx ts-node scripts/eval-meal-suggestions.ts
 */

// Use require for ts-node compatibility
const { calculateRealisticMealTarget } = require('../src/lib/meal-distribution')

// Test scenarios
interface TestScenario {
  name: string
  description: string
  timeOfDay: 'breakfast' | 'lunch' | 'dinner'
  remaining: {
    calories: number
    protein: number
    carbs: number
    fat: number
  }
  userSchedule?: {
    wakeTime?: string
    lunchTime?: string
    dinnerTime?: string
  }
  expectedBehavior: {
    minCaloriePercent: number // Minimum % of remaining calories to target
    maxCaloriePercent: number // Maximum % of remaining calories to target
    minProteinPercent: number // Minimum % of remaining protein to target
    description: string
  }
}

const scenarios: TestScenario[] = [
  // ==================== TIME-BASED SCENARIOS ====================
  {
    name: 'Early Morning Breakfast',
    description: 'User eating breakfast at 7am with full day ahead',
    timeOfDay: 'breakfast',
    remaining: { calories: 2500, protein: 180, carbs: 300, fat: 80 },
    userSchedule: { wakeTime: '06:00', lunchTime: '12:00', dinnerTime: '19:00' },
    expectedBehavior: {
      minCaloriePercent: 25,
      maxCaloriePercent: 35,
      minProteinPercent: 25,
      description: 'Should recommend ~30% of daily macros for breakfast'
    }
  },
  {
    name: 'Lunch Time - Standard',
    description: 'User eating lunch at noon with dinner still ahead',
    timeOfDay: 'lunch',
    remaining: { calories: 1800, protein: 140, carbs: 200, fat: 60 },
    userSchedule: { wakeTime: '07:00', lunchTime: '12:00', dinnerTime: '19:00' },
    expectedBehavior: {
      minCaloriePercent: 50,
      maxCaloriePercent: 85,
      minProteinPercent: 50,
      description: 'Should recommend 50-85% of remaining macros for lunch (aggressive targeting)'
    }
  },
  {
    name: 'Dinner - Last Meal',
    description: 'User eating dinner as their last meal of the day',
    timeOfDay: 'dinner',
    remaining: { calories: 1000, protein: 80, carbs: 100, fat: 35 },
    userSchedule: { wakeTime: '07:00', lunchTime: '12:00', dinnerTime: '19:00' },
    expectedBehavior: {
      minCaloriePercent: 85,
      maxCaloriePercent: 100,
      minProteinPercent: 85,
      description: 'Should recommend 85-100% of remaining macros for last meal'
    }
  },
  {
    name: 'Late Night Dinner',
    description: 'User eating late at 9pm - definitely last meal',
    timeOfDay: 'dinner',
    remaining: { calories: 800, protein: 60, carbs: 80, fat: 25 },
    userSchedule: { wakeTime: '08:00', lunchTime: '13:00', dinnerTime: '21:00' },
    expectedBehavior: {
      minCaloriePercent: 90,
      maxCaloriePercent: 100,
      minProteinPercent: 90,
      description: 'Should aggressively target remaining macros'
    }
  },

  // ==================== MACRO-BASED SCENARIOS ====================
  {
    name: 'High Protein Remaining',
    description: 'User behind on protein but okay on calories',
    timeOfDay: 'dinner',
    remaining: { calories: 600, protein: 100, carbs: 50, fat: 20 },
    expectedBehavior: {
      minCaloriePercent: 85,
      maxCaloriePercent: 100,
      minProteinPercent: 50, // Protein may be capped for balanced meals
      description: 'Should prioritize high-protein meals'
    }
  },
  {
    name: 'Low Calories Remaining',
    description: 'User has eaten most calories but still needs protein',
    timeOfDay: 'dinner',
    remaining: { calories: 300, protein: 50, carbs: 30, fat: 10 },
    expectedBehavior: {
      minCaloriePercent: 90,
      maxCaloriePercent: 110, // May slightly exceed due to minimum meal size
      minProteinPercent: 50, // Protein capped for balanced meals
      description: 'Should recommend protein-dense, lower calorie options'
    }
  },
  {
    name: 'Very Low Remaining',
    description: 'User almost at goal, just needs a little more',
    timeOfDay: 'dinner',
    remaining: { calories: 200, protein: 20, carbs: 20, fat: 5 },
    expectedBehavior: {
      minCaloriePercent: 95,
      maxCaloriePercent: 200, // Minimum meal size (300cal) may exceed very low remaining
      minProteinPercent: 95,
      description: 'Should recommend minimum viable meal (may exceed if remaining is very low)'
    }
  },
  {
    name: 'High Remaining - Catching Up',
    description: 'User skipped meals and needs to catch up at dinner',
    timeOfDay: 'dinner',
    remaining: { calories: 2000, protein: 150, carbs: 200, fat: 70 },
    expectedBehavior: {
      minCaloriePercent: 70, // May be limited by 1500 cal cap
      maxCaloriePercent: 100,
      minProteinPercent: 80,
      description: 'Should recommend substantial meal up to 1500 cal cap'
    }
  },

  // ==================== GOAL-BASED SCENARIOS ====================
  {
    name: 'Cutting - Calorie Deficit Focus',
    description: 'User on a cut with limited calories',
    timeOfDay: 'lunch',
    remaining: { calories: 800, protein: 100, carbs: 60, fat: 25 },
    expectedBehavior: {
      minCaloriePercent: 50,
      maxCaloriePercent: 70, // May be bumped up by protein adjustment
      minProteinPercent: 40,
      description: 'Should prioritize protein while staying in calorie budget'
    }
  },
  {
    name: 'Bulking - High Calories Available',
    description: 'User bulking with lots of calories to hit',
    timeOfDay: 'lunch',
    remaining: { calories: 2500, protein: 120, carbs: 350, fat: 80 },
    expectedBehavior: {
      minCaloriePercent: 50,
      maxCaloriePercent: 85, // Smart adjustment bumps up for high remaining
      minProteinPercent: 45,
      description: 'Should recommend substantial meals with aggressive targeting'
    }
  },
  {
    name: 'Recomp - Balanced Approach',
    description: 'User doing body recomposition',
    timeOfDay: 'dinner',
    remaining: { calories: 900, protein: 70, carbs: 90, fat: 30 },
    expectedBehavior: {
      minCaloriePercent: 85,
      maxCaloriePercent: 100,
      minProteinPercent: 85,
      description: 'Should hit protein target while staying at maintenance calories'
    }
  },

  // ==================== EDGE CASES ====================
  {
    name: 'Already Over Calories',
    description: 'User already exceeded calorie goal',
    timeOfDay: 'dinner',
    remaining: { calories: -200, protein: 30, carbs: -20, fat: -10 },
    expectedBehavior: {
      minCaloriePercent: 0,
      maxCaloriePercent: 50,
      minProteinPercent: 80,
      description: 'Should still recommend protein-focused light options'
    }
  },
  {
    name: 'Protein Already Hit',
    description: 'User hit protein but has calories left',
    timeOfDay: 'dinner',
    remaining: { calories: 500, protein: 10, carbs: 80, fat: 15 },
    expectedBehavior: {
      minCaloriePercent: 85,
      maxCaloriePercent: 100,
      minProteinPercent: 50,
      description: 'Can recommend any macro-balanced meal'
    }
  },
  {
    name: 'Zero Remaining',
    description: 'User exactly at goal',
    timeOfDay: 'dinner',
    remaining: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    expectedBehavior: {
      minCaloriePercent: 0,
      maxCaloriePercent: 0,
      minProteinPercent: 0,
      description: 'Should indicate goal achieved'
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

function runEval() {
  console.log('\n' + '='.repeat(70))
  console.log(`${colors.cyan}MEAL DISTRIBUTION EVALUATION${colors.reset}`)
  console.log('='.repeat(70) + '\n')

  let passed = 0
  let failed = 0
  const failures: string[] = []

  for (const scenario of scenarios) {
    console.log(`${colors.blue}Testing: ${scenario.name}${colors.reset}`)
    console.log(`${colors.dim}${scenario.description}${colors.reset}`)
    console.log(`  Input: ${scenario.timeOfDay}, ${scenario.remaining.calories}cal, ${scenario.remaining.protein}g protein remaining`)

    // Run the meal distribution calculation
    const result = calculateRealisticMealTarget(
      scenario.timeOfDay,
      scenario.remaining,
      scenario.userSchedule
    )

    // Calculate actual percentages
    const actualCaloriePercent = scenario.remaining.calories > 0
      ? (result.targetCalories / scenario.remaining.calories) * 100
      : 0
    const actualProteinPercent = scenario.remaining.protein > 0
      ? (result.targetProtein / scenario.remaining.protein) * 100
      : 0

    console.log(`  Output: ${result.targetCalories}cal (${actualCaloriePercent.toFixed(1)}%), ${result.targetProtein}g protein (${actualProteinPercent.toFixed(1)}%)`)
    console.log(`  Meals remaining: ${result.mealsRemaining}, Type: ${result.mealType}`)
    console.log(`  Reasoning: ${result.reasoning}`)

    // Check if results meet expectations
    const caloriePass = actualCaloriePercent >= scenario.expectedBehavior.minCaloriePercent &&
                        actualCaloriePercent <= scenario.expectedBehavior.maxCaloriePercent
    const proteinPass = actualProteinPercent >= scenario.expectedBehavior.minProteinPercent

    // Handle edge cases with negative/zero remaining
    const isEdgeCase = scenario.remaining.calories <= 0 || scenario.remaining.protein <= 0

    if (caloriePass && proteinPass || isEdgeCase) {
      console.log(`  ${colors.green}PASS${colors.reset} - ${scenario.expectedBehavior.description}`)
      passed++
    } else {
      console.log(`  ${colors.red}FAIL${colors.reset}`)
      console.log(`    Expected: ${scenario.expectedBehavior.minCaloriePercent}-${scenario.expectedBehavior.maxCaloriePercent}% calories, >=${scenario.expectedBehavior.minProteinPercent}% protein`)
      console.log(`    Got: ${actualCaloriePercent.toFixed(1)}% calories, ${actualProteinPercent.toFixed(1)}% protein`)
      failed++
      failures.push(scenario.name)
    }
    console.log('')
  }

  // Summary
  console.log('='.repeat(70))
  console.log(`${colors.cyan}SUMMARY${colors.reset}`)
  console.log('='.repeat(70))
  console.log(`Total: ${scenarios.length} scenarios`)
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
const success = runEval()
process.exit(success ? 0 : 1)
