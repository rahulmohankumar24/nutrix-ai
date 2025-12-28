'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import { ArrowRight, Sparkles, Target, BarChart3, Utensils, Brain, CheckCircle2 } from 'lucide-react'

export default function LandingPage() {
  const router = useRouter()
  const { isLoaded, isSignedIn } = useUser()

  useEffect(() => {
    if (!isLoaded) return
    if (isSignedIn) {
      router.push('/dashboard')
    }
  }, [isLoaded, isSignedIn, router])

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary border-t-transparent"></div>
      </div>
    )
  }

  if (isSignedIn) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <span className="text-primary font-bold text-lg">r</span>
            </div>
            <span className="font-semibold text-foreground text-lg">rovia</span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/auth/signin"
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/auth/signup"
              className="px-5 py-2.5 text-sm font-medium bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">AI-Powered Nutrition</span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-6xl font-bold text-foreground leading-tight mb-6">
            Know exactly what
            <br />
            <span className="text-primary">to eat next</span>
          </h1>

          {/* Subheadline */}
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Personalized meal recommendations that adapt to your goals, preferences, and what you've already eaten today.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/auth/signup"
              className="group flex items-center gap-2 px-8 py-4 bg-primary text-primary-foreground rounded-2xl font-medium text-lg hover:opacity-90 transition-all shadow-lg shadow-primary/20"
            >
              Start Free
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/auth/signin"
              className="px-8 py-4 text-foreground rounded-2xl font-medium text-lg border border-border hover:bg-muted/50 transition-colors"
            >
              I have an account
            </Link>
          </div>
        </div>
      </section>

      {/* Visual Preview */}
      <section className="pb-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="relative rounded-3xl bg-gradient-to-b from-primary/5 to-transparent border border-border/50 p-8 md:p-12">
            {/* Mock Dashboard Preview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Today's Progress Card */}
              <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Target className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Today's Progress</p>
                    <p className="text-2xl font-bold text-foreground">1,450 <span className="text-base font-normal text-muted-foreground">/ 2,100 cal</span></p>
                  </div>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full w-[69%] bg-primary rounded-full"></div>
                </div>
              </div>

              {/* AI Recommendation Card */}
              <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-purple-500" />
                  <span className="text-sm font-medium text-purple-600">AI Suggestion</span>
                </div>
                <p className="text-foreground font-medium mb-2">Chipotle Bowl</p>
                <p className="text-sm text-muted-foreground mb-3">Chicken, brown rice, fajitas, mild salsa</p>
                <div className="flex gap-3 text-xs">
                  <span className="text-muted-foreground">680 cal</span>
                  <span className="text-primary font-medium">52g protein</span>
                </div>
              </div>

              {/* Protein Goal Card */}
              <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Protein Goal</p>
                    <p className="text-2xl font-bold text-foreground">92g <span className="text-base font-normal text-green-600">on track</span></p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">Need 58g more today</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Nutrition that understands you
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              We learn your habits, preferences, and goals to give you recommendations that actually work for your life.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="text-center">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
                <Utensils className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Smart Meal Picks</h3>
              <p className="text-muted-foreground">
                Get personalized restaurant orders and home meals based on what you need right now.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="text-center">
              <div className="h-14 w-14 rounded-2xl bg-purple-500/10 flex items-center justify-center mx-auto mb-5">
                <Brain className="h-7 w-7 text-purple-500" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Learns Your Patterns</h3>
              <p className="text-muted-foreground">
                Our AI adapts to when you eat, what you like, and how your week flows.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="text-center">
              <div className="h-14 w-14 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto mb-5">
                <BarChart3 className="h-7 w-7 text-blue-500" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Insightful Analytics</h3>
              <p className="text-muted-foreground">
                See your progress, discover patterns, and get insights that help you improve.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Simple as it should be
            </h2>
          </div>

          <div className="space-y-8">
            {[
              {
                step: "01",
                title: "Tell us about you",
                description: "Your goals, preferences, and dietary needs. Takes 2 minutes."
              },
              {
                step: "02",
                title: "Log what you eat",
                description: "Just tell our AI naturally — \"I had a chicken salad for lunch.\""
              },
              {
                step: "03",
                title: "Get smart recommendations",
                description: "We'll tell you exactly what to eat next to hit your goals."
              }
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-6 p-6 rounded-2xl hover:bg-muted/30 transition-colors">
                <div className="flex-shrink-0 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-bold">{item.step}</span>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-foreground mb-1">{item.title}</h3>
                  <p className="text-muted-foreground">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-3xl p-12 border border-primary/20">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Ready to eat smarter?
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Join thousands who've simplified their nutrition with personalized AI guidance.
            </p>
            <Link
              href="/auth/signup"
              className="inline-flex items-center gap-2 px-8 py-4 bg-primary text-primary-foreground rounded-2xl font-medium text-lg hover:opacity-90 transition-all shadow-lg shadow-primary/20"
            >
              Get Started Free
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-border">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="text-primary font-bold text-sm">r</span>
            </div>
            <span className="font-medium text-foreground">rovia</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Personalized nutrition, simplified.
          </p>
        </div>
      </footer>
    </div>
  )
}
