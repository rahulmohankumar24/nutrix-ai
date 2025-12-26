import { NextRequest, NextResponse } from 'next/server'
import { OnboardingSchema } from '@/lib/types'
import { calculateTargets } from '@/lib/calculations'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, ...onboardingData } = body
    const validatedData = OnboardingSchema.parse(onboardingData)

    // Check if user exists
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Calculate total height in inches
    const totalHeightIn = validatedData.heightFt * 12 + validatedData.heightIn

    // Create profile
    const profile = await prisma.profile.create({
      data: {
        userId: userId,
        sex: validatedData.sex,
        age: validatedData.age,
        heightIn: totalHeightIn,
        weightLb: validatedData.weightLb,
        goal: validatedData.goal,
        liftingDays: validatedData.liftingDays,
        stepsLevel: validatedData.stepsLevel,
        constraints: JSON.stringify(validatedData.constraints),
        dislikes: validatedData.dislikes,
        wakeTime: validatedData.wakeTime,
        lunchTime: validatedData.lunchTime,
        dinnerTime: validatedData.dinnerTime
      }
    })

    // Calculate daily targets
    const targets = calculateTargets(
      totalHeightIn,
      validatedData.weightLb,
      validatedData.age || 27,
      validatedData.sex as 'male' | 'female' | 'other',
      validatedData.goal as 'recomp' | 'lean_bulk' | 'cut',
      validatedData.liftingDays,
      validatedData.stepsLevel as 'low' | 'med' | 'high'
    )

    // Save today's targets
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    await prisma.dailyTarget.create({
      data: {
        userId: userId,
        date: today,
        calories: targets.calories,
        protein: targets.protein,
        carbs: targets.carbs,
        fat: targets.fat
      }
    })

    // Parse preferences using OpenAI (skip for now to avoid fetch issues)
    if (process.env.OPENAI_API_KEY && validatedData.freeText) {
      try {
        // Create basic preferences without OpenAI parsing for now
        await prisma.preferences.create({
          data: {
            userId: userId,
            eatingPattern: 'mixed',
            dislikesDetected: JSON.stringify([]),
            preferredCuisines: JSON.stringify([]),
            timeToCook: '30min+',
            budget: 'medium',
            coachingNotes: validatedData.freeText || ''
          }
        })
      } catch (error) {
        console.error('Failed to create preferences:', error)
        // Continue without preferences if creation fails
      }
    }

    // Create default reminders
    const defaultReminders = [
      { name: 'Morning Protein', timeOfDay: '10:30' },
      { name: 'Lunch Check-in', timeOfDay: '14:00' },
      { name: 'Evening Protein', timeOfDay: '18:00' },
      { name: 'Daily Close-out', timeOfDay: '21:00' }
    ]

    // Create reminders sequentially to avoid database connection issues
    for (const reminder of defaultReminders) {
      await prisma.reminder.create({
        data: {
          userId: userId,
          name: reminder.name,
          timeOfDay: reminder.timeOfDay,
          enabled: true
        }
      })
    }

    return NextResponse.json({
      success: true,
      userId: userId,
      targets
    })
  } catch (error) {
    console.error('Onboarding error:', error)
    return NextResponse.json(
      { error: 'Failed to create profile' },
      { status: 500 }
    )
  }
}