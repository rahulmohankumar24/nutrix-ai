import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Get today's targets
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const dailyTarget = await prisma.dailyTarget.findUnique({
      where: {
        userId_date: {
          userId,
          date: today
        }
      }
    })

    if (!dailyTarget) {
      return NextResponse.json({ error: 'Daily targets not found' }, { status: 404 })
    }

    return NextResponse.json({
      calories: dailyTarget.calories,
      protein: dailyTarget.protein,
      carbs: dailyTarget.carbs,
      fat: dailyTarget.fat
    })
  } catch (error) {
    console.error('Failed to fetch daily targets:', error)
    return NextResponse.json({ error: 'Failed to fetch daily targets' }, { status: 500 })
  }
}