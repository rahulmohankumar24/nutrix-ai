'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { OnboardingData, OnboardingSchema } from '@/lib/types'

export default function OnboardingPage() {
  const router = useRouter()
  const { user, isLoaded, isSignedIn } = useUser()
  const [formData, setFormData] = useState<Partial<OnboardingData>>({
    sex: 'male',
    heightFt: 5,
    heightIn: 8,
    weightLb: 150,
    goal: 'recomp',
    liftingDays: 3,
    stepsLevel: 'med',
    constraints: [],
    dislikes: '',
    wakeTime: '07:00',
    lunchTime: '12:00',
    dinnerTime: '18:00',
    freeText: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checkingProfile, setCheckingProfile] = useState(true)

  useEffect(() => {
    if (!isLoaded) return

    if (!isSignedIn) {
      router.push('/auth/signin')
      return
    }

    if (user?.id) {
      syncAndCheckProfile()
    }
  }, [isLoaded, isSignedIn, user?.id, router])

  const syncAndCheckProfile = async () => {
    try {
      await fetch('/api/sync-user', { method: 'POST' })
      await checkExistingProfile()
    } catch (error) {
      console.error('Failed to sync user:', error)
      setCheckingProfile(false)
    }
  }

  const checkExistingProfile = async () => {
    try {
      const response = await fetch(`/api/profile?userId=${user?.id}`)

      if (response.ok) {
        const result = await response.json()
        if (result.profile) {
          router.push('/dashboard')
          return
        }
      }
    } catch (error) {
      console.error('Error checking existing profile:', error)
    }
    setCheckingProfile(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (!user?.id) {
        throw new Error('Please sign in to continue')
      }

      const validatedData = OnboardingSchema.parse(formData)

      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...validatedData,
          userId: user.id
        })
      })

      if (!response.ok) {
        throw new Error('Failed to create profile')
      }

      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleConstraintChange = (constraint: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      constraints: checked
        ? [...(prev.constraints || []), constraint]
        : (prev.constraints || []).filter(c => c !== constraint)
    }))
  }

  if (checkingProfile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  const inputClass = "w-full p-3 bg-background border border-border rounded-xl text-foreground focus:border-primary focus:outline-none transition-colors"
  const labelClass = "block text-sm font-medium text-foreground mb-2"

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <span className="text-primary font-semibold text-lg">R</span>
            </div>
          </div>
          <h1 className="text-2xl font-semibold text-foreground mb-2">Tell us about yourself</h1>
          <p className="text-muted-foreground">We'll create a personalized plan just for you</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Info */}
          <div className="bg-card rounded-2xl p-6 border border-border">
            <h2 className="text-sm font-medium text-muted-foreground mb-4">Basic Info</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Sex</label>
                <select
                  value={formData.sex}
                  onChange={(e) => setFormData(prev => ({ ...prev, sex: e.target.value as any }))}
                  className={inputClass}
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>Age</label>
                <input
                  type="number"
                  min="13"
                  max="100"
                  value={formData.age || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    age: e.target.value ? parseInt(e.target.value) : undefined
                  }))}
                  className={inputClass}
                  placeholder="27"
                />
              </div>

              <div className="col-span-2 grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Height (ft)</label>
                  <select
                    value={formData.heightFt}
                    onChange={(e) => setFormData(prev => ({ ...prev, heightFt: parseInt(e.target.value) }))}
                    className={inputClass}
                  >
                    {[3, 4, 5, 6, 7, 8].map(ft => (
                      <option key={ft} value={ft}>{ft} ft</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Height (in)</label>
                  <select
                    value={formData.heightIn}
                    onChange={(e) => setFormData(prev => ({ ...prev, heightIn: parseInt(e.target.value) }))}
                    className={inputClass}
                  >
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(inches => (
                      <option key={inches} value={inches}>{inches} in</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="col-span-2">
                <label className={labelClass}>Weight (lbs)</label>
                <input
                  type="number"
                  min="50"
                  max="500"
                  value={formData.weightLb}
                  onChange={(e) => setFormData(prev => ({ ...prev, weightLb: parseInt(e.target.value) }))}
                  className={inputClass}
                  required
                />
              </div>
            </div>
          </div>

          {/* Goal */}
          <div className="bg-card rounded-2xl p-6 border border-border">
            <h2 className="text-sm font-medium text-muted-foreground mb-4">Your Goal</h2>
            <div className="space-y-2">
              {[
                { value: 'cut', label: 'Lose fat', desc: 'Focus on fat loss while maintaining muscle' },
                { value: 'recomp', label: 'Recomposition', desc: 'Build muscle and lose fat simultaneously' },
                { value: 'lean_bulk', label: 'Build muscle', desc: 'Gain muscle with minimal fat' }
              ].map(goal => (
                <label key={goal.value} className="cursor-pointer block">
                  <input
                    type="radio"
                    name="goal"
                    value={goal.value}
                    checked={formData.goal === goal.value}
                    onChange={(e) => setFormData(prev => ({ ...prev, goal: e.target.value as any }))}
                    className="sr-only"
                  />
                  <div className={`p-4 border rounded-xl transition-all ${
                    formData.goal === goal.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/30'
                  }`}>
                    <div className="font-medium text-foreground">{goal.label}</div>
                    <div className="text-sm text-muted-foreground mt-0.5">{goal.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Activity */}
          <div className="bg-card rounded-2xl p-6 border border-border">
            <h2 className="text-sm font-medium text-muted-foreground mb-4">Activity Level</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Lifting days/week</label>
                <select
                  value={formData.liftingDays}
                  onChange={(e) => setFormData(prev => ({ ...prev, liftingDays: parseInt(e.target.value) }))}
                  className={inputClass}
                >
                  {[0, 1, 2, 3, 4, 5, 6, 7].map(days => (
                    <option key={days} value={days}>{days} days</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Daily steps</label>
                <select
                  value={formData.stepsLevel}
                  onChange={(e) => setFormData(prev => ({ ...prev, stepsLevel: e.target.value as any }))}
                  className={inputClass}
                >
                  <option value="low">Under 5,000</option>
                  <option value="med">5,000 - 10,000</option>
                  <option value="high">Over 10,000</option>
                </select>
              </div>
            </div>
          </div>

          {/* Dietary Preferences */}
          <div className="bg-card rounded-2xl p-6 border border-border">
            <h2 className="text-sm font-medium text-muted-foreground mb-4">Dietary Preferences</h2>
            <div className="flex flex-wrap gap-2 mb-4">
              {['vegetarian', 'vegan', 'halal', 'lactose-free'].map(constraint => (
                <label key={constraint} className="cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(formData.constraints || []).includes(constraint)}
                    onChange={(e) => handleConstraintChange(constraint, e.target.checked)}
                    className="sr-only"
                  />
                  <span className={`px-4 py-2 rounded-full text-sm font-medium transition-all capitalize ${
                    (formData.constraints || []).includes(constraint)
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}>
                    {constraint}
                  </span>
                </label>
              ))}
            </div>

            <div>
              <label className={labelClass}>Foods you avoid</label>
              <input
                type="text"
                value={formData.dislikes}
                onChange={(e) => setFormData(prev => ({ ...prev, dislikes: e.target.value }))}
                className={inputClass}
                placeholder="e.g., mushrooms, seafood"
              />
            </div>
          </div>

          {/* Tell us more */}
          <div className="bg-card rounded-2xl p-6 border border-border">
            <h2 className="text-sm font-medium text-muted-foreground mb-4">Anything else?</h2>
            <textarea
              value={formData.freeText}
              onChange={(e) => setFormData(prev => ({ ...prev, freeText: e.target.value }))}
              className={`${inputClass} h-28 resize-none`}
              placeholder="Tell us about your goals, schedule, or anything that might help us personalize your plan..."
              required
            />
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 text-destructive text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground py-4 px-6 rounded-xl font-medium hover:opacity-90 disabled:opacity-50 transition-all"
          >
            {loading ? 'Creating your plan...' : 'Get started'}
          </button>
        </form>
      </div>
    </div>
  )
}
