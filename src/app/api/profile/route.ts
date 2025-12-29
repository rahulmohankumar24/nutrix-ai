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

    // Get today's targets
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    let targets = await prisma.dailyTarget.findUnique({
      where: {
        userId_date: {
          userId,
          date: today
        }
      }
    })

    // If no targets for today, calculate them
    if (!targets) {
      const calculatedTargets = calculateTargets(
        profile.heightIn,
        profile.weightLb,
        profile.age || 27,
        profile.sex as 'male' | 'female' | 'other',
        profile.goal as 'recomp' | 'lean_bulk' | 'cut',
        profile.liftingDays,
        profile.stepsLevel as 'low' | 'med' | 'high'
      )

      targets = await prisma.dailyTarget.create({
        data: {
          userId,
          date: today,
          calories: calculatedTargets.calories,
          protein: calculatedTargets.protein,
          carbs: calculatedTargets.carbs,
          fat: calculatedTargets.fat
        }
      })
    }

    // Convert heightIn to feet and inches for display
    const heightFt = Math.floor(profile.heightIn / 12)
    const heightIn = profile.heightIn % 12

    return NextResponse.json({
      profile: {
        ...profile,
        heightFt,
        heightIn
      },
      targets: {
        calories: targets.calories,
        protein: targets.protein,
        carbs: targets.carbs,
        fat: targets.fat
      }
    })
  } catch (error) {
    console.error('Failed to fetch profile:', error)
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, timezone = 'America/Los_Angeles', ...updateData } = body

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

    let newTargets = null

    if (hasRelevantChanges) {
      newTargets = calculateTargets(
        updatedProfile.heightIn,
        updatedProfile.weightLb,
        updatedProfile.age || 27,
        updatedProfile.sex as 'male' | 'female' | 'other',
        updatedProfile.goal as 'recomp' | 'lean_bulk' | 'cut',
        updatedProfile.liftingDays,
        updatedProfile.stepsLevel as 'low' | 'med' | 'high'
      )

      // Get today's date in user's timezone
      const now = new Date()
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      })
      const userDateStr = formatter.format(now)
      const today = new Date(`${userDateStr}T00:00:00.000Z`)

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

    return NextResponse.json({
      success: true,
      profile: updatedProfile,
      targets: newTargets // Return new targets so frontend can update immediately
    })
  } catch (error) {
    console.error('Failed to update profile:', error)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}