import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user exists in database
    const existingUser = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (existingUser) {
      return NextResponse.json({ success: true, userExists: true })
    }

    // User doesn't exist in database, create them
    const clerkUser = await currentUser()

    if (!clerkUser) {
      return NextResponse.json({ error: 'User not found in Clerk' }, { status: 404 })
    }

    await prisma.user.create({
      data: {
        id: userId,
        email: clerkUser.emailAddresses[0]?.emailAddress,
        name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || null,
        image: clerkUser.imageUrl || null,
        emailVerified: clerkUser.emailAddresses[0]?.verification?.status === 'verified' ? new Date() : null,
      }
    })

    return NextResponse.json({ success: true, userCreated: true })
  } catch (error) {
    console.error('Failed to sync user:', error)
    return NextResponse.json({ error: 'Failed to sync user' }, { status: 500 })
  }
}
