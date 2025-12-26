import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateTargets } from '@/lib/calculations'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    const profile = await prisma.profile.findUnique({
      where: { userId }
    })

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    return NextResponse.json(profile)
  } catch (error) {
    console.error('Failed to fetch profile:', error)
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, ...updateData } = body

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Update profile
    const updatedProfile = await prisma.profile.update({
      where: { userId },
      data: updateData
    })

    // Recalculate and update daily targets if relevant fields changed
    const fieldsAffectingTargets = ['heightIn', 'weightLb', 'age', 'sex', 'goal', 'liftingDays', 'stepsLevel']
    const hasRelevantChanges = fieldsAffectingTargets.some(field => field in updateData)

    if (hasRelevantChanges) {
      const newTargets = calculateTargets(
        updatedProfile.heightIn,
        updatedProfile.weightLb,
        updatedProfile.age || 27,
        updatedProfile.sex as 'male' | 'female' | 'other',
        updatedProfile.goal as 'recomp' | 'lean_bulk' | 'cut',
        updatedProfile.liftingDays,
        updatedProfile.stepsLevel as 'low' | 'med' | 'high'
      )

      // Update today's targets
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      await prisma.dailyTarget.upsert({
        where: {
          userId_date: {
            userId,
            date: today
          }
        },
        update: {
          calories: newTargets.calories,
          protein: newTargets.protein,
          carbs: newTargets.carbs,
          fat: newTargets.fat
        },
        create: {
          userId,
          date: today,
          calories: newTargets.calories,
          protein: newTargets.protein,
          carbs: newTargets.carbs,
          fat: newTargets.fat
        }
      })
    }

    return NextResponse.json({ success: true, profile: updatedProfile })
  } catch (error) {
    console.error('Failed to update profile:', error)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}