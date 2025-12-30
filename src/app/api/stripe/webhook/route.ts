import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { prisma } from '@/lib/prisma'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(request: Request) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (error) {
    console.error('Webhook signature verification failed:', error)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        if (session.mode === 'subscription' && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          ) as Stripe.Subscription

          const userId = session.metadata?.userId
          if (!userId) {
            console.error('No userId in checkout session metadata')
            break
          }

          const periodEnd = (subscription as { current_period_end?: number }).current_period_end

          await prisma.profile.update({
            where: { userId },
            data: {
              isPro: true,
              stripeSubscriptionId: subscription.id,
              stripePriceId: subscription.items.data[0]?.price.id,
              stripeCurrentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
            }
          })

          console.log(`Pro subscription activated for user ${userId}`)
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        const profile = await prisma.profile.findUnique({
          where: { stripeCustomerId: customerId }
        })

        if (profile) {
          const isPro = subscription.status === 'active' || subscription.status === 'trialing'
          const periodEnd = (subscription as { current_period_end?: number }).current_period_end

          await prisma.profile.update({
            where: { stripeCustomerId: customerId },
            data: {
              isPro,
              stripePriceId: subscription.items.data[0]?.price.id,
              stripeCurrentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
            }
          })

          console.log(`Subscription updated for customer ${customerId}, isPro: ${isPro}`)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        const profile = await prisma.profile.findUnique({
          where: { stripeCustomerId: customerId }
        })

        if (profile) {
          await prisma.profile.update({
            where: { stripeCustomerId: customerId },
            data: {
              isPro: false,
              stripeSubscriptionId: null,
              stripePriceId: null,
              stripeCurrentPeriodEnd: null,
            }
          })

          console.log(`Subscription cancelled for customer ${customerId}`)
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string

        console.log(`Payment failed for customer ${customerId}`)
        // You could send an email notification here
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook handler error:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}
