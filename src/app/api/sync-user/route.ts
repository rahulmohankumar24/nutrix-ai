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

    const userEmail = clerkUser.emailAddresses[0]?.emailAddress

    // Try to find user by email first (in case of duplicate email from old auth)
    const userByEmail = await prisma.user.findUnique({
      where: { email: userEmail }
    })

    if (userByEmail && userByEmail.id !== userId) {
      // Old user exists with this email - delete it and create new one with Clerk ID
      // This handles migration from NextAuth to Clerk
      await prisma.$transaction(async (tx) => {
        // Delete old user and cascade delete all related records
        await tx.user.delete({
          where: { email: userEmail }
        })

        // Create new user with Clerk ID
        await tx.user.create({
          data: {
            id: userId,
            email: userEmail,
            name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || null,
            image: clerkUser.imageUrl || null,
            emailVerified: clerkUser.emailAddresses[0]?.verification?.status === 'verified' ? new Date() : null,
          }
        })
      })

      return NextResponse.json({ success: true, userMigrated: true })
    }

    // Create new user
    await prisma.user.create({
      data: {
        id: userId,
        email: userEmail,
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
