"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Target, Brain, Utensils, MessageCircle, TrendingUp, ChevronRight, ChevronLeft } from "lucide-react"

const features = [
  {
    icon: Target,
    title: "Your Personalized Targets",
    description: "We've calculated your optimal calories and macros based on your goals. Check them anytime in My Path.",
    color: "bg-primary/10 text-primary"
  },
  {
    icon: MessageCircle,
    title: "Log Meals Naturally",
    description: "Just type what you ate in plain language. Say \"I had a chicken sandwich\" and we'll handle the rest.",
    color: "bg-blue-500/10 text-blue-500"
  },
  {
    icon: Utensils,
    title: "Eat Out Smarter",
    description: "Find nearby restaurants and get AI-powered meal suggestions that fit your macros. No more guessing.",
    color: "bg-orange-500/10 text-orange-500"
  },
  {
    icon: TrendingUp,
    title: "Track Your Progress",
    description: "See your journey unfold in My Path with weekly insights, streaks, and personalized tips.",
    color: "bg-green-500/10 text-green-500"
  },
  {
    icon: Brain,
    title: "I Learn Your Patterns",
    description: "In 7 days, I'll know when you eat, where you succeed, and what works for you. The more you log, the smarter I get.",
    color: "bg-purple-500/10 text-purple-500",
    highlight: "🧠 Learning starts now"
  }
]

export default function WelcomePage() {
  const router = useRouter()
  const [currentSlide, setCurrentSlide] = useState(0)

  const nextSlide = () => {
    if (currentSlide < features.length - 1) {
      setCurrentSlide(currentSlide + 1)
    } else {
      router.push("/dashboard")
    }
  }

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1)
    }
  }

  const skipTour = () => {
    router.push("/dashboard")
  }

  const feature = features[currentSlide]
  const Icon = feature.icon
  const isLastSlide = currentSlide === features.length - 1

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 flex justify-between items-center">
        <span className="text-2xl font-normal text-foreground tracking-[0.08em]">rovia</span>
        <button
          onClick={skipTour}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip tour
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-12">
        {/* Welcome Message - Only on first slide */}
        {currentSlide === 0 && (
          <div className="text-center mb-8">
            <h1 className="text-3xl font-semibold text-foreground mb-2">Welcome to Rovia</h1>
            <p className="text-muted-foreground">Let's show you around</p>
          </div>
        )}

        {/* Feature Card */}
        <div className="w-full max-w-md">
          <div className="bg-card rounded-3xl p-8 border border-border/50 text-center">
            <div className={`h-20 w-20 rounded-2xl ${feature.color} flex items-center justify-center mx-auto mb-6`}>
              <Icon className="h-10 w-10" />
            </div>
            <h2 className="text-2xl font-semibold text-foreground mb-3">{feature.title}</h2>
            <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
            {'highlight' in feature && feature.highlight && (
              <div className="mt-4 inline-block bg-purple-500/10 text-purple-600 px-4 py-2 rounded-full text-sm font-medium">
                {feature.highlight}
              </div>
            )}
          </div>

          {/* Progress Dots */}
          <div className="flex justify-center gap-2 mt-6">
            {features.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`h-2 rounded-full transition-all ${
                  index === currentSlide
                    ? "w-8 bg-primary"
                    : "w-2 bg-muted hover:bg-muted-foreground/30"
                }`}
              />
            ))}
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-8">
            <button
              onClick={prevSlide}
              disabled={currentSlide === 0}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                currentSlide === 0
                  ? "text-muted-foreground/30 cursor-not-allowed"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>

            <button
              onClick={nextSlide}
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
            >
              {isLastSlide ? "Get Started" : "Next"}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
