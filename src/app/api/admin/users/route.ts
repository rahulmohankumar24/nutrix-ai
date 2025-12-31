import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

const ADMIN_EMAILS = ['myrahul.mohankumar@gmail.com']

async function isAdmin() {
  const user = await currentUser()
  if (!user?.emailAddresses?.[0]?.emailAddress) return false
  return ADMIN_EMAILS.includes(user.emailAddresses[0].emailAddress)
}

// GET - List all users with their profile's Pro status
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        createdAt: true,
        profile: {
          select: {
            isPro: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    // Flatten the response
    const formattedUsers = users.map(u => ({
      id: u.id,
      email: u.email,
      isPro: u.profile?.isPro ?? false,
      createdAt: u.createdAt,
    }))

    return NextResponse.json({ users: formattedUsers })
  } catch (error) {
    console.error('Failed to fetch users:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}

// POST - Toggle Pro status on Profile
export async function POST(request: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { userId, isPro } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Check if profile exists
    const existingProfile = await prisma.profile.findUnique({
      where: { userId: userId },
    })

    if (!existingProfile) {
      return NextResponse.json({ error: 'User has not completed onboarding' }, { status: 400 })
    }

    // Update the profile's isPro status
    const profile = await prisma.profile.update({
      where: { userId: userId },
      data: { isPro: isPro },
      select: {
        userId: true,
        isPro: true,
      },
    })

    // If upgrading to Pro, trigger AI insights generation in the background
    if (isPro) {
      const baseUrl = request.nextUrl.origin

      // Trigger pattern insights generation
      fetch(`${baseUrl}/api/patterns/insights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, reanalyze: true }),
      }).catch(err => console.error('Failed to trigger pattern insights:', err))

      // Trigger health analysis generation
      fetch(`${baseUrl}/api/health-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      }).catch(err => console.error('Failed to trigger health analysis:', err))
    }

    return NextResponse.json({ user: { id: profile.userId, isPro: profile.isPro } })
  } catch (error) {
    console.error('Failed to update user:', error)
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}
