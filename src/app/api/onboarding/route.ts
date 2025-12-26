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

    // Use transaction to ensure atomic operations and fresh connection
    const result = await prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({
        where: { id: userId },
        include: {
          profile: true,
          dailyTargets: true
        }
      })

      if (!existingUser) {
        throw new Error('User not found')
      }

      // Check if user already has a profile (returning user)
      if (existingUser.profile) {
        // Calculate targets based on existing profile
        const profile = existingUser.profile
        const targets = calculateTargets(
          profile.heightIn,
          profile.weightLb,
          profile.age || 27,
          profile.sex as 'male' | 'female' | 'other',
          profile.goal as 'recomp' | 'lean_bulk' | 'cut',
          profile.liftingDays,
          profile.stepsLevel as 'low' | 'med' | 'high'
        )

        // Update today's targets if needed
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const existingTarget = await tx.dailyTarget.findUnique({
          where: {
            userId_date: {
              userId: userId,
              date: today
            }
          }
        })

        if (!existingTarget) {
          await tx.dailyTarget.create({
            data: {
              userId: userId,
              date: today,
              calories: targets.calories,
              protein: targets.protein,
              carbs: targets.carbs,
              fat: targets.fat
            }
          })
        }

        return {
          success: true,
          userId: userId,
          targets,
          returning: true,
          message: 'Welcome back!'
        }
      }

      // Calculate total height in inches
      const totalHeightIn = validatedData.heightFt * 12 + validatedData.heightIn

      // Create profile
      const profile = await tx.profile.create({
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

      await tx.dailyTarget.create({
        data: {
          userId: userId,
          date: today,
          calories: targets.calories,
          protein: targets.protein,
          carbs: targets.carbs,
          fat: targets.fat
        }
      })

      // Create basic preferences without OpenAI parsing
      if (validatedData.freeText) {
        try {
          await tx.preferences.create({
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

      // Create reminders sequentially
      for (const reminder of defaultReminders) {
        await tx.reminder.create({
          data: {
            userId: userId,
            name: reminder.name,
            timeOfDay: reminder.timeOfDay,
            enabled: true
          }
        })
      }

      return {
        success: true,
        userId: userId,
        targets
      }
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Onboarding error:', error)

    if (error instanceof Error && error.message === 'User not found') {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create profile' },
      { status: 500 }
    )
  }
}