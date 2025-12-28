'use client'

import { useState } from 'react'
import Image from 'next/image'

export default function LandingPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setLoading(true)
    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      })

      if (response.ok) {
        setSubmitted(true)
      }
    } catch (error) {
      console.error('Failed to join waitlist:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/8 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-primary/6 rounded-full blur-[120px]" />
      </div>

      <div className="relative">
        {/* Header */}
        <header className="px-6 py-6">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Image
                src="/notext.png"
                alt="Rovia"
                width={200}
                height={65}
                className="h-12 w-auto"
              />
              <span className="text-2xl font-semibold text-foreground tracking-tight leading-none">rovia</span>
            </div>
            <a
              href="/auth/signin"
              className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Log in
            </a>
          </div>
        </header>

        {/* Hero */}
        <main className="px-6 pt-16 pb-32 md:pt-24 md:pb-40">
          <div className="max-w-6xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-semibold text-foreground tracking-tight leading-[1.05] mb-6">
              AI tells you
              <br />
              <span className="text-primary">exactly what to eat</span>
            </h1>

            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-10">
              Stop guessing and tracking. Rovia's AI knows your body, your goals, and what you've eaten — and tells you precisely what to eat next.
            </p>

            {!submitted ? (
              <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  className="flex-1 px-5 py-4 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
                <button
                  onClick={handleSubmit}
                  disabled={loading || !email.trim()}
                  className="px-8 py-4 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all disabled:opacity-50"
                >
                  {loading ? 'Joining...' : 'Get Early Access'}
                </button>
              </div>
            ) : (
              <div className="inline-flex items-center px-6 py-4 rounded-xl bg-primary/10 border border-primary/20 text-primary">
                <span className="text-lg font-medium">You're on the list!</span>
              </div>
            )}

            <p className="mt-4 text-sm text-muted-foreground">
              Join 500+ others on the waitlist
            </p>
          </div>
        </main>

        {/* Feature 1: AI Meal Recommendations */}
        <section className="px-6 pt-8 pb-32">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
                  AI Meal Recommendations
                </div>
                <h2 className="text-3xl md:text-4xl font-semibold text-foreground mb-4">
                  Know exactly what to order at any restaurant
                </h2>
                <p className="text-lg text-muted-foreground mb-6">
                  Tell us where you're eating. AI instantly builds the perfect meal from their menu — optimized for your remaining calories and protein goals.
                </p>
                <div className="flex flex-wrap gap-2">
                  {["Chipotle", "Cava", "Sweetgreen", "Chick-fil-A", "Panera", "+40 more"].map((r, i) => (
                    <span key={i} className={`px-3 py-1.5 rounded-full text-sm font-medium ${i < 5 ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>{r}</span>
                  ))}
                </div>
              </div>

              {/* Visual: Restaurant Recommendation Card */}
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 to-primary/5 rounded-3xl blur-2xl" />
                <div className="relative rounded-2xl border border-border bg-card overflow-hidden shadow-2xl">
                  {/* Header */}
                  <div className="px-5 py-4 border-b border-border bg-muted/30 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <span className="text-lg">🌯</span>
                    </div>
                    <div>
                      <div className="font-semibold text-foreground">Chipotle</div>
                      <div className="text-sm text-muted-foreground">Lunch recommendation</div>
                    </div>
                  </div>
                  {/* Content */}
                  <div className="p-5">
                    <div className="text-sm text-muted-foreground mb-3">Based on your remaining targets:</div>
                    <div className="flex gap-3 mb-5">
                      <div className="flex-1 p-3 rounded-lg bg-primary/5 border border-primary/10 text-center">
                        <div className="text-xl font-bold text-primary">685</div>
                        <div className="text-xs text-muted-foreground">calories</div>
                      </div>
                      <div className="flex-1 p-3 rounded-lg bg-primary/5 border border-primary/10 text-center">
                        <div className="text-xl font-bold text-primary">52g</div>
                        <div className="text-xs text-muted-foreground">protein</div>
                      </div>
                      <div className="flex-1 p-3 rounded-lg bg-muted/50 border border-border text-center">
                        <div className="text-xl font-bold text-foreground">68g</div>
                        <div className="text-xs text-muted-foreground">carbs</div>
                      </div>
                      <div className="flex-1 p-3 rounded-lg bg-muted/50 border border-border text-center">
                        <div className="text-xl font-bold text-foreground">18g</div>
                        <div className="text-xs text-muted-foreground">fat</div>
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                      <div className="font-medium text-foreground mb-2">Your order:</div>
                      <div className="space-y-1.5 text-sm">
                        <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary" /> Bowl</div>
                        <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary" /> White rice</div>
                        <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary" /> Chicken</div>
                        <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary" /> Black beans</div>
                        <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary" /> Fajita veggies</div>
                        <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary" /> Fresh tomato salsa</div>
                        <div className="flex items-center gap-2 text-muted-foreground"><span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" /> Skip: cheese, sour cream</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature 2: Weekly AI Insights */}
        <section className="px-6 pb-32">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              {/* Visual: Weekly Insights Card */}
              <div className="relative order-2 lg:order-1">
                <div className="absolute -inset-4 bg-gradient-to-l from-primary/20 to-primary/5 rounded-3xl blur-2xl" />
                <div className="relative rounded-2xl border border-border bg-card overflow-hidden shadow-2xl">
                  <div className="px-5 py-4 border-b border-border bg-muted/30">
                    <div className="font-semibold text-foreground">Weekly Analysis</div>
                    <div className="text-sm text-muted-foreground">Dec 21 - Dec 27</div>
                  </div>
                  <div className="p-5 space-y-4">
                    {/* Chart visualization */}
                    <div className="flex items-end justify-between gap-3 h-24">
                      {[
                        { day: 'M', height: 88, hit: true },
                        { day: 'T', height: 92, hit: true },
                        { day: 'W', height: 80, hit: true },
                        { day: 'T', height: 95, hit: true },
                        { day: 'F', height: 85, hit: true },
                        { day: 'S', height: 42, hit: false },
                        { day: 'S', height: 50, hit: false },
                      ].map((bar, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                          <div
                            className={`w-full rounded-sm ${bar.hit ? 'bg-primary' : 'bg-amber-500'}`}
                            style={{ height: `${bar.height}px` }}
                          />
                          <span className="text-xs text-muted-foreground">{bar.day}</span>
                        </div>
                      ))}
                    </div>
                    <div className="text-xs text-muted-foreground text-center">Protein goal completion by day</div>

                    <div className="space-y-3 pt-2">
                      <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                        <div className="text-sm font-medium text-primary mb-1">What's working</div>
                        <div className="text-sm text-foreground">Hitting 140g+ protein on training days (M-F). Keep it up.</div>
                      </div>
                      <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
                        <div className="text-sm font-medium text-amber-600 mb-1">Needs attention</div>
                        <div className="text-sm text-foreground">Weekend protein drops 40%. Prep high-protein breakfasts for Sat/Sun.</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="order-1 lg:order-2">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
                  Weekly AI Insights
                </div>
                <h2 className="text-3xl md:text-4xl font-semibold text-foreground mb-4">
                  Your AI coach spots patterns you miss
                </h2>
                <p className="text-lg text-muted-foreground mb-6">
                  Every week, AI analyzes your eating patterns and gives specific, actionable recommendations. Not generic tips — insights based on your actual data.
                </p>
                <ul className="space-y-3">
                  {[
                    "Identifies when you're consistently under or over",
                    "Spots protein timing issues",
                    "Recommends specific meal swaps",
                    "Tracks progress toward your goal"
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      </div>
                      <span className="text-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Feature 3: Goal-Based Personalization */}
        <section className="px-6 pb-32">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
                  Goal-Based AI
                </div>
                <h2 className="text-3xl md:text-4xl font-semibold text-foreground mb-4">
                  Every recommendation fits your goal
                </h2>
                <p className="text-lg text-muted-foreground mb-6">
                  Building muscle needs different nutrition than cutting fat. AI calibrates every suggestion to your specific body composition goal.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { goal: "Lean Bulk", desc: "High protein, caloric surplus" },
                    { goal: "Cut", desc: "Deficit while preserving muscle" },
                    { goal: "Recomp", desc: "Build muscle, lose fat" },
                    { goal: "Maintain", desc: "Steady weight, optimize energy" }
                  ].map((g, i) => (
                    <div key={i} className="p-4 rounded-xl bg-card border border-border hover:border-primary/30 transition-all">
                      <div className="font-medium text-foreground mb-1">{g.goal}</div>
                      <div className="text-sm text-muted-foreground">{g.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Visual: Goal Selection */}
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 to-primary/5 rounded-3xl blur-2xl" />
                <div className="relative rounded-2xl border border-border bg-card overflow-hidden shadow-2xl">
                  <div className="px-5 py-4 border-b border-border bg-muted/30">
                    <div className="font-semibold text-foreground">Your Profile</div>
                  </div>
                  <div className="p-5">
                    <div className="grid grid-cols-2 gap-4 mb-5">
                      <div>
                        <div className="text-sm text-muted-foreground mb-1">Goal</div>
                        <div className="text-lg font-semibold text-primary">Build Muscle</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground mb-1">Activity</div>
                        <div className="text-lg font-semibold text-foreground">4x/week lifting</div>
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-muted/30 border border-border mb-4">
                      <div className="text-sm text-muted-foreground mb-3">Your daily targets</div>
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div>
                          <div className="text-2xl font-bold text-foreground">2,650</div>
                          <div className="text-xs text-muted-foreground">calories</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-primary">175g</div>
                          <div className="text-xs text-muted-foreground">protein</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-foreground">290g</div>
                          <div className="text-xs text-muted-foreground">carbs</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-foreground">85g</div>
                          <div className="text-xs text-muted-foreground">fat</div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      </div>
                      Calculated based on your body stats + activity
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature 4: Natural Logging */}
        <section className="px-6 pb-24">
          <div className="max-w-6xl mx-auto">
            <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 p-8 md:p-12">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
                    Natural Language Logging
                  </div>
                  <h2 className="text-3xl md:text-4xl font-semibold text-foreground mb-4">
                    Just type what you ate
                  </h2>
                  <p className="text-lg text-muted-foreground mb-6">
                    No barcode scanning. No searching databases. Just tell us what you had and AI logs it instantly with accurate macros.
                  </p>
                </div>

                {/* Visual: Logging Examples */}
                <div className="space-y-4">
                  {[
                    { input: "Had a chicken caesar salad and iced coffee", parsed: "Caesar salad w/ grilled chicken, iced coffee (2% milk)", macros: "485 cal · 38g protein" },
                    { input: "Protein shake with banana after gym", parsed: "Whey protein shake, 1 medium banana", macros: "320 cal · 32g protein" },
                    { input: "Two eggs and toast for breakfast", parsed: "2 large eggs scrambled, 2 slices wheat toast w/ butter", macros: "380 cal · 18g protein" }
                  ].map((ex, i) => (
                    <div key={i} className="p-4 rounded-xl bg-card border border-border">
                      <div className="text-sm text-muted-foreground mb-2">You type:</div>
                      <div className="text-foreground font-medium mb-3">"{ex.input}"</div>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="h-px flex-1 bg-border" />
                        <span className="text-xs text-muted-foreground">AI understands</span>
                        <div className="h-px flex-1 bg-border" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-foreground">{ex.parsed}</span>
                        <span className="text-sm font-medium text-primary">{ex.macros}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How it works - Simplified */}
        <section className="px-6 pb-24">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-semibold text-foreground mb-12">
              Three steps to effortless nutrition
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { step: "1", title: "Set your goal", desc: "Tell us your body composition goal. AI calculates your personalized targets." },
                { step: "2", title: "Live your life", desc: "Log meals naturally. Ask for suggestions. We handle the math." },
                { step: "3", title: "Follow AI guidance", desc: "Eat what it recommends. Hit your targets consistently." }
              ].map((item, i) => (
                <div key={i} className="relative">
                  {i < 2 && <div className="hidden md:block absolute top-6 left-[60%] w-[80%] h-px bg-border" />}
                  <div className="w-12 h-12 rounded-xl bg-primary text-primary-foreground text-xl font-bold flex items-center justify-center mx-auto mb-4 relative z-10">
                    {item.step}
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{item.title}</h3>
                  <p className="text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="px-6 pb-24">
          <div className="max-w-3xl mx-auto">
            <div className="grid grid-cols-4 gap-4">
              {[
                { value: "10K+", label: "AI recommendations" },
                { value: "50+", label: "Restaurants" },
                { value: "99%", label: "Accuracy" },
                { value: "<1s", label: "Response" }
              ].map((stat, i) => (
                <div key={i} className="text-center p-5 rounded-xl bg-card border border-border">
                  <div className="text-2xl font-bold text-primary mb-1">{stat.value}</div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-6 pb-24">
          <div className="max-w-3xl mx-auto">
            <div className="text-center p-10 md:p-14 rounded-2xl bg-primary">
              <h2 className="text-2xl md:text-3xl font-semibold text-primary-foreground mb-3">
                Stop tracking. Start eating smarter.
              </h2>
              <p className="text-primary-foreground/80 mb-8 max-w-md mx-auto">
                Let AI tell you exactly what to eat based on your body and goals.
              </p>

              {!submitted ? (
                <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-sm mx-auto">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                    className="flex-1 px-5 py-3.5 rounded-xl bg-primary-foreground text-foreground placeholder:text-muted-foreground focus:outline-none transition-all"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-3.5 rounded-xl bg-background text-foreground font-semibold hover:bg-background/90 transition-all disabled:opacity-50"
                  >
                    {loading ? 'Joining...' : 'Join'}
                  </button>
                </form>
              ) : (
                <p className="text-primary-foreground font-medium text-lg">You're on the list!</p>
              )}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="px-6 py-8 border-t border-border">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <Image
              src="/notext.png"
              alt="Rovia"
              width={100}
              height={32}
              className="h-8 w-auto opacity-50"
            />
            <p className="text-sm text-muted-foreground">
              Personalized nutrition, powered by AI.
            </p>
            <a
              href="mailto:rovianutrition@gmail.com"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Contact
            </a>
          </div>
        </footer>
      </div>
    </div>
  )
}
