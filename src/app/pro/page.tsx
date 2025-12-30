'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import {
  Crown, Check, Sparkles, Brain, Trophy, Zap,
  Shield, MessageCircle, Loader2
} from 'lucide-react'

const PRO_FEATURES = [
  {
    icon: MessageCircle,
    title: 'AI Nutrition Coach',
    description: 'Ask unlimited questions about your diet and get personalized advice'
  },
  {
    icon: Shield,
    title: 'Ingredient Insights',
    description: 'See sodium, seed oils, and hidden ingredients in restaurant meals'
  },
  {
    icon: Trophy,
    title: 'Your Strengths',
    description: 'Discover what you\'re doing well and build on your wins'
  },
  {
    icon: Zap,
    title: 'Areas to Explore',
    description: 'Find personalized areas where small changes make big impact'
  },
  {
    icon: Brain,
    title: 'Pattern Detection',
    description: 'AI-detected eating patterns and behavioral insights'
  },
  {
    icon: Sparkles,
    title: 'Priority Support',
    description: 'Get faster responses and priority feature requests'
  }
]

export default function ProPage() {
  const router = useRouter()
  const { user, isLoaded, isSignedIn } = useUser()
  const [loading, setLoading] = useState(false)
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')

  const handleSubscribe = async () => {
    if (!isSignedIn) {
      router.push('/auth/signin')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          priceType: billingCycle
        })
      })

      if (response.ok) {
        const { url } = await response.json()
        window.location.href = url
      } else {
        console.error('Failed to create checkout session')
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 mb-6">
            <Crown className="h-5 w-5 text-amber-500" />
            <span className="text-sm font-semibold text-amber-600">Rovia Pro</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Unlock the full power of AI nutrition
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Get deeper insights, personalized coaching, and advanced analytics to reach your goals faster.
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center p-1 rounded-xl bg-muted">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
                billingCycle === 'monthly'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all relative ${
                billingCycle === 'yearly'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Yearly
              <span className="absolute -top-2 -right-2 px-1.5 py-0.5 rounded-full bg-green-500 text-[10px] text-white font-semibold">
                -33%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Card */}
        <div className="max-w-md mx-auto mb-16">
          <div className="relative rounded-2xl border-2 border-amber-500/50 bg-gradient-to-b from-amber-500/5 to-transparent p-8">
            <div className="text-center mb-6">
              {billingCycle === 'yearly' && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/30 mb-3">
                  <span className="text-xs font-medium text-green-600">Save $40/year</span>
                </div>
              )}
              <div className="flex items-baseline justify-center gap-1 mb-2">
                <span className="text-5xl font-bold text-foreground">
                  {billingCycle === 'monthly' ? '$9.99' : '$79.99'}
                </span>
                <span className="text-muted-foreground">
                  /{billingCycle === 'monthly' ? 'month' : 'year'}
                </span>
              </div>
              {billingCycle === 'yearly' && (
                <p className="text-sm text-muted-foreground">
                  That&apos;s just $6.67/month
                </p>
              )}
            </div>

            <button
              onClick={handleSubscribe}
              disabled={loading}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold text-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Crown className="h-5 w-5" />
                  Upgrade to Pro
                </>
              )}
            </button>

            <p className="text-center text-xs text-muted-foreground mt-4">
              Cancel anytime. No questions asked.
            </p>
          </div>
        </div>

        {/* Features Grid */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-foreground text-center mb-8">
            Everything included in Pro
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PRO_FEATURES.map((feature, i) => (
              <div
                key={i}
                className="flex items-start gap-4 p-5 rounded-xl bg-card border border-border"
              >
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                  <feature.icon className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Comparison */}
        <div className="rounded-2xl border border-border overflow-hidden">
          <div className="grid grid-cols-3 bg-muted/30 border-b border-border">
            <div className="p-4 font-medium text-foreground">Feature</div>
            <div className="p-4 text-center font-medium text-muted-foreground">Free</div>
            <div className="p-4 text-center font-medium text-amber-600 flex items-center justify-center gap-2">
              <Crown className="h-4 w-4" />
              Pro
            </div>
          </div>
          {[
            { feature: 'AI Meal Suggestions', free: true, pro: true },
            { feature: 'Restaurant Meal Builder', free: true, pro: true },
            { feature: 'Natural Language Logging', free: true, pro: true },
            { feature: 'Weekly Breakdown', free: true, pro: true },
            { feature: 'AI Nutrition Coach', free: false, pro: true },
            { feature: 'Ingredient Insights', free: false, pro: true },
            { feature: 'Strengths & Opportunities', free: false, pro: true },
            { feature: 'Pattern Detection', free: false, pro: true },
            { feature: 'Priority Support', free: false, pro: true },
          ].map((row, i) => (
            <div key={i} className="grid grid-cols-3 border-b border-border last:border-0">
              <div className="p-4 text-sm text-foreground">{row.feature}</div>
              <div className="p-4 flex justify-center">
                {row.free ? (
                  <Check className="h-5 w-5 text-green-500" />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
              <div className="p-4 flex justify-center">
                <Check className="h-5 w-5 text-amber-500" />
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-16 text-center">
          <button
            onClick={handleSubscribe}
            disabled={loading}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold text-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Crown className="h-5 w-5" />
            )}
            {billingCycle === 'monthly' ? 'Get Pro for $9.99/month' : 'Get Pro for $79.99/year'}
          </button>
        </div>
      </main>
    </div>
  )
}
