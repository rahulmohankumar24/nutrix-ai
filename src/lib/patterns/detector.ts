import { prisma } from '@/lib/prisma'

// Types for pattern detection
interface MealLogWithDetails {
  id: string
  userId: string
  datetime: Date
  mealType: string | null
  servings: number
  orderTemplate: {
    restaurantBrand: string
    calories: number
    protein: number
    carbs: number
    fat: number
  } | null
  foodCatalogItem: {
    name: string
    source: string
    calories: number
    protein: number
    carbs: number
    fat: number
  } | null
}

interface DayData {
  date: string
  dayOfWeek: number
  dayName: string
  isWeekend: boolean
  calories: number
  protein: number
  carbs: number
  fat: number
  caloriesTarget: number
  proteinTarget: number
  mealCount: number
  hadBreakfast: boolean
  hadLunch: boolean
  hadDinner: boolean
  restaurantMeals: number
  homeMeals: number
  restaurants: string[]
}

interface DetectedPattern {
  patternType: 'timing' | 'restaurant' | 'success' | 'recovery'
  patternKey: string
  patternValue: Record<string, unknown>
  confidence: number
  occurrences: number
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Helper to get date string in local timezone
function getLocalDateStr(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Helper to get hour and minute from date
function getTimeMinutes(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

// Calculate average of numbers
function average(nums: number[]): number {
  if (nums.length === 0) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

// Calculate standard deviation
function stdDev(nums: number[], avg: number): number {
  if (nums.length === 0) return 0
  const squareDiffs = nums.map(n => Math.pow(n - avg, 2))
  return Math.sqrt(average(squareDiffs))
}

// Normalize restaurant name for consistent keys
function normalizeRestaurantName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '_')
}

/**
 * Main function to analyze all patterns for a user
 */
export async function analyzeUserPatterns(userId: string, minDays: number = 7) {
  // Fetch last 90 days of meal logs
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  const mealLogs = await prisma.mealLog.findMany({
    where: {
      userId,
      datetime: { gte: ninetyDaysAgo }
    },
    include: {
      orderTemplate: true,
      foodCatalogItem: true
    },
    orderBy: { datetime: 'asc' }
  }) as MealLogWithDetails[]

  // Fetch user profile for targets
  const profile = await prisma.profile.findUnique({
    where: { userId }
  })

  if (!profile) {
    return { patternsDetected: 0, message: 'No profile found' }
  }

  // Calculate default targets
  const weightKg = (profile.weightLb || 150) / 2.205
  const heightCm = (profile.heightIn || 70) * 2.54
  const age = profile.age || 25

  const bmr = profile.sex === 'male'
    ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
    : 10 * weightKg + 6.25 * heightCm - 5 * age - 161

  const activityMultiplier = profile.stepsLevel === 'high' ? 1.55 : profile.stepsLevel === 'med' ? 1.375 : 1.2
  const liftingBonus = (profile.liftingDays || 0) * 50

  let tdee = Math.round(bmr * activityMultiplier + liftingBonus)
  if (profile.goal === 'cut') tdee -= 500
  else if (profile.goal === 'lean_bulk') tdee += 300

  const targetCalories = tdee > 0 ? tdee : 2000
  const targetProtein = Math.round((profile.weightLb || 150) * 0.8)

  // Group meals by day and calculate daily stats
  const dayDataMap = new Map<string, DayData>()

  for (const log of mealLogs) {
    const dateStr = getLocalDateStr(new Date(log.datetime))
    const dayOfWeek = new Date(log.datetime).getDay()

    let dayData = dayDataMap.get(dateStr)
    if (!dayData) {
      dayData = {
        date: dateStr,
        dayOfWeek,
        dayName: DAY_NAMES[dayOfWeek],
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        caloriesTarget: targetCalories,
        proteinTarget: targetProtein,
        mealCount: 0,
        hadBreakfast: false,
        hadLunch: false,
        hadDinner: false,
        restaurantMeals: 0,
        homeMeals: 0,
        restaurants: []
      }
      dayDataMap.set(dateStr, dayData)
    }

    const item = log.orderTemplate || log.foodCatalogItem
    if (item) {
      const servings = log.servings || 1
      dayData.calories += Math.round(item.calories * servings)
      dayData.protein += Math.round(item.protein * servings)
      dayData.carbs += Math.round(item.carbs * servings)
      dayData.fat += Math.round(item.fat * servings)
    }

    dayData.mealCount++

    if (log.mealType === 'breakfast') dayData.hadBreakfast = true
    if (log.mealType === 'lunch') dayData.hadLunch = true
    if (log.mealType === 'dinner') dayData.hadDinner = true

    if (log.orderTemplate) {
      dayData.restaurantMeals++
      if (!dayData.restaurants.includes(log.orderTemplate.restaurantBrand)) {
        dayData.restaurants.push(log.orderTemplate.restaurantBrand)
      }
    } else if (log.foodCatalogItem?.source === 'home') {
      dayData.homeMeals++
    }
  }

  const dayDataArray = Array.from(dayDataMap.values())

  // Check minimum data requirement
  if (dayDataArray.length < minDays) {
    return {
      patternsDetected: 0,
      daysAnalyzed: dayDataArray.length,
      message: `Need at least ${minDays} days of data. Currently have ${dayDataArray.length} days.`
    }
  }

  // Detect all pattern types
  const patterns: DetectedPattern[] = [
    ...detectTimingPatterns(mealLogs, profile),
    ...detectRestaurantPatterns(dayDataArray, mealLogs),
    ...detectSuccessPatterns(dayDataArray),
    ...detectRecoveryPatterns(dayDataArray)
  ]

  // Upsert patterns to database
  for (const pattern of patterns) {
    await prisma.userPattern.upsert({
      where: {
        userId_patternType_patternKey: {
          userId,
          patternType: pattern.patternType,
          patternKey: pattern.patternKey
        }
      },
      update: {
        patternValue: pattern.patternValue as object,
        confidence: pattern.confidence,
        occurrences: pattern.occurrences,
        lastUpdated: new Date()
      },
      create: {
        userId,
        patternType: pattern.patternType,
        patternKey: pattern.patternKey,
        patternValue: pattern.patternValue as object,
        confidence: pattern.confidence,
        occurrences: pattern.occurrences
      }
    })
  }

  return {
    patternsDetected: patterns.length,
    daysAnalyzed: dayDataArray.length,
    patterns: patterns.map(p => ({ type: p.patternType, key: p.patternKey }))
  }
}

/**
 * Detect timing patterns - when user eats relative to their stated preferences
 */
function detectTimingPatterns(
  mealLogs: MealLogWithDetails[],
  profile: { wakeTime: string; lunchTime: string; dinnerTime: string }
): DetectedPattern[] {
  const patterns: DetectedPattern[] = []

  // Group by meal type and weekday/weekend
  const mealTimes: Record<string, number[]> = {
    weekday_breakfast: [],
    weekday_lunch: [],
    weekday_dinner: [],
    weekend_breakfast: [],
    weekend_lunch: [],
    weekend_dinner: []
  }

  for (const log of mealLogs) {
    if (!log.mealType) continue
    const date = new Date(log.datetime)
    const dayOfWeek = date.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    const prefix = isWeekend ? 'weekend' : 'weekday'
    const key = `${prefix}_${log.mealType}`

    if (mealTimes[key]) {
      mealTimes[key].push(getTimeMinutes(date))
    }
  }

  // Parse profile times to minutes
  const parseTime = (time: string): number => {
    const [h, m] = time.split(':').map(Number)
    return h * 60 + (m || 0)
  }

  const expectedTimes: Record<string, number> = {
    breakfast: parseTime(profile.wakeTime) + 60, // 1 hour after wake
    lunch: parseTime(profile.lunchTime),
    dinner: parseTime(profile.dinnerTime)
  }

  // Analyze each meal type
  for (const [key, times] of Object.entries(mealTimes)) {
    if (times.length < 3) continue // Need minimum samples

    const avgTime = average(times)
    const deviation = stdDev(times, avgTime)
    const mealType = key.split('_')[1]
    const expected = expectedTimes[mealType]

    if (!expected) continue

    const timeDiff = avgTime - expected

    // Only create pattern if there's a notable deviation (>30 min) or high consistency
    if (Math.abs(timeDiff) > 30 || deviation < 30) {
      patterns.push({
        patternType: 'timing',
        patternKey: key,
        patternValue: {
          avgTimeMinutes: Math.round(avgTime),
          avgTimeFormatted: `${Math.floor(avgTime / 60)}:${String(Math.round(avgTime % 60)).padStart(2, '0')}`,
          expectedTimeMinutes: expected,
          deviationFromExpected: Math.round(timeDiff),
          consistencyStdDev: Math.round(deviation),
          isConsistent: deviation < 45,
          isLate: timeDiff > 30,
          isEarly: timeDiff < -30
        },
        confidence: Math.min(times.length / 15, 1),
        occurrences: times.length
      })
    }
  }

  return patterns
}

/**
 * Detect restaurant patterns - favorite spots, day preferences, success correlation
 */
function detectRestaurantPatterns(
  dayDataArray: DayData[],
  mealLogs: MealLogWithDetails[]
): DetectedPattern[] {
  const patterns: DetectedPattern[] = []

  // Count restaurant visits
  const restaurantStats: Record<string, {
    visits: number
    dayDistribution: Record<number, number>
    successDays: number
    totalDays: number
    avgCalories: number[]
    avgProtein: number[]
  }> = {}

  // Group meal logs by restaurant
  for (const log of mealLogs) {
    if (!log.orderTemplate) continue
    const restaurant = log.orderTemplate.restaurantBrand
    const key = normalizeRestaurantName(restaurant)

    if (!restaurantStats[key]) {
      restaurantStats[key] = {
        visits: 0,
        dayDistribution: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
        successDays: 0,
        totalDays: 0,
        avgCalories: [],
        avgProtein: []
      }
    }

    restaurantStats[key].visits++
    const dayOfWeek = new Date(log.datetime).getDay()
    restaurantStats[key].dayDistribution[dayOfWeek]++
    restaurantStats[key].avgCalories.push(log.orderTemplate.calories * (log.servings || 1))
    restaurantStats[key].avgProtein.push(log.orderTemplate.protein * (log.servings || 1))
  }

  // Calculate success rates per restaurant
  for (const dayData of dayDataArray) {
    for (const restaurant of dayData.restaurants) {
      const key = normalizeRestaurantName(restaurant)
      if (!restaurantStats[key]) continue

      restaurantStats[key].totalDays++
      const isSuccess = dayData.protein >= dayData.proteinTarget * 0.9 &&
        dayData.calories >= dayData.caloriesTarget * 0.85 &&
        dayData.calories <= dayData.caloriesTarget * 1.15

      if (isSuccess) {
        restaurantStats[key].successDays++
      }
    }
  }

  // Create patterns for restaurants with enough data
  for (const [key, stats] of Object.entries(restaurantStats)) {
    if (stats.visits < 3) continue

    const successRate = stats.totalDays > 0 ? stats.successDays / stats.totalDays : 0
    const dominantDayEntry = Object.entries(stats.dayDistribution)
      .sort((a, b) => b[1] - a[1])[0]
    const dominantDay = parseInt(dominantDayEntry[0])
    const dominantDayCount = dominantDayEntry[1]

    patterns.push({
      patternType: 'restaurant',
      patternKey: key,
      patternValue: {
        restaurantName: key.replace(/_/g, ' '),
        visitCount: stats.visits,
        successRate: Math.round(successRate * 100) / 100,
        dominantDay,
        dominantDayName: DAY_NAMES[dominantDay],
        dominantDayCount,
        hasDayPreference: dominantDayCount >= 3 && dominantDayCount >= stats.visits * 0.3,
        avgCalories: Math.round(average(stats.avgCalories)),
        avgProtein: Math.round(average(stats.avgProtein)),
        isHighSuccess: successRate >= 0.7,
        isLowSuccess: successRate < 0.4
      },
      confidence: Math.min(stats.visits / 8, 1),
      occurrences: stats.visits
    })
  }

  return patterns
}

/**
 * Detect success patterns - what conditions correlate with hitting goals
 */
function detectSuccessPatterns(dayDataArray: DayData[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = []

  // Helper to check if day was successful
  const isSuccessful = (day: DayData): boolean => {
    return day.protein >= day.proteinTarget * 0.9 &&
      day.calories >= day.caloriesTarget * 0.85 &&
      day.calories <= day.caloriesTarget * 1.15
  }

  // Day of week success rates
  const dayOfWeekStats: Record<number, { success: number; total: number }> = {
    0: { success: 0, total: 0 },
    1: { success: 0, total: 0 },
    2: { success: 0, total: 0 },
    3: { success: 0, total: 0 },
    4: { success: 0, total: 0 },
    5: { success: 0, total: 0 },
    6: { success: 0, total: 0 }
  }

  // Breakfast correlation
  let withBreakfast = { success: 0, total: 0 }
  let withoutBreakfast = { success: 0, total: 0 }

  // Restaurant vs home correlation
  let restaurantDays = { success: 0, total: 0 }
  let homeDays = { success: 0, total: 0 }

  for (const day of dayDataArray) {
    const success = isSuccessful(day)

    // Day of week
    dayOfWeekStats[day.dayOfWeek].total++
    if (success) dayOfWeekStats[day.dayOfWeek].success++

    // Breakfast
    if (day.hadBreakfast) {
      withBreakfast.total++
      if (success) withBreakfast.success++
    } else {
      withoutBreakfast.total++
      if (success) withoutBreakfast.success++
    }

    // Restaurant vs home
    if (day.restaurantMeals > day.homeMeals) {
      restaurantDays.total++
      if (success) restaurantDays.success++
    } else if (day.homeMeals > 0) {
      homeDays.total++
      if (success) homeDays.success++
    }
  }

  // Create day-of-week patterns for notable days
  for (const [dayNum, stats] of Object.entries(dayOfWeekStats)) {
    if (stats.total < 3) continue
    const successRate = stats.success / stats.total

    // Only create pattern if notably different from average
    const overallSuccessRate = dayDataArray.filter(isSuccessful).length / dayDataArray.length
    const difference = successRate - overallSuccessRate

    if (Math.abs(difference) > 0.15) {
      patterns.push({
        patternType: 'success',
        patternKey: `day_${dayNum}`,
        patternValue: {
          dayOfWeek: parseInt(dayNum),
          dayName: DAY_NAMES[parseInt(dayNum)],
          successRate: Math.round(successRate * 100) / 100,
          overallSuccessRate: Math.round(overallSuccessRate * 100) / 100,
          difference: Math.round(difference * 100) / 100,
          isStrongDay: successRate > overallSuccessRate + 0.15,
          isWeakDay: successRate < overallSuccessRate - 0.15
        },
        confidence: Math.min(stats.total / 5, 1),
        occurrences: stats.total
      })
    }
  }

  // Breakfast correlation pattern
  if (withBreakfast.total >= 5 && withoutBreakfast.total >= 5) {
    const breakfastSuccessRate = withBreakfast.success / withBreakfast.total
    const noBreakfastSuccessRate = withoutBreakfast.success / withoutBreakfast.total
    const difference = breakfastSuccessRate - noBreakfastSuccessRate

    if (Math.abs(difference) > 0.15) {
      patterns.push({
        patternType: 'success',
        patternKey: 'breakfast_correlation',
        patternValue: {
          withBreakfastSuccessRate: Math.round(breakfastSuccessRate * 100) / 100,
          withoutBreakfastSuccessRate: Math.round(noBreakfastSuccessRate * 100) / 100,
          difference: Math.round(difference * 100) / 100,
          breakfastHelps: difference > 0.15,
          breakfastDaysCount: withBreakfast.total,
          noBreakfastDaysCount: withoutBreakfast.total
        },
        confidence: Math.min((withBreakfast.total + withoutBreakfast.total) / 20, 1),
        occurrences: withBreakfast.total + withoutBreakfast.total
      })
    }
  }

  // Home vs restaurant correlation
  if (restaurantDays.total >= 5 && homeDays.total >= 5) {
    const restaurantSuccessRate = restaurantDays.success / restaurantDays.total
    const homeSuccessRate = homeDays.success / homeDays.total
    const difference = homeSuccessRate - restaurantSuccessRate

    if (Math.abs(difference) > 0.15) {
      patterns.push({
        patternType: 'success',
        patternKey: 'home_vs_restaurant',
        patternValue: {
          homeSuccessRate: Math.round(homeSuccessRate * 100) / 100,
          restaurantSuccessRate: Math.round(restaurantSuccessRate * 100) / 100,
          difference: Math.round(difference * 100) / 100,
          homeIsBetter: difference > 0.15,
          restaurantIsBetter: difference < -0.15,
          homeDaysCount: homeDays.total,
          restaurantDaysCount: restaurantDays.total
        },
        confidence: Math.min((homeDays.total + restaurantDays.total) / 20, 1),
        occurrences: homeDays.total + restaurantDays.total
      })
    }
  }

  return patterns
}

/**
 * Detect recovery patterns - what happens after heavy days
 */
function detectRecoveryPatterns(dayDataArray: DayData[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = []

  // Sort by date
  const sortedDays = [...dayDataArray].sort((a, b) => a.date.localeCompare(b.date))

  const recoveryEvents: {
    heavyDayRatio: number
    nextDayRatio: number
  }[] = []

  for (let i = 0; i < sortedDays.length - 1; i++) {
    const currentDay = sortedDays[i]
    const nextDay = sortedDays[i + 1]

    // Check if current day was "heavy" (>120% of calorie target)
    const currentRatio = currentDay.calories / currentDay.caloriesTarget
    if (currentRatio > 1.2) {
      const nextRatio = nextDay.calories / nextDay.caloriesTarget

      recoveryEvents.push({
        heavyDayRatio: currentRatio,
        nextDayRatio: nextRatio
      })
    }
  }

  if (recoveryEvents.length >= 3) {
    const avgRecoveryRatio = average(recoveryEvents.map(e => e.nextDayRatio))
    const compensates = avgRecoveryRatio < 0.95
    const overcorrects = avgRecoveryRatio < 0.75
    const maintains = avgRecoveryRatio >= 0.95 && avgRecoveryRatio <= 1.1

    patterns.push({
      patternType: 'recovery',
      patternKey: 'post_heavy_day',
      patternValue: {
        avgRecoveryRatio: Math.round(avgRecoveryRatio * 100) / 100,
        compensates,
        overcorrects,
        maintains,
        heavyDayCount: recoveryEvents.length,
        behavior: overcorrects ? 'overcorrects' : compensates ? 'compensates' : maintains ? 'maintains' : 'varies'
      },
      confidence: Math.min(recoveryEvents.length / 5, 1),
      occurrences: recoveryEvents.length
    })
  }

  return patterns
}

/**
 * Get user's patterns for use in recommendations
 */
export async function getUserPatterns(userId: string) {
  return prisma.userPattern.findMany({
    where: { userId },
    orderBy: { confidence: 'desc' }
  })
}

/**
 * Get pattern summary for AI context
 */
export async function getPatternContextForAI(userId: string): Promise<string> {
  const patterns = await getUserPatterns(userId)

  if (patterns.length === 0) {
    return ''
  }

  const lines: string[] = ['USER PATTERNS (learned from their eating history):']

  for (const pattern of patterns) {
    const value = pattern.patternValue as Record<string, unknown>

    switch (pattern.patternType) {
      case 'success':
        if (pattern.patternKey.startsWith('day_') && value.isStrongDay) {
          lines.push(`- ${value.dayName} is their strongest day (${Math.round((value.successRate as number) * 100)}% on target)`)
        }
        if (pattern.patternKey === 'breakfast_correlation' && value.breakfastHelps) {
          lines.push(`- Logging breakfast correlates with ${Math.round((value.difference as number) * 100)}% better success`)
        }
        break

      case 'restaurant':
        if (value.isHighSuccess) {
          lines.push(`- ${value.restaurantName} works well for them (${Math.round((value.successRate as number) * 100)}% success rate)`)
        }
        if (value.hasDayPreference) {
          lines.push(`- They often visit ${value.restaurantName} on ${value.dominantDayName}s`)
        }
        break

      case 'timing':
        if (value.isLate) {
          lines.push(`- They tend to eat ${pattern.patternKey.split('_')[1]} about ${Math.abs(value.deviationFromExpected as number)} minutes later than planned`)
        }
        break

      case 'recovery':
        if (value.compensates && !value.overcorrects) {
          lines.push(`- They naturally eat lighter after heavy days (healthy balance)`)
        }
        if (value.overcorrects) {
          lines.push(`- They tend to undershoot after heavy days - suggest moderate recovery`)
        }
        break
    }
  }

  return lines.length > 1 ? lines.join('\n') : ''
}
