import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Valid email is required' },
        { status: 400 }
      )
    }

    // Check if email already exists
    const existing = await prisma.waitlist.findUnique({
      where: { email: email.toLowerCase().trim() }
    })

    if (existing) {
      return NextResponse.json({
        success: true,
        message: 'You\'re already on the list!'
      })
    }

    // Add to waitlist
    await prisma.waitlist.create({
      data: {
        email: email.toLowerCase().trim()
      }
    })

    return NextResponse.json({
      success: true,
      message: 'You\'re on the list!'
    })
  } catch (error) {
    console.error('Waitlist error:', error)
    return NextResponse.json(
      { error: 'Failed to join waitlist' },
      { status: 500 }
    )
  }
}

export async function GET() {
  // Optional: Get waitlist count (for admin purposes)
  try {
    const count = await prisma.waitlist.count()
    return NextResponse.json({ count })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to get count' }, { status: 500 })
  }
}
