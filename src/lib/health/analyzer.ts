// Core health analysis and scoring logic

import { INGREDIENT_FLAGS, getSeverityWeight, getAllFlagPatterns, SeverityLevel, IngredientFlag } from './ingredient-flags'
import { findChainIngredients, isCleanerRestaurant } from './chain-ingredients'

export interface FlaggedIngredient {
  name: string
  category: string
  severity: SeverityLevel
  displayName: string
  description: string
  foundInMeals: string[]
  occurrences: number
}

// Nutritional health insights
export interface NutritionInsight {
  category: 'positive' | 'warning' | 'info'
  title: string
  description: string
  icon: string
}

// Keywords for detecting healthy food categories
const FRUIT_KEYWORDS = ['apple', 'banana', 'orange', 'berry', 'berries', 'strawberry', 'blueberry', 'grape', 'mango', 'pineapple', 'watermelon', 'peach', 'pear', 'kiwi', 'fruit', 'smoothie', 'acai']
const VEGGIE_KEYWORDS = ['salad', 'spinach', 'kale', 'broccoli', 'carrot', 'tomato', 'lettuce', 'cucumber', 'pepper', 'onion', 'mushroom', 'zucchini', 'asparagus', 'cauliflower', 'cabbage', 'greens', 'vegetable', 'veggie', 'arugula', 'mixed greens']
const FIBER_KEYWORDS = ['oatmeal', 'oats', 'beans', 'lentils', 'quinoa', 'brown rice', 'whole grain', 'whole wheat', 'fiber', 'chia', 'flax', 'avocado', 'sweet potato', 'chickpea', 'hummus']
const PROTEIN_KEYWORDS = ['chicken', 'beef', 'fish', 'salmon', 'tuna', 'shrimp', 'egg', 'tofu', 'tempeh', 'turkey', 'steak', 'protein', 'greek yogurt', 'cottage cheese']
const PROBIOTIC_KEYWORDS = ['yogurt', 'kefir', 'kimchi', 'sauerkraut', 'kombucha', 'miso', 'tempeh', 'pickles', 'fermented', 'probiotic', 'greek yogurt', 'skyr']
const PROCESSED_KEYWORDS = ['fried', 'fries', 'chips', 'soda', 'candy', 'cookie', 'cake', 'donut', 'pastry', 'ice cream', 'nuggets', 'hot dog', 'bacon', 'sausage']

// Vitamin and mineral keywords
const VITAMIN_C_KEYWORDS = ['orange', 'lemon', 'lime', 'grapefruit', 'citrus', 'strawberry', 'kiwi', 'bell pepper', 'pepper', 'broccoli', 'tomato', 'papaya', 'guava']
const VITAMIN_D_KEYWORDS = ['salmon', 'tuna', 'mackerel', 'sardine', 'egg', 'mushroom', 'fortified milk', 'fortified cereal']
const VITAMIN_A_KEYWORDS = ['carrot', 'sweet potato', 'spinach', 'kale', 'butternut', 'squash', 'mango', 'cantaloupe', 'apricot', 'liver']
const IRON_KEYWORDS = ['beef', 'steak', 'liver', 'spinach', 'lentils', 'beans', 'tofu', 'chickpea', 'quinoa', 'dark chocolate', 'pumpkin seeds']
const CALCIUM_KEYWORDS = ['milk', 'cheese', 'yogurt', 'kale', 'broccoli', 'almonds', 'sardine', 'tofu', 'fortified', 'cottage cheese']
const OMEGA3_KEYWORDS = ['salmon', 'mackerel', 'sardine', 'tuna', 'trout', 'herring', 'walnuts', 'flaxseed', 'chia', 'hemp seeds', 'fish oil']
const ANTIOXIDANT_KEYWORDS = ['blueberry', 'berry', 'berries', 'dark chocolate', 'green tea', 'matcha', 'spinach', 'kale', 'beet', 'pomegranate', 'acai', 'goji', 'artichoke']
const POTASSIUM_KEYWORDS = ['banana', 'potato', 'sweet potato', 'avocado', 'spinach', 'coconut water', 'beans', 'lentils', 'salmon', 'yogurt']
const MAGNESIUM_KEYWORDS = ['almonds', 'spinach', 'cashews', 'peanuts', 'avocado', 'dark chocolate', 'quinoa', 'black beans', 'edamame', 'pumpkin seeds']
const ZINC_KEYWORDS = ['beef', 'oyster', 'crab', 'lobster', 'pork', 'chicken', 'beans', 'nuts', 'seeds', 'cheese', 'oats']
const B_VITAMIN_KEYWORDS = ['whole grain', 'egg', 'chicken', 'beef', 'salmon', 'tuna', 'spinach', 'avocado', 'lentils', 'nutritional yeast', 'fortified cereal']
const HYDRATION_KEYWORDS = ['water', 'coconut water', 'herbal tea', 'green tea', 'cucumber', 'watermelon', 'celery', 'lettuce', 'soup', 'broth']

// Nutrient tracking result
export interface NutrientTracking {
  hasFruits: boolean
  hasVeggies: boolean
  hasFiber: boolean
  hasProtein: boolean
  hasProbiotics: boolean
  hasProcessed: boolean
  hasVitaminC: boolean
  hasVitaminD: boolean
  hasVitaminA: boolean
  hasIron: boolean
  hasCalcium: boolean
  hasOmega3: boolean
  hasAntioxidants: boolean
  hasPotassium: boolean
  hasMagnesium: boolean
  hasZinc: boolean
  hasBVitamins: boolean
  hasHydration: boolean
  fruitVeggieCount: number
  nutrientScore: number
}

// Analyze nutritional aspects of meals
export function analyzeNutrition(meals: Array<{ name: string; calories: number; protein: number; carbs: number; fat: number }>): {
  insights: NutritionInsight[]
  hasFruits: boolean
  hasVeggies: boolean
  hasFiber: boolean
  hasProtein: boolean
  hasProbiotics: boolean
  hasProcessed: boolean
  hasVitaminC: boolean
  hasVitaminD: boolean
  hasVitaminA: boolean
  hasIron: boolean
  hasCalcium: boolean
  hasOmega3: boolean
  hasAntioxidants: boolean
  hasPotassium: boolean
  hasMagnesium: boolean
  hasZinc: boolean
  hasBVitamins: boolean
  hasHydration: boolean
  fruitVeggieCount: number
  nutrientScore: number
} {
  const allMealText = meals.map(m => m.name.toLowerCase()).join(' ')

  // Basic categories
  const hasFruits = FRUIT_KEYWORDS.some(kw => allMealText.includes(kw))
  const hasVeggies = VEGGIE_KEYWORDS.some(kw => allMealText.includes(kw))
  const hasFiber = FIBER_KEYWORDS.some(kw => allMealText.includes(kw))
  const hasProtein = PROTEIN_KEYWORDS.some(kw => allMealText.includes(kw))
  const hasProbiotics = PROBIOTIC_KEYWORDS.some(kw => allMealText.includes(kw))
  const hasProcessed = PROCESSED_KEYWORDS.some(kw => allMealText.includes(kw))

  // Vitamins and minerals
  const hasVitaminC = VITAMIN_C_KEYWORDS.some(kw => allMealText.includes(kw))
  const hasVitaminD = VITAMIN_D_KEYWORDS.some(kw => allMealText.includes(kw))
  const hasVitaminA = VITAMIN_A_KEYWORDS.some(kw => allMealText.includes(kw))
  const hasIron = IRON_KEYWORDS.some(kw => allMealText.includes(kw))
  const hasCalcium = CALCIUM_KEYWORDS.some(kw => allMealText.includes(kw))
  const hasOmega3 = OMEGA3_KEYWORDS.some(kw => allMealText.includes(kw))
  const hasAntioxidants = ANTIOXIDANT_KEYWORDS.some(kw => allMealText.includes(kw))
  const hasPotassium = POTASSIUM_KEYWORDS.some(kw => allMealText.includes(kw))
  const hasMagnesium = MAGNESIUM_KEYWORDS.some(kw => allMealText.includes(kw))
  const hasZinc = ZINC_KEYWORDS.some(kw => allMealText.includes(kw))
  const hasBVitamins = B_VITAMIN_KEYWORDS.some(kw => allMealText.includes(kw))
  const hasHydration = HYDRATION_KEYWORDS.some(kw => allMealText.includes(kw))

  // Count fruit/veggie servings (rough estimate)
  let fruitVeggieCount = 0
  for (const meal of meals) {
    const mealLower = meal.name.toLowerCase()
    if (FRUIT_KEYWORDS.some(kw => mealLower.includes(kw))) fruitVeggieCount++
    if (VEGGIE_KEYWORDS.some(kw => mealLower.includes(kw))) fruitVeggieCount++
  }

  // Calculate nutrient score (0-100 based on variety)
  const nutrientChecks = [
    hasFruits, hasVeggies, hasFiber, hasProtein, hasProbiotics,
    hasVitaminC, hasVitaminD, hasVitaminA, hasIron, hasCalcium,
    hasOmega3, hasAntioxidants, hasPotassium, hasMagnesium, hasZinc, hasBVitamins
  ]
  const nutrientScore = Math.round((nutrientChecks.filter(Boolean).length / nutrientChecks.length) * 100)

  const insights: NutritionInsight[] = []

  // Positive insights - Basic nutrition
  if (hasFruits && hasVeggies) {
    insights.push({
      category: 'positive',
      title: 'Great variety',
      description: 'You had both fruits and vegetables today',
      icon: '🥗'
    })
  } else if (hasFruits || hasVeggies) {
    insights.push({
      category: 'positive',
      title: hasFruits ? 'Fruit intake' : 'Veggie intake',
      description: `Good job including ${hasFruits ? 'fruits' : 'vegetables'} today`,
      icon: hasFruits ? '🍎' : '🥬'
    })
  }

  if (hasFiber) {
    insights.push({
      category: 'positive',
      title: 'Fiber boost',
      description: 'Your meals include fiber-rich foods',
      icon: '🌾'
    })
  }

  if (hasProtein) {
    insights.push({
      category: 'positive',
      title: 'Protein covered',
      description: 'You\'re hitting your protein sources',
      icon: '💪'
    })
  }

  if (hasProbiotics) {
    insights.push({
      category: 'positive',
      title: 'Gut health',
      description: 'Probiotics support your digestive system',
      icon: '🦠'
    })
  }

  // Vitamin insights
  if (hasVitaminC) {
    insights.push({
      category: 'positive',
      title: 'Vitamin C',
      description: 'Immune support from citrus or peppers',
      icon: '🍊'
    })
  }

  if (hasVitaminD) {
    insights.push({
      category: 'positive',
      title: 'Vitamin D',
      description: 'Good for bones and immune function',
      icon: '☀️'
    })
  }

  if (hasVitaminA) {
    insights.push({
      category: 'positive',
      title: 'Vitamin A',
      description: 'Supports vision and skin health',
      icon: '🥕'
    })
  }

  // Mineral insights
  if (hasIron) {
    insights.push({
      category: 'positive',
      title: 'Iron intake',
      description: 'Essential for energy and oxygen transport',
      icon: '🩸'
    })
  }

  if (hasCalcium) {
    insights.push({
      category: 'positive',
      title: 'Calcium',
      description: 'Building strong bones and teeth',
      icon: '🦴'
    })
  }

  if (hasOmega3) {
    insights.push({
      category: 'positive',
      title: 'Omega-3s',
      description: 'Heart and brain healthy fats',
      icon: '🐟'
    })
  }

  if (hasAntioxidants) {
    insights.push({
      category: 'positive',
      title: 'Antioxidants',
      description: 'Fighting oxidative stress',
      icon: '🫐'
    })
  }

  if (hasMagnesium) {
    insights.push({
      category: 'positive',
      title: 'Magnesium',
      description: 'Supports muscle and nerve function',
      icon: '✨'
    })
  }

  if (hasPotassium) {
    insights.push({
      category: 'positive',
      title: 'Potassium',
      description: 'Helps regulate blood pressure',
      icon: '🍌'
    })
  }

  if (hasZinc) {
    insights.push({
      category: 'positive',
      title: 'Zinc',
      description: 'Immune support and wound healing',
      icon: '🛡️'
    })
  }

  if (hasBVitamins) {
    insights.push({
      category: 'positive',
      title: 'B Vitamins',
      description: 'Energy metabolism support',
      icon: '⚡'
    })
  }

  // Warning insights
  if (!hasFruits && !hasVeggies) {
    insights.push({
      category: 'warning',
      title: 'Missing greens',
      description: 'Try adding some fruits or vegetables',
      icon: '🥗'
    })
  }

  if (!hasVitaminC && !hasVitaminA && meals.length >= 2) {
    insights.push({
      category: 'warning',
      title: 'Low vitamins',
      description: 'Add citrus, peppers, or carrots for vitamins',
      icon: '💊'
    })
  }

  if (!hasOmega3 && meals.length >= 3) {
    insights.push({
      category: 'info',
      title: 'No omega-3s today',
      description: 'Consider salmon, walnuts, or chia seeds',
      icon: '🐟'
    })
  }

  if (!hasCalcium && meals.length >= 2) {
    insights.push({
      category: 'info',
      title: 'Calcium opportunity',
      description: 'Dairy, leafy greens, or fortified foods help',
      icon: '🦴'
    })
  }

  if (!hasIron && meals.length >= 3) {
    insights.push({
      category: 'info',
      title: 'Iron check',
      description: 'Red meat, spinach, or beans boost iron',
      icon: '🩸'
    })
  }

  if (hasProcessed) {
    insights.push({
      category: 'info',
      title: 'Processed foods',
      description: 'Consider whole food alternatives when possible',
      icon: '🍟'
    })
  }

  // Calculate total protein from meals
  const totalProtein = meals.reduce((sum, m) => sum + m.protein, 0)
  if (totalProtein < 30 && meals.length >= 2) {
    insights.push({
      category: 'warning',
      title: 'Low protein so far',
      description: `Only ${totalProtein}g protein logged - aim higher`,
      icon: '🥩'
    })
  }

  return {
    insights,
    hasFruits,
    hasVeggies,
    hasFiber,
    hasProtein,
    hasProbiotics,
    hasProcessed,
    hasVitaminC,
    hasVitaminD,
    hasVitaminA,
    hasIron,
    hasCalcium,
    hasOmega3,
    hasAntioxidants,
    hasPotassium,
    hasMagnesium,
    hasZinc,
    hasBVitamins,
    hasHydration,
    fruitVeggieCount,
    nutrientScore
  }
}

export interface MealAnalysis {
  mealName: string
  restaurantBrand: string
  healthScore: number
  flaggedIngredients: {
    ingredient: string
    category: string
    severity: SeverityLevel
  }[]
  ingredientsAnalyzed: boolean
}

export interface HealthAnalysisResult {
  overallScore: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  mealsAnalyzed: number
  mealsWithData: number
  flaggedIngredients: FlaggedIngredient[]
  topConcerns: {
    title: string
    description: string
    frequency: string
    severity: SeverityLevel
  }[]
  restaurantBreakdown: {
    restaurant: string
    avgScore: number
    mealCount: number
    cleanestOption: string | null
    concerningOptions: string[]
  }[]
  mealAnalyses: MealAnalysis[]
}

// Analyze a list of ingredients for flagged items
export function analyzeIngredients(ingredients: string[]): {
  flags: { ingredient: string; category: string; severity: SeverityLevel; displayName: string }[]
  score: number
} {
  const allPatterns = getAllFlagPatterns()
  const foundFlags: { ingredient: string; category: string; severity: SeverityLevel; displayName: string }[] = []
  const seenCategories = new Set<string>()

  const ingredientText = ingredients.join(' ').toLowerCase()

  for (const { pattern, flagKey, flag } of allPatterns) {
    if (ingredientText.includes(pattern)) {
      // Only count once per category per analysis
      if (!seenCategories.has(flag.category)) {
        foundFlags.push({
          ingredient: pattern,
          category: flag.category,
          severity: flag.severity,
          displayName: flag.displayName
        })
        seenCategories.add(flag.category)
      }
    }
  }

  // Calculate score: start at 100, subtract based on severity
  let score = 100
  for (const flag of foundFlags) {
    score -= getSeverityWeight(flag.severity)
  }

  return {
    flags: foundFlags,
    score: Math.max(0, Math.min(100, score))
  }
}

// Analyze a single meal
export function analyzeMeal(
  mealName: string,
  restaurantBrand: string,
  description?: string
): MealAnalysis {
  // Try to find chain ingredient data
  const chainData = findChainIngredients(restaurantBrand, mealName)

  if (chainData) {
    const { flags, score } = analyzeIngredients(chainData.ingredients)
    return {
      mealName,
      restaurantBrand,
      healthScore: score,
      flaggedIngredients: flags.map(f => ({
        ingredient: f.ingredient,
        category: f.category,
        severity: f.severity
      })),
      ingredientsAnalyzed: true
    }
  }

  // If no chain data, try to analyze from description or give benefit of doubt
  if (description) {
    const words = description.toLowerCase().split(/[\s,]+/)
    const { flags, score } = analyzeIngredients(words)

    return {
      mealName,
      restaurantBrand,
      healthScore: score,
      flaggedIngredients: flags.map(f => ({
        ingredient: f.ingredient,
        category: f.category,
        severity: f.severity
      })),
      ingredientsAnalyzed: true
    }
  }

  // No data available - give neutral score
  // Cleaner restaurants get benefit of the doubt
  const isClean = isCleanerRestaurant(restaurantBrand)
  return {
    mealName,
    restaurantBrand,
    healthScore: isClean ? 85 : 70,
    flaggedIngredients: [],
    ingredientsAnalyzed: false
  }
}

// Convert score to letter grade
export function scoreToGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 85) return 'A'
  if (score >= 70) return 'B'
  if (score >= 55) return 'C'
  if (score >= 40) return 'D'
  return 'F'
}

// Calculate overall health analysis from meal logs
export function calculateHealthAnalysis(
  mealLogs: Array<{
    id: string
    mealName: string
    restaurantBrand: string
    description?: string
    datetime: Date
  }>
): HealthAnalysisResult {
  if (mealLogs.length === 0) {
    return {
      overallScore: 100,
      grade: 'A',
      mealsAnalyzed: 0,
      mealsWithData: 0,
      flaggedIngredients: [],
      topConcerns: [],
      restaurantBreakdown: [],
      mealAnalyses: []
    }
  }

  // Analyze each meal
  const mealAnalyses: MealAnalysis[] = mealLogs.map(meal =>
    analyzeMeal(meal.mealName, meal.restaurantBrand, meal.description)
  )

  // Aggregate flagged ingredients
  const ingredientMap = new Map<string, FlaggedIngredient>()

  for (const analysis of mealAnalyses) {
    for (const flag of analysis.flaggedIngredients) {
      const key = `${flag.category}-${flag.ingredient}`
      const existing = ingredientMap.get(key)

      if (existing) {
        existing.occurrences++
        if (!existing.foundInMeals.includes(analysis.mealName)) {
          existing.foundInMeals.push(analysis.mealName)
        }
      } else {
        const flagData = Object.values(INGREDIENT_FLAGS).find(f => f.category === flag.category)
        ingredientMap.set(key, {
          name: flag.ingredient,
          category: flag.category,
          severity: flag.severity,
          displayName: flagData?.displayName || flag.category,
          description: flagData?.description || '',
          foundInMeals: [analysis.mealName],
          occurrences: 1
        })
      }
    }
  }

  const flaggedIngredients = Array.from(ingredientMap.values())
    .sort((a, b) => {
      // Sort by severity first, then by occurrences
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return severityOrder[a.severity] - severityOrder[b.severity]
      }
      return b.occurrences - a.occurrences
    })

  // Calculate top concerns
  const categoryOccurrences = new Map<string, { count: number; severity: SeverityLevel; description: string }>()
  for (const flag of flaggedIngredients) {
    const existing = categoryOccurrences.get(flag.category)
    if (existing) {
      existing.count += flag.occurrences
    } else {
      categoryOccurrences.set(flag.category, {
        count: flag.occurrences,
        severity: flag.severity,
        description: flag.description
      })
    }
  }

  const topConcerns = Array.from(categoryOccurrences.entries())
    .sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
      if (severityOrder[a[1].severity] !== severityOrder[b[1].severity]) {
        return severityOrder[a[1].severity] - severityOrder[b[1].severity]
      }
      return b[1].count - a[1].count
    })
    .slice(0, 5)
    .map(([category, data]) => ({
      title: category,
      description: data.description,
      frequency: `Found in ${data.count} meal${data.count > 1 ? 's' : ''} this month`,
      severity: data.severity
    }))

  // Restaurant breakdown
  const restaurantMap = new Map<string, {
    scores: number[]
    meals: Array<{ name: string; score: number }>
  }>()

  for (const analysis of mealAnalyses) {
    const existing = restaurantMap.get(analysis.restaurantBrand)
    if (existing) {
      existing.scores.push(analysis.healthScore)
      existing.meals.push({ name: analysis.mealName, score: analysis.healthScore })
    } else {
      restaurantMap.set(analysis.restaurantBrand, {
        scores: [analysis.healthScore],
        meals: [{ name: analysis.mealName, score: analysis.healthScore }]
      })
    }
  }

  const restaurantBreakdown = Array.from(restaurantMap.entries())
    .map(([restaurant, data]) => {
      const avgScore = Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length)
      const sortedMeals = [...data.meals].sort((a, b) => b.score - a.score)

      return {
        restaurant,
        avgScore,
        mealCount: data.meals.length,
        cleanestOption: sortedMeals[0]?.name || null,
        concerningOptions: sortedMeals.filter(m => m.score < 60).map(m => m.name)
      }
    })
    .sort((a, b) => b.mealCount - a.mealCount)

  // Calculate overall score with recency bias
  const now = Date.now()
  let totalWeight = 0
  let weightedScore = 0

  for (let i = 0; i < mealAnalyses.length; i++) {
    const meal = mealLogs[i]
    const analysis = mealAnalyses[i]

    // More recent meals have higher weight (exponential decay over 30 days)
    const daysAgo = (now - meal.datetime.getTime()) / (1000 * 60 * 60 * 24)
    const weight = Math.exp(-daysAgo / 15) // Half-life of ~10 days

    weightedScore += analysis.healthScore * weight
    totalWeight += weight
  }

  const overallScore = Math.round(totalWeight > 0 ? weightedScore / totalWeight : 100)
  const mealsWithData = mealAnalyses.filter(a => a.ingredientsAnalyzed).length

  return {
    overallScore,
    grade: scoreToGrade(overallScore),
    mealsAnalyzed: mealLogs.length,
    mealsWithData,
    flaggedIngredients,
    topConcerns,
    restaurantBreakdown,
    mealAnalyses
  }
}

// Generate grade color classes
export function getGradeColor(grade: 'A' | 'B' | 'C' | 'D' | 'F'): {
  text: string
  bg: string
  border: string
} {
  switch (grade) {
    case 'A':
      return { text: 'text-green-600', bg: 'bg-green-500/10', border: 'border-green-500/30' }
    case 'B':
      return { text: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500/30' }
    case 'C':
      return { text: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/30' }
    case 'D':
      return { text: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/30' }
    case 'F':
      return { text: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/30' }
  }
}

// Get severity color classes
export function getSeverityColor(severity: SeverityLevel): {
  text: string
  bg: string
  icon: string
} {
  switch (severity) {
    case 'critical':
      return { text: 'text-red-600', bg: 'bg-red-500/10', icon: 'text-red-500' }
    case 'high':
      return { text: 'text-orange-500', bg: 'bg-orange-500/10', icon: 'text-orange-500' }
    case 'medium':
      return { text: 'text-amber-500', bg: 'bg-amber-500/10', icon: 'text-amber-500' }
    case 'low':
      return { text: 'text-yellow-500', bg: 'bg-yellow-500/10', icon: 'text-yellow-500' }
  }
}
