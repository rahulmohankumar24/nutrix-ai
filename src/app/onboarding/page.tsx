'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { OnboardingData, OnboardingSchema } from '@/lib/types'

export default function OnboardingPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
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
    if (status === 'loading') return

    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }

    // Check if user already has a profile
    if (session?.user?.id) {
      checkExistingProfile()
    }
  }, [status, session?.user?.id, router])

  const checkExistingProfile = async () => {
    try {
      const response = await fetch(`/api/profile?userId=${session?.user?.id}`)

      if (response.ok) {
        const result = await response.json()
        if (result.profile) {
          // User already has a profile, redirect to dashboard
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
      if (!session?.user?.id) {
        throw new Error('Please sign in to continue')
      }

      const validatedData = OnboardingSchema.parse(formData)

      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...validatedData,
          userId: session.user.id
        })
      })

      if (!response.ok) {
        throw new Error('Failed to create profile')
      }

      const result = await response.json()
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
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-2 border-blue-500 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-400 text-sm">Checking your profile...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black py-12 px-4">
      <div className="max-w-2xl mx-auto glass rounded-2xl p-8">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">M</span>
            </div>
            <h1 className="text-3xl font-bold text-white">Mootra AI</h1>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Set Up Your Nutrition Profile</h2>
          <p className="text-gray-400">Tell us about yourself to get personalized meal recommendations</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Sex</label>
              <select
                value={formData.sex}
                onChange={(e) => setFormData(prev => ({ ...prev, sex: e.target.value as any }))}
                className="w-full p-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Age (optional)</label>
              <input
                type="number"
                min="13"
                max="100"
                value={formData.age || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  age: e.target.value ? parseInt(e.target.value) : undefined
                }))}
                className="w-full p-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white focus:border-blue-500 focus:outline-none"
                placeholder="27"
              />
            </div>
          </div>

          {/* Height */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Height</label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <select
                  value={formData.heightFt}
                  onChange={(e) => setFormData(prev => ({ ...prev, heightFt: parseInt(e.target.value) }))}
                  className="w-full p-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white focus:border-blue-500 focus:outline-none"
                >
                  {[3, 4, 5, 6, 7, 8].map(ft => (
                    <option key={ft} value={ft}>{ft} ft</option>
                  ))}
                </select>
              </div>
              <div>
                <select
                  value={formData.heightIn}
                  onChange={(e) => setFormData(prev => ({ ...prev, heightIn: parseInt(e.target.value) }))}
                  className="w-full p-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white focus:border-blue-500 focus:outline-none"
                >
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(inches => (
                    <option key={inches} value={inches}>{inches} in</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Weight */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Weight (lbs)</label>
            <input
              type="number"
              min="50"
              max="500"
              value={formData.weightLb}
              onChange={(e) => setFormData(prev => ({ ...prev, weightLb: parseInt(e.target.value) }))}
              className="w-full p-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white focus:border-blue-500 focus:outline-none"
              required
            />
          </div>

          {/* Goal */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Primary Goal</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'cut', label: 'Cut (Fat Loss)', desc: 'Lose fat while maintaining muscle' },
                { value: 'recomp', label: 'Recomp', desc: 'Build muscle and lose fat simultaneously' },
                { value: 'lean_bulk', label: 'Lean Bulk', desc: 'Build muscle with minimal fat gain' }
              ].map(goal => (
                <label key={goal.value} className="cursor-pointer">
                  <input
                    type="radio"
                    name="goal"
                    value={goal.value}
                    checked={formData.goal === goal.value}
                    onChange={(e) => setFormData(prev => ({ ...prev, goal: e.target.value as any }))}
                    className="sr-only"
                  />
                  <div className={`p-3 border rounded-md text-center ${
                    formData.goal === goal.value
                      ? 'border-blue-500 bg-blue-900/30 text-blue-300'
                      : 'border-gray-700 bg-gray-800/30 text-gray-300 hover:border-gray-600'
                  }`}>
                    <div className="font-medium">{goal.label}</div>
                    <div className={`text-sm ${formData.goal === goal.value ? 'text-blue-400' : 'text-gray-500'}`}>{goal.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Activity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Lifting Days Per Week
              </label>
              <select
                value={formData.liftingDays}
                onChange={(e) => setFormData(prev => ({ ...prev, liftingDays: parseInt(e.target.value) }))}
                className="w-full p-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white focus:border-blue-500 focus:outline-none"
              >
                {[0, 1, 2, 3, 4, 5, 6, 7].map(days => (
                  <option key={days} value={days}>{days} days</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Daily Steps
              </label>
              <select
                value={formData.stepsLevel}
                onChange={(e) => setFormData(prev => ({ ...prev, stepsLevel: e.target.value as any }))}
                className="w-full p-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="low">Low (&lt;5k steps)</option>
                <option value="med">Medium (5k-10k steps)</option>
                <option value="high">High (&gt;10k steps)</option>
              </select>
            </div>
          </div>

          {/* Dietary Constraints */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Dietary Constraints
            </label>
            <div className="grid grid-cols-2 gap-2">
              {['vegetarian', 'vegan', 'halal', 'lactose-free'].map(constraint => (
                <label key={constraint} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={(formData.constraints || []).includes(constraint)}
                    onChange={(e) => handleConstraintChange(constraint, e.target.checked)}
                    className="mr-2 accent-blue-500"
                  />
                  <span className="capitalize text-gray-300">{constraint}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Dislikes */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Foods You Dislike (comma-separated)
            </label>
            <input
              type="text"
              value={formData.dislikes}
              onChange={(e) => setFormData(prev => ({ ...prev, dislikes: e.target.value }))}
              className="w-full p-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white focus:border-blue-500 focus:outline-none placeholder-gray-500"
              placeholder="mushrooms, tomatoes, seafood"
            />
          </div>

          {/* Schedule */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Wake Time</label>
              <input
                type="time"
                value={formData.wakeTime}
                onChange={(e) => setFormData(prev => ({ ...prev, wakeTime: e.target.value }))}
                className="w-full p-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Lunch Time</label>
              <input
                type="time"
                value={formData.lunchTime}
                onChange={(e) => setFormData(prev => ({ ...prev, lunchTime: e.target.value }))}
                className="w-full p-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Dinner Time</label>
              <input
                type="time"
                value={formData.dinnerTime}
                onChange={(e) => setFormData(prev => ({ ...prev, dinnerTime: e.target.value }))}
                className="w-full p-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Free Text */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Describe Your Body Situation & Goals
            </label>
            <textarea
              value={formData.freeText}
              onChange={(e) => setFormData(prev => ({ ...prev, freeText: e.target.value }))}
              className="w-full p-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white focus:border-blue-500 focus:outline-none placeholder-gray-500 h-32"
              placeholder="I work a desk job and want to build muscle while losing some belly fat. I eat out for lunch most days and prefer quick meals..."
              required
            />
          </div>

          {error && (
            <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-4 text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 px-6 rounded-xl font-medium hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 transition-all"
          >
            {loading ? 'Creating Profile...' : 'Create My Nutrition Plan'}
          </button>
        </form>
      </div>
    </div>
  )
}