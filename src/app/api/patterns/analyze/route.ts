import { NextRequest, NextResponse } from 'next/server'
import { analyzeUserPatterns } from '@/lib/patterns/detector'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, minDays = 7 } = body

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    const result = await analyzeUserPatterns(userId, minDays)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to analyze patterns:', error)
    return NextResponse.json({ error: 'Failed to analyze patterns' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const minDays = parseInt(searchParams.get('minDays') || '7')

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    const result = await analyzeUserPatterns(userId, minDays)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to analyze patterns:', error)
    return NextResponse.json({ error: 'Failed to analyze patterns' }, { status: 500 })
  }
}
