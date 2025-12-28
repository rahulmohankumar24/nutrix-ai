import { NextRequest, NextResponse } from 'next/server'
import {
  generateInsightsFromPatterns,
  getActiveInsights,
  getDailyInsight,
  markInsightDisplayed
} from '@/lib/patterns/insights'
import { analyzeUserPatterns } from '@/lib/patterns/detector'

// GET: Retrieve insights for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const context = searchParams.get('context') as 'dashboard' | 'my-path' | null
    const limit = parseInt(searchParams.get('limit') || '5')
    const daily = searchParams.get('daily') === 'true'

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    if (daily) {
      const insight = await getDailyInsight(userId)
      return NextResponse.json({ insight })
    }

    const insights = await getActiveInsights(userId, limit, context || undefined)
    return NextResponse.json({ insights })
  } catch (error) {
    console.error('Failed to get insights:', error)
    return NextResponse.json({ error: 'Failed to get insights' }, { status: 500 })
  }
}

// POST: Generate insights from patterns (and optionally re-analyze patterns first)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, reanalyze = false } = body

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    let analysisResult: { daysAnalyzed?: number; patternsDetected?: number; message?: string } = {}

    // Optionally re-analyze patterns first
    if (reanalyze) {
      analysisResult = await analyzeUserPatterns(userId)
    }

    // Generate insights from current patterns
    await generateInsightsFromPatterns(userId)

    // Return the updated insights
    const insights = await getActiveInsights(userId, 10)

    return NextResponse.json({
      success: true,
      insightsGenerated: insights.length,
      insights,
      daysAnalyzed: analysisResult.daysAnalyzed || 0,
      patternsDetected: analysisResult.patternsDetected || 0,
      message: analysisResult.message || null
    })
  } catch (error) {
    console.error('Failed to generate insights:', error)
    return NextResponse.json({ error: 'Failed to generate insights' }, { status: 500 })
  }
}

// PATCH: Mark insight as displayed
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { insightId } = body

    if (!insightId) {
      return NextResponse.json({ error: 'Insight ID required' }, { status: 400 })
    }

    await markInsightDisplayed(insightId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to mark insight displayed:', error)
    return NextResponse.json({ error: 'Failed to update insight' }, { status: 500 })
  }
}
