import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    const reminders = await prisma.reminder.findMany({
      where: { userId },
      orderBy: { timeOfDay: 'asc' }
    })

    return NextResponse.json({ reminders })
  } catch (error) {
    console.error('Get reminders error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch reminders' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { reminderId, enabled, timeOfDay } = await request.json()

    if (!reminderId) {
      return NextResponse.json(
        { error: 'Reminder ID is required' },
        { status: 400 }
      )
    }

    const updateData: { enabled?: boolean; timeOfDay?: string } = {}
    if (typeof enabled === 'boolean') updateData.enabled = enabled
    if (timeOfDay) updateData.timeOfDay = timeOfDay

    const updatedReminder = await prisma.reminder.update({
      where: { id: reminderId },
      data: updateData
    })

    return NextResponse.json({ reminder: updatedReminder })
  } catch (error) {
    console.error('Update reminder error:', error)
    return NextResponse.json(
      { error: 'Failed to update reminder' },
      { status: 500 }
    )
  }
}