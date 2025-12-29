/**
 * Evaluation script for meal suggestions API
 * Tests the full API flow with different scenarios
 *
 * Run with: npx ts-node scripts/eval-meal-api.ts
 *
 * Note: Requires the dev server to be running on localhost:3000
 */

const BASE_URL = 'http://localhost:3000'

interface APITestScenario {
  name: string
  description: string
  endpoint: string
  method: 'GET' | 'POST'
  body?: any
  queryParams?: Record<string, string>
  expectedBehavior: {
    shouldReturnMeals: boolean
    minMeals?: number
    maxMeals?: number
    validateMeals?: (meals: any[]) => { pass: boolean; reason: string }
  }
}

// Mock user ID for testing
const TEST_USER_ID = 'test-eval-user'

const apiScenarios: APITestScenario[] = [
  // ==================== MEAL SUGGESTIONS API ====================
  {
    name: 'Breakfast Suggestions - Morning',
    description: 'Get breakfast suggestions at 8am',
    endpoint: '/api/meal-suggestions',
    method: 'GET',
    queryParams: {
      userId: TEST_USER_ID,
      size: 'regular',
      dining: 'takeout',
      travel: 'drive',
      currentHour: '8',
      timezone: 'America/Los_Angeles'
    },
    expectedBehavior: {
      shouldReturnMeals: true,
      minMeals: 1,
      validateMeals: (meals) => {
        // Breakfast meals should generally be lighter
        const avgCalories = meals.reduce((sum, m) => sum + m.calories, 0) / meals.length
        if (avgCalories > 800) {
          return { pass: false, reason: `Avg calories ${avgCalories} too high for breakfast` }
        }
        return { pass: true, reason: 'Breakfast portions appropriate' }
      }
    }
  },
  {
    name: 'Lunch Suggestions - Midday',
    description: 'Get lunch suggestions at 12pm',
    endpoint: '/api/meal-suggestions',
    method: 'GET',
    queryParams: {
      userId: TEST_USER_ID,
      size: 'regular',
      dining: 'takeout',
      travel: 'drive',
      currentHour: '12',
      timezone: 'America/Los_Angeles'
    },
    expectedBehavior: {
      shouldReturnMeals: true,
      minMeals: 1,
      validateMeals: (meals) => {
        // Lunch should have reasonable protein
        const avgProtein = meals.reduce((sum, m) => sum + m.protein, 0) / meals.length
        if (avgProtein < 20) {
          return { pass: false, reason: `Avg protein ${avgProtein}g too low for lunch` }
        }
        return { pass: true, reason: 'Lunch protein levels appropriate' }
      }
    }
  },
  {
    name: 'Dinner Suggestions - Evening',
    description: 'Get dinner suggestions at 7pm',
    endpoint: '/api/meal-suggestions',
    method: 'GET',
    queryParams: {
      userId: TEST_USER_ID,
      size: 'regular',
      dining: 'takeout',
      travel: 'drive',
      currentHour: '19',
      timezone: 'America/Los_Angeles'
    },
    expectedBehavior: {
      shouldReturnMeals: true,
      minMeals: 1,
      validateMeals: (meals) => {
        // Dinner should be substantial
        const avgCalories = meals.reduce((sum, m) => sum + m.calories, 0) / meals.length
        if (avgCalories < 400) {
          return { pass: false, reason: `Avg calories ${avgCalories} too low for dinner` }
        }
        return { pass: true, reason: 'Dinner portions appropriate' }
      }
    }
  },
  {
    name: 'Light Meal Size',
    description: 'Get light meal suggestions',
    endpoint: '/api/meal-suggestions',
    method: 'GET',
    queryParams: {
      userId: TEST_USER_ID,
      size: 'light',
      dining: 'takeout',
      travel: 'drive',
      currentHour: '12',
      timezone: 'America/Los_Angeles'
    },
    expectedBehavior: {
      shouldReturnMeals: true,
      minMeals: 1,
      validateMeals: (meals) => {
        const avgCalories = meals.reduce((sum, m) => sum + m.calories, 0) / meals.length
        if (avgCalories > 600) {
          return { pass: false, reason: `Avg calories ${avgCalories} too high for light meal` }
        }
        return { pass: true, reason: 'Light meal portions appropriate' }
      }
    }
  },
  {
    name: 'Hearty Meal Size',
    description: 'Get hearty meal suggestions',
    endpoint: '/api/meal-suggestions',
    method: 'GET',
    queryParams: {
      userId: TEST_USER_ID,
      size: 'hearty',
      dining: 'takeout',
      travel: 'drive',
      currentHour: '12',
      timezone: 'America/Los_Angeles'
    },
    expectedBehavior: {
      shouldReturnMeals: true,
      minMeals: 1,
      validateMeals: (meals) => {
        const avgCalories = meals.reduce((sum, m) => sum + m.calories, 0) / meals.length
        if (avgCalories < 500) {
          return { pass: false, reason: `Avg calories ${avgCalories} too low for hearty meal` }
        }
        return { pass: true, reason: 'Hearty meal portions appropriate' }
      }
    }
  },
  {
    name: 'Scheduled Breakfast (Planning Ahead)',
    description: 'Plan breakfast while its currently evening',
    endpoint: '/api/meal-suggestions',
    method: 'GET',
    queryParams: {
      userId: TEST_USER_ID,
      size: 'regular',
      dining: 'takeout',
      travel: 'drive',
      currentHour: '19', // Its evening
      scheduledMeal: 'breakfast', // But planning for breakfast
      timezone: 'America/Los_Angeles'
    },
    expectedBehavior: {
      shouldReturnMeals: true,
      minMeals: 1,
      validateMeals: (meals) => {
        // Should return breakfast-appropriate meals even though its evening
        const avgCalories = meals.reduce((sum, m) => sum + m.calories, 0) / meals.length
        if (avgCalories > 800) {
          return { pass: false, reason: `Scheduled breakfast avg calories ${avgCalories} too high` }
        }
        return { pass: true, reason: 'Scheduled breakfast portions appropriate' }
      }
    }
  },
  {
    name: 'Scheduled Dinner (Planning Ahead)',
    description: 'Plan dinner while its currently morning',
    endpoint: '/api/meal-suggestions',
    method: 'GET',
    queryParams: {
      userId: TEST_USER_ID,
      size: 'regular',
      dining: 'takeout',
      travel: 'drive',
      currentHour: '8', // Its morning
      scheduledMeal: 'dinner', // But planning for dinner
      timezone: 'America/Los_Angeles'
    },
    expectedBehavior: {
      shouldReturnMeals: true,
      minMeals: 1,
      validateMeals: (meals) => {
        // Should return dinner-appropriate meals
        const avgCalories = meals.reduce((sum, m) => sum + m.calories, 0) / meals.length
        if (avgCalories < 400) {
          return { pass: false, reason: `Scheduled dinner avg calories ${avgCalories} too low` }
        }
        return { pass: true, reason: 'Scheduled dinner portions appropriate' }
      }
    }
  },

  // ==================== AI UNIFIED MEAL COACH ====================
  {
    name: 'AI Coach - Chipotle Lunch',
    description: 'Get AI meal recommendations for Chipotle at lunch',
    endpoint: '/api/ai-unified-meal-coach',
    method: 'POST',
    body: {
      restaurantBrand: 'chipotle',
      userTargets: {
        targets: { calories: 2500, protein: 180, carbs: 300, fat: 80 },
        current: { calories: 600, protein: 40, carbs: 60, fat: 20 },
        remaining: { calories: 1900, protein: 140, carbs: 240, fat: 60 }
      },
      timeOfDay: 'lunch',
      currentHour: 12,
      useAI: true
    },
    expectedBehavior: {
      shouldReturnMeals: true,
      minMeals: 3,
      validateMeals: (meals) => {
        // Should have variety in options
        const uniqueCalories = new Set(meals.map(m => Math.round(m.calories / 100) * 100))
        if (uniqueCalories.size < 2) {
          return { pass: false, reason: 'Not enough variety in calorie levels' }
        }
        // Should prioritize protein
        const highProteinCount = meals.filter(m => m.protein >= 40).length
        if (highProteinCount < 1) {
          return { pass: false, reason: 'No high protein options (40g+)' }
        }
        return { pass: true, reason: 'Good variety with protein focus' }
      }
    }
  },
  {
    name: 'AI Coach - Dinner Last Meal',
    description: 'Get AI meal recommendations for last meal of day',
    endpoint: '/api/ai-unified-meal-coach',
    method: 'POST',
    body: {
      restaurantBrand: 'chipotle',
      userTargets: {
        targets: { calories: 2500, protein: 180, carbs: 300, fat: 80 },
        current: { calories: 1600, protein: 100, carbs: 180, fat: 50 },
        remaining: { calories: 900, protein: 80, carbs: 120, fat: 30 }
      },
      timeOfDay: 'dinner',
      currentHour: 19,
      useAI: true
    },
    expectedBehavior: {
      shouldReturnMeals: true,
      minMeals: 3,
      validateMeals: (meals) => {
        // Last meal should have options that hit remaining targets
        const mealsNearTarget = meals.filter(m =>
          m.calories >= 700 && m.calories <= 1100 &&
          m.protein >= 60
        )
        if (mealsNearTarget.length < 1) {
          return { pass: false, reason: 'No meals close to remaining targets (700-1100cal, 60g+ protein)' }
        }
        return { pass: true, reason: 'Has options to hit remaining targets' }
      }
    }
  },
  {
    name: 'AI Coach - Low Calories Remaining',
    description: 'Get recommendations when only 400 calories left',
    endpoint: '/api/ai-unified-meal-coach',
    method: 'POST',
    body: {
      restaurantBrand: 'chipotle',
      userTargets: {
        targets: { calories: 2000, protein: 150, carbs: 200, fat: 65 },
        current: { calories: 1600, protein: 90, carbs: 160, fat: 50 },
        remaining: { calories: 400, protein: 60, carbs: 40, fat: 15 }
      },
      timeOfDay: 'dinner',
      currentHour: 20,
      useAI: true
    },
    expectedBehavior: {
      shouldReturnMeals: true,
      minMeals: 1,
      validateMeals: (meals) => {
        // Should still return options, prioritizing protein
        const hasProteinFocused = meals.some(m => m.protein >= 30)
        if (!hasProteinFocused) {
          return { pass: false, reason: 'No protein-focused options for catching up' }
        }
        return { pass: true, reason: 'Has protein-focused options' }
      }
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

async function runAPITest(scenario: APITestScenario): Promise<{ pass: boolean; reason: string }> {
  try {
    let url = `${BASE_URL}${scenario.endpoint}`

    if (scenario.queryParams) {
      const params = new URLSearchParams(scenario.queryParams)
      url += `?${params.toString()}`
    }

    const options: RequestInit = {
      method: scenario.method,
      headers: { 'Content-Type': 'application/json' },
    }

    if (scenario.body) {
      options.body = JSON.stringify(scenario.body)
    }

    const response = await fetch(url, options)

    if (!response.ok) {
      return { pass: false, reason: `HTTP ${response.status}: ${response.statusText}` }
    }

    const data = await response.json()
    const meals = data.suggestions || data.meals || []

    if (scenario.expectedBehavior.shouldReturnMeals && meals.length === 0) {
      return { pass: false, reason: 'Expected meals but got none' }
    }

    if (scenario.expectedBehavior.minMeals && meals.length < scenario.expectedBehavior.minMeals) {
      return { pass: false, reason: `Expected at least ${scenario.expectedBehavior.minMeals} meals, got ${meals.length}` }
    }

    if (scenario.expectedBehavior.maxMeals && meals.length > scenario.expectedBehavior.maxMeals) {
      return { pass: false, reason: `Expected at most ${scenario.expectedBehavior.maxMeals} meals, got ${meals.length}` }
    }

    if (scenario.expectedBehavior.validateMeals && meals.length > 0) {
      return scenario.expectedBehavior.validateMeals(meals)
    }

    return { pass: true, reason: 'All checks passed' }
  } catch (error) {
    return { pass: false, reason: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }
  }
}

async function runAllTests() {
  console.log('\n' + '='.repeat(70))
  console.log(`${colors.cyan}MEAL SUGGESTIONS API EVALUATION${colors.reset}`)
  console.log('='.repeat(70))
  console.log(`${colors.dim}Testing against: ${BASE_URL}${colors.reset}\n`)

  let passed = 0
  let failed = 0
  const failures: string[] = []

  for (const scenario of apiScenarios) {
    console.log(`${colors.blue}Testing: ${scenario.name}${colors.reset}`)
    console.log(`${colors.dim}${scenario.description}${colors.reset}`)

    const result = await runAPITest(scenario)

    if (result.pass) {
      console.log(`  ${colors.green}PASS${colors.reset} - ${result.reason}`)
      passed++
    } else {
      console.log(`  ${colors.red}FAIL${colors.reset} - ${result.reason}`)
      failed++
      failures.push(scenario.name)
    }
    console.log('')
  }

  // Summary
  console.log('='.repeat(70))
  console.log(`${colors.cyan}SUMMARY${colors.reset}`)
  console.log('='.repeat(70))
  console.log(`Total: ${apiScenarios.length} scenarios`)
  console.log(`${colors.green}Passed: ${passed}${colors.reset}`)
  console.log(`${colors.red}Failed: ${failed}${colors.reset}`)

  if (failures.length > 0) {
    console.log(`\n${colors.red}Failed scenarios:${colors.reset}`)
    failures.forEach(f => console.log(`  - ${f}`))
  }

  console.log('\n')

  return failed === 0
}

// Check if server is running
async function checkServer(): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/api/health`, { method: 'GET' })
    return response.ok
  } catch {
    return false
  }
}

async function main() {
  console.log(`${colors.yellow}Checking if server is running...${colors.reset}`)

  const serverUp = await checkServer()
  if (!serverUp) {
    console.log(`${colors.red}Server not running at ${BASE_URL}${colors.reset}`)
    console.log(`Please start the dev server with: npm run dev`)
    process.exit(1)
  }

  console.log(`${colors.green}Server is running!${colors.reset}\n`)

  const success = await runAllTests()
  process.exit(success ? 0 : 1)
}

main()
