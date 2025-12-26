import { NextRequest, NextResponse } from 'next/server'
import { OnboardingSchema } from '@/lib/types'
import { calculateTargets } from '@/lib/calculations'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = OnboardingSchema.parse(body)

    // Create user
    const user = await prisma.user.create({
      data: {}
    })

    // Calculate total height in inches
    const totalHeightIn = validatedData.heightFt * 12 + validatedData.heightIn

    // Create profile
    const profile = await prisma.profile.create({
      data: {
        userId: user.id,
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
        userId: user.id,
        date: today,
        calories: targets.calories,
        protein: targets.protein,
        carbs: targets.carbs,
        fat: targets.fat
      }
    })

    // Parse preferences using OpenAI
    if (process.env.OPENAI_API_KEY) {
      try {
        const preferencesResponse = await fetch('/api/parse-preferences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ freeText: validatedData.freeText })
        })

        if (preferencesResponse.ok) {
          const preferences = await preferencesResponse.json()
          await prisma.preferences.create({
            data: {
              userId: user.id,
              eatingPattern: preferences.eating_pattern,
              dislikesDetected: JSON.stringify(preferences.dislikes_detected),
              preferredCuisines: JSON.stringify(preferences.preferred_cuisines),
              timeToCook: preferences.time_to_cook,
              budget: preferences.budget,
              coachingNotes: preferences.coaching_notes
            }
          })
        }
      } catch (error) {
        console.error('Failed to parse preferences:', error)
        // Continue without preferences if OpenAI fails
      }
    }

    // Create default reminders
    const defaultReminders = [
      { name: 'Morning Protein', timeOfDay: '10:30' },
      { name: 'Lunch Check-in', timeOfDay: '14:00' },
      { name: 'Evening Protein', timeOfDay: '18:00' },
      { name: 'Daily Close-out', timeOfDay: '21:00' }
    ]

    await Promise.all(
      defaultReminders.map(reminder =>
        prisma.reminder.create({
          data: {
            userId: user.id,
            name: reminder.name,
            timeOfDay: reminder.timeOfDay,
            enabled: true
          }
        })
      )
    )

    return NextResponse.json({
      success: true,
      userId: user.id,
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