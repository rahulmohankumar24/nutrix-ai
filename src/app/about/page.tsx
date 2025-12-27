"use client"

import Link from "next/link"
import { ArrowLeft, Target, Brain, Utensils, TrendingUp, MessageCircle, Sparkles } from "lucide-react"

export default function AboutPage() {
  const features = [
    {
      icon: Brain,
      title: "AI-Powered Coaching",
      description: "Our intelligent coach learns your preferences, understands your goals, and provides personalized meal recommendations that fit your lifestyle."
    },
    {
      icon: Utensils,
      title: "Restaurant Integration",
      description: "Find nearby restaurants and get AI-generated meal suggestions that match your nutritional targets. Eat out without derailing your progress."
    },
    {
      icon: MessageCircle,
      title: "Natural Meal Logging",
      description: "Just tell us what you ate in plain language. Our AI understands and logs your meals accurately—no more searching through endless food databases."
    },
    {
      icon: Target,
      title: "Personalized Targets",
      description: "Whether you're cutting, bulking, or recomping, we calculate optimal macro targets based on your body, activity level, and goals."
    },
    {
      icon: TrendingUp,
      title: "Progress Tracking",
      description: "Visualize your journey with intuitive charts and insights. See patterns in your eating habits and celebrate your consistency."
    },
    {
      icon: Sparkles,
      title: "Smart Insights",
      description: "Receive AI-generated insights about your nutrition patterns. We'll help you identify what's working and what could be improved."
    }
  ]

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-4xl px-6 py-12">
        {/* Back Link */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>

        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-normal text-foreground tracking-[0.08em] mb-4">rovia</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Your AI-powered nutrition companion that makes healthy eating simple, personalized, and sustainable.
          </p>
        </div>

        {/* Mission Section */}
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-3xl p-8 border border-primary/20 mb-12">
          <h2 className="text-2xl font-semibold text-foreground mb-4">Our Mission</h2>
          <p className="text-lg text-muted-foreground leading-relaxed mb-4">
            We believe nutrition shouldn't be complicated. Counting calories and tracking macros can feel overwhelming,
            especially when life gets busy. That's why we built Rovia—to be the smart, supportive companion that helps
            you make better food choices without the stress.
          </p>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Our goal is to meet you where you are. Whether you're grabbing lunch at a restaurant, cooking at home,
            or picking up a quick snack, Rovia adapts to your lifestyle and guides you toward your goals with
            personalized, actionable advice.
          </p>
        </div>

        {/* Features Grid */}
        <div className="mb-12">
          <h2 className="text-2xl font-semibold text-foreground mb-6">What Makes Rovia Different</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((feature) => {
              const Icon = feature.icon
              return (
                <div
                  key={feature.title}
                  className="bg-card rounded-2xl p-6 border border-border/50 hover:border-primary/30 transition-all"
                >
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-foreground mb-2">{feature.title}</h3>
                      <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Philosophy Section */}
        <div className="bg-card rounded-3xl p-8 border border-border/50 mb-12">
          <h2 className="text-2xl font-semibold text-foreground mb-4">Our Philosophy</h2>
          <div className="space-y-4 text-muted-foreground leading-relaxed">
            <p>
              <strong className="text-foreground">Progress over perfection.</strong> We don't expect you to hit your
              targets every single day. Life happens. What matters is the trend, not the individual days. Rovia helps
              you stay consistent without the guilt.
            </p>
            <p>
              <strong className="text-foreground">Simplicity is key.</strong> No complicated meal prep requirements,
              no rigid eating schedules. Just tell us what you're eating and we'll help you make it work within your goals.
            </p>
            <p>
              <strong className="text-foreground">Real food, real life.</strong> We're not here to push expensive
              supplements or restrictive diets. Rovia works with the foods you actually eat, at the places you
              actually go.
            </p>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center">
          <p className="text-muted-foreground mb-6">Ready to find your path?</p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
          >
            Get Started
          </Link>
        </div>
      </main>
    </div>
  )
}
