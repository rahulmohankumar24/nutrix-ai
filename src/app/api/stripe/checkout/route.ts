import { NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import Stripe from 'stripe'
import { prisma } from '@/lib/prisma'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(request: Request) {
  try {
    const user = await currentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { priceType } = await request.json()

    // Get or create profile
    let profile = await prisma.profile.findUnique({
      where: { userId: user.id }
    })

    if (!profile) {
      return NextResponse.json(
        { error: 'Please complete onboarding first' },
        { status: 400 }
      )
    }

    // Get or create Stripe customer
    let customerId = profile.stripeCustomerId

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.emailAddresses[0]?.emailAddress,
        name: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : undefined,
        metadata: {
          userId: user.id
        }
      })
      customerId = customer.id

      // Save customer ID to profile
      await prisma.profile.update({
        where: { userId: user.id },
        data: { stripeCustomerId: customerId }
      })
    }

    // Get the correct price ID based on billing cycle
    const priceId = priceType === 'yearly'
      ? process.env.STRIPE_YEARLY_PRICE_ID
      : process.env.STRIPE_MONTHLY_PRICE_ID

    if (!priceId) {
      return NextResponse.json(
        { error: 'Price configuration missing' },
        { status: 500 }
      )
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/dashboard?success=true`,
      cancel_url: `${appUrl}/pro`,
      metadata: {
        userId: user.id
      },
      subscription_data: {
        metadata: {
          userId: user.id
        }
      }
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Stripe checkout error:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
