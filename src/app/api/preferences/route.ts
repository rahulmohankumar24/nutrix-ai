import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    const preferences = await prisma.preferences.findUnique({
      where: { userId }
    })

    if (!preferences) {
      return NextResponse.json({ error: 'Preferences not found' }, { status: 404 })
    }

    return NextResponse.json(preferences)
  } catch (error) {
    console.error('Failed to fetch preferences:', error)
    return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 })
  }
}