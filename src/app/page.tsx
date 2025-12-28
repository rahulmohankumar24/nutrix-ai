'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ArrowRight, Check } from 'lucide-react'

export default function LandingPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setLoading(true)
    // Simulate API call - replace with actual waitlist API
    await new Promise(resolve => setTimeout(resolve, 800))
    setSubmitted(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#FAFAF9]">
      {/* Subtle grid background */}
      <div
        className="fixed inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }}
      />

      <div className="relative">
        {/* Header */}
        <header className="px-6 py-8">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <Image
              src="/logo.png"
              alt="Rovia"
              width={100}
              height={32}
              className="h-8 w-auto"
            />
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Coming Soon</span>
            </div>
          </div>
        </header>

        {/* Hero */}
        <main className="px-6 pt-20 pb-32 md:pt-32 md:pb-40">
          <div className="max-w-3xl mx-auto">
            {/* Main headline */}
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-light text-neutral-900 tracking-tight leading-[1.1] mb-8">
              Nutrition that
              <br />
              <span className="text-neutral-400">thinks with you</span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg md:text-xl text-neutral-500 max-w-xl leading-relaxed mb-12">
              AI-powered recommendations that adapt to your goals,
              your preferences, and your day. Know exactly what to eat next.
            </p>

            {/* Waitlist form */}
            {!submitted ? (
              <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  className="flex-1 px-5 py-4 rounded-2xl bg-white border border-neutral-200 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-400 transition-colors"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="group px-6 py-4 rounded-2xl bg-neutral-900 text-white font-medium flex items-center justify-center gap-2 hover:bg-neutral-800 transition-colors disabled:opacity-50"
                >
                  {loading ? (
                    <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      Join Waitlist
                      <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-3 text-emerald-600">
                <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                  <Check className="h-5 w-5" />
                </div>
                <span className="text-lg">You're on the list. We'll be in touch.</span>
              </div>
            )}
          </div>
        </main>

        {/* Features - minimal cards */}
        <section className="px-6 pb-32">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  title: "Personalized",
                  description: "Learns your eating patterns, preferences, and goals to give recommendations that fit your life."
                },
                {
                  title: "Contextual",
                  description: "Knows what you've already eaten today and suggests what comes next to hit your targets."
                },
                {
                  title: "Intelligent",
                  description: "Analyzes your habits over time and surfaces insights you wouldn't notice yourself."
                }
              ].map((feature, i) => (
                <div
                  key={i}
                  className="group p-8 rounded-3xl bg-white border border-neutral-100 hover:border-neutral-200 transition-colors"
                >
                  <div className="text-xs font-medium text-neutral-400 mb-4 tracking-wider uppercase">
                    0{i + 1}
                  </div>
                  <h3 className="text-xl font-medium text-neutral-900 mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-neutral-500 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works - editorial style */}
        <section className="px-6 pb-32">
          <div className="max-w-6xl mx-auto">
            <div className="border-t border-neutral-200 pt-16">
              <p className="text-sm font-medium text-neutral-400 tracking-wider uppercase mb-12">
                How it works
              </p>

              <div className="space-y-16 md:space-y-0 md:grid md:grid-cols-2 md:gap-16">
                <div>
                  <span className="text-7xl font-extralight text-neutral-200">01</span>
                  <h3 className="text-2xl font-light text-neutral-900 mt-4 mb-3">
                    Tell us your goals
                  </h3>
                  <p className="text-neutral-500 leading-relaxed">
                    Whether you're building muscle, losing weight, or just eating better —
                    we calibrate everything to what matters to you.
                  </p>
                </div>

                <div>
                  <span className="text-7xl font-extralight text-neutral-200">02</span>
                  <h3 className="text-2xl font-light text-neutral-900 mt-4 mb-3">
                    Log naturally
                  </h3>
                  <p className="text-neutral-500 leading-relaxed">
                    Just tell us what you ate. No barcode scanning, no measuring cups.
                    "I had a chicken salad for lunch" is all we need.
                  </p>
                </div>

                <div>
                  <span className="text-7xl font-extralight text-neutral-200">03</span>
                  <h3 className="text-2xl font-light text-neutral-900 mt-4 mb-3">
                    Get smart suggestions
                  </h3>
                  <p className="text-neutral-500 leading-relaxed">
                    We'll tell you exactly what to eat next — at home or at any restaurant —
                    to stay on track without the mental math.
                  </p>
                </div>

                <div>
                  <span className="text-7xl font-extralight text-neutral-200">04</span>
                  <h3 className="text-2xl font-light text-neutral-900 mt-4 mb-3">
                    See what's working
                  </h3>
                  <p className="text-neutral-500 leading-relaxed">
                    Discover patterns in your eating habits. Get insights that help you
                    improve without obsessing over every calorie.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="px-6 pb-20">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-sm font-medium text-neutral-400 tracking-wider uppercase mb-6">
              Early Access
            </p>
            <h2 className="text-3xl md:text-4xl font-light text-neutral-900 mb-8">
              Be first to experience
              <br />
              smarter nutrition
            </h2>

            {!submitted ? (
              <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  className="flex-1 px-5 py-4 rounded-2xl bg-white border border-neutral-200 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-400 transition-colors"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="group px-6 py-4 rounded-2xl bg-neutral-900 text-white font-medium flex items-center justify-center gap-2 hover:bg-neutral-800 transition-colors disabled:opacity-50"
                >
                  {loading ? (
                    <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      Join Waitlist
                      <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              <div className="flex items-center justify-center gap-3 text-emerald-600">
                <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                  <Check className="h-5 w-5" />
                </div>
                <span className="text-lg">You're on the list.</span>
              </div>
            )}
          </div>
        </section>

        {/* Footer */}
        <footer className="px-6 py-12 border-t border-neutral-100">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <Image
              src="/logo.png"
              alt="Rovia"
              width={80}
              height={26}
              className="h-6 w-auto opacity-50"
            />
            <p className="text-sm text-neutral-400">
              Nutrition, simplified.
            </p>
          </div>
        </footer>
      </div>
    </div>
  )
}
