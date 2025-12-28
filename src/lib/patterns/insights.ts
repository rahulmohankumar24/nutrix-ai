import { prisma } from '@/lib/prisma'

interface PatternValue {
  [key: string]: unknown
}

interface UserPatternData {
  id: string
  patternType: string
  patternKey: string
  patternValue: PatternValue
  confidence: number
  occurrences: number
}

interface InsightTemplate {
  headline: string
  body: string
  tone: 'positive' | 'neutral' | 'curious'
  relevanceScore: number
}

/**
 * Generate human-readable insights from user patterns
 */
export async function generateInsightsFromPatterns(userId: string): Promise<void> {
  const patterns = await prisma.userPattern.findMany({
    where: { userId },
    orderBy: { confidence: 'desc' }
  }) as UserPatternData[]

  if (patterns.length === 0) return

  const insights: {
    category: string
    headline: string
    body: string
    tone: string
    confidence: number
    relevanceScore: number
    patternIds: string[]
  }[] = []

  for (const pattern of patterns) {
    const value = pattern.patternValue as PatternValue
    const template = generateInsightTemplate(pattern, value)

    if (template && pattern.confidence >= 0.4) {
      insights.push({
        category: pattern.patternType,
        headline: template.headline,
        body: template.body,
        tone: template.tone,
        confidence: pattern.confidence,
        relevanceScore: template.relevanceScore,
        patternIds: [pattern.id]
      })
    }
  }

  // Upsert insights to database
  for (const insight of insights) {
    // Check if similar insight exists
    const existingInsight = await prisma.patternInsight.findFirst({
      where: {
        userId,
        category: insight.category,
        headline: insight.headline
      }
    })

    if (existingInsight) {
      await prisma.patternInsight.update({
        where: { id: existingInsight.id },
        data: {
          body: insight.body,
          confidence: insight.confidence,
          relevanceScore: insight.relevanceScore,
          patternIds: JSON.stringify(insight.patternIds),
          isActive: true
        }
      })
    } else {
      await prisma.patternInsight.create({
        data: {
          userId,
          category: insight.category,
          headline: insight.headline,
          body: insight.body,
          tone: insight.tone,
          confidence: insight.confidence,
          relevanceScore: insight.relevanceScore,
          patternIds: JSON.stringify(insight.patternIds)
        }
      })
    }
  }

  // Deactivate old insights that don't match current patterns
  const activeHeadlines = insights.map(i => i.headline)
  await prisma.patternInsight.updateMany({
    where: {
      userId,
      headline: { notIn: activeHeadlines },
      isActive: true
    },
    data: { isActive: false }
  })
}

/**
 * Generate insight template from a pattern
 */
function generateInsightTemplate(
  pattern: UserPatternData,
  value: PatternValue
): InsightTemplate | null {
  switch (pattern.patternType) {
    case 'success':
      return generateSuccessInsight(pattern, value)
    case 'restaurant':
      return generateRestaurantInsight(pattern, value)
    case 'timing':
      return generateTimingInsight(pattern, value)
    case 'recovery':
      return generateRecoveryInsight(pattern, value)
    default:
      return null
  }
}

function generateSuccessInsight(
  pattern: UserPatternData,
  value: PatternValue
): InsightTemplate | null {
  if (pattern.patternKey.startsWith('day_')) {
    const successRate = Math.round((value.successRate as number) * 100)

    if (value.isStrongDay) {
      return {
        headline: `Your ${value.dayName} game is strong`,
        body: `You hit your targets ${successRate}% of the time on ${value.dayName}s. Whatever you're doing, keep it up.`,
        tone: 'positive',
        relevanceScore: 0.8
      }
    }

    if (value.isWeakDay) {
      return {
        headline: `${value.dayName}s can be tricky`,
        body: `Your success rate on ${value.dayName}s is ${successRate}%. Maybe worth planning meals ahead?`,
        tone: 'curious',
        relevanceScore: 0.7
      }
    }
  }

  if (pattern.patternKey === 'breakfast_correlation') {
    if (value.breakfastHelps) {
      const improvement = Math.round((value.difference as number) * 100)
      return {
        headline: 'Breakfast sets you up for success',
        body: `Days when you log breakfast, you're ${improvement}% more likely to hit your targets.`,
        tone: 'positive',
        relevanceScore: 0.85
      }
    }
  }

  if (pattern.patternKey === 'home_vs_restaurant') {
    if (value.homeIsBetter) {
      return {
        headline: 'Home cooking works for you',
        body: `You tend to hit your targets more often on days you cook at home. Restaurant days are a bit trickier.`,
        tone: 'neutral',
        relevanceScore: 0.7
      }
    }

    if (value.restaurantIsBetter) {
      return {
        headline: 'Restaurants work for you',
        body: `Interesting - you actually do better on days you eat out. You've learned to navigate menus well.`,
        tone: 'positive',
        relevanceScore: 0.7
      }
    }
  }

  return null
}

function generateRestaurantInsight(
  pattern: UserPatternData,
  value: PatternValue
): InsightTemplate | null {
  const restaurantName = (value.restaurantName as string).split('_').map(
    word => word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ')
  const visitCount = value.visitCount as number

  if (value.isHighSuccess && visitCount >= 5) {
    const successRate = Math.round((value.successRate as number) * 100)
    return {
      headline: `${restaurantName} is your spot`,
      body: `${successRate}% success rate there across ${visitCount} visits. You've cracked their menu.`,
      tone: 'positive',
      relevanceScore: 0.9
    }
  }

  if (value.hasDayPreference && visitCount >= 4) {
    return {
      headline: `${restaurantName} ${value.dominantDayName}s are a thing`,
      body: `You've been there ${value.dominantDayCount} times on ${value.dominantDayName}s. It's becoming a tradition.`,
      tone: 'neutral',
      relevanceScore: 0.6
    }
  }

  if (value.isLowSuccess && visitCount >= 4) {
    const successRate = Math.round((value.successRate as number) * 100)
    return {
      headline: `${restaurantName} is tricky`,
      body: `Only ${successRate}% success rate there. Might be worth having a go-to order figured out.`,
      tone: 'curious',
      relevanceScore: 0.65
    }
  }

  if (visitCount >= 8) {
    return {
      headline: `${restaurantName} is your go-to`,
      body: `${visitCount} visits in the last 90 days. They probably know your order by now.`,
      tone: 'neutral',
      relevanceScore: 0.5
    }
  }

  return null
}

function generateTimingInsight(
  pattern: UserPatternData,
  value: PatternValue
): InsightTemplate | null {
  const mealType = pattern.patternKey.split('_')[1]
  const mealName = mealType.charAt(0).toUpperCase() + mealType.slice(1)
  const isWeekend = pattern.patternKey.startsWith('weekend')

  if (value.isConsistent) {
    return {
      headline: `Your ${isWeekend ? 'weekend ' : ''}${mealName.toLowerCase()} timing is dialed in`,
      body: `You eat ${mealName.toLowerCase()} around ${value.avgTimeFormatted} pretty consistently. Good rhythm.`,
      tone: 'positive',
      relevanceScore: 0.55
    }
  }

  if (value.isLate && Math.abs(value.deviationFromExpected as number) > 60) {
    return {
      headline: `You're a late ${mealName.toLowerCase()} person`,
      body: `You tend to eat ${mealName.toLowerCase()} about ${Math.round((value.deviationFromExpected as number) / 60)} hours later than planned. Might want to adjust your schedule.`,
      tone: 'curious',
      relevanceScore: 0.5
    }
  }

  return null
}

function generateRecoveryInsight(
  pattern: UserPatternData,
  value: PatternValue
): InsightTemplate | null {
  if (value.compensates && !value.overcorrects) {
    return {
      headline: 'You naturally balance things out',
      body: `After bigger eating days, you tend to eat lighter the next day. Your body knows what's up.`,
      tone: 'positive',
      relevanceScore: 0.8
    }
  }

  if (value.overcorrects) {
    return {
      headline: 'Watch for the over-correction',
      body: `After heavy days, you sometimes eat too little. A moderate recovery is usually better than a crash.`,
      tone: 'curious',
      relevanceScore: 0.75
    }
  }

  if (value.maintains) {
    return {
      headline: 'You stay consistent',
      body: `Even after heavier eating days, you get right back to your normal pattern. Solid mindset.`,
      tone: 'positive',
      relevanceScore: 0.7
    }
  }

  return null
}

/**
 * Get active insights for a user, sorted by relevance
 */
export async function getActiveInsights(
  userId: string,
  limit: number = 5,
  context?: 'dashboard' | 'my-path'
) {
  const insights = await prisma.patternInsight.findMany({
    where: {
      userId,
      isActive: true
    },
    orderBy: [
      { relevanceScore: 'desc' },
      { confidence: 'desc' },
      { displayedCount: 'asc' }
    ],
    take: limit
  })

  // For dashboard, prefer less-displayed insights to keep it fresh
  if (context === 'dashboard' && insights.length > 0) {
    // Sort to prioritize less-displayed, higher-relevance insights
    insights.sort((a, b) => {
      const aScore = a.relevanceScore - (a.displayedCount * 0.1)
      const bScore = b.relevanceScore - (b.displayedCount * 0.1)
      return bScore - aScore
    })
  }

  return insights
}

/**
 * Mark an insight as displayed
 */
export async function markInsightDisplayed(insightId: string) {
  await prisma.patternInsight.update({
    where: { id: insightId },
    data: {
      displayedCount: { increment: 1 },
      lastDisplayed: new Date()
    }
  })
}

/**
 * Get a single daily insight for the dashboard
 */
export async function getDailyInsight(userId: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // First try to get an insight not shown today
  const freshInsight = await prisma.patternInsight.findFirst({
    where: {
      userId,
      isActive: true,
      OR: [
        { lastDisplayed: null },
        { lastDisplayed: { lt: today } }
      ]
    },
    orderBy: [
      { relevanceScore: 'desc' },
      { displayedCount: 'asc' }
    ]
  })

  if (freshInsight) {
    return freshInsight
  }

  // Fall back to any high-relevance insight
  return prisma.patternInsight.findFirst({
    where: {
      userId,
      isActive: true,
      relevanceScore: { gte: 0.6 }
    },
    orderBy: { relevanceScore: 'desc' }
  })
}
