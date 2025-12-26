'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { OnboardingData, OnboardingSchema } from '@/lib/types'

export default function OnboardingPage() {
  const router = useRouter()
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const validatedData = OnboardingSchema.parse(formData)

      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validatedData)
      })

      if (!response.ok) {
        throw new Error('Failed to create profile')
      }

      const result = await response.json()
      localStorage.setItem('userId', result.userId)
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

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Set Up Your Nutrition Profile</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sex</label>
              <select
                value={formData.sex}
                onChange={(e) => setFormData(prev => ({ ...prev, sex: e.target.value as any }))}
                className="w-full p-3 border border-gray-300 rounded-md"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Age (optional)</label>
              <input
                type="number"
                min="13"
                max="100"
                value={formData.age || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  age: e.target.value ? parseInt(e.target.value) : undefined
                }))}
                className="w-full p-3 border border-gray-300 rounded-md"
                placeholder="27"
              />
            </div>
          </div>

          {/* Height */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Height</label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <select
                  value={formData.heightFt}
                  onChange={(e) => setFormData(prev => ({ ...prev, heightFt: parseInt(e.target.value) }))}
                  className="w-full p-3 border border-gray-300 rounded-md"
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
                  className="w-full p-3 border border-gray-300 rounded-md"
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Weight (lbs)</label>
            <input
              type="number"
              min="50"
              max="500"
              value={formData.weightLb}
              onChange={(e) => setFormData(prev => ({ ...prev, weightLb: parseInt(e.target.value) }))}
              className="w-full p-3 border border-gray-300 rounded-md"
              required
            />
          </div>

          {/* Goal */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Primary Goal</label>
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
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300'
                  }`}>
                    <div className="font-medium">{goal.label}</div>
                    <div className="text-sm text-gray-500">{goal.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Activity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Lifting Days Per Week
              </label>
              <select
                value={formData.liftingDays}
                onChange={(e) => setFormData(prev => ({ ...prev, liftingDays: parseInt(e.target.value) }))}
                className="w-full p-3 border border-gray-300 rounded-md"
              >
                {[0, 1, 2, 3, 4, 5, 6, 7].map(days => (
                  <option key={days} value={days}>{days} days</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Daily Steps
              </label>
              <select
                value={formData.stepsLevel}
                onChange={(e) => setFormData(prev => ({ ...prev, stepsLevel: e.target.value as any }))}
                className="w-full p-3 border border-gray-300 rounded-md"
              >
                <option value="low">Low (&lt;5k steps)</option>
                <option value="med">Medium (5k-10k steps)</option>
                <option value="high">High (&gt;10k steps)</option>
              </select>
            </div>
          </div>

          {/* Dietary Constraints */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Dietary Constraints
            </label>
            <div className="grid grid-cols-2 gap-2">
              {['vegetarian', 'vegan', 'halal', 'lactose-free'].map(constraint => (
                <label key={constraint} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={(formData.constraints || []).includes(constraint)}
                    onChange={(e) => handleConstraintChange(constraint, e.target.checked)}
                    className="mr-2"
                  />
                  <span className="capitalize">{constraint}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Dislikes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Foods You Dislike (comma-separated)
            </label>
            <input
              type="text"
              value={formData.dislikes}
              onChange={(e) => setFormData(prev => ({ ...prev, dislikes: e.target.value }))}
              className="w-full p-3 border border-gray-300 rounded-md"
              placeholder="mushrooms, tomatoes, seafood"
            />
          </div>

          {/* Schedule */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Wake Time</label>
              <input
                type="time"
                value={formData.wakeTime}
                onChange={(e) => setFormData(prev => ({ ...prev, wakeTime: e.target.value }))}
                className="w-full p-3 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Lunch Time</label>
              <input
                type="time"
                value={formData.lunchTime}
                onChange={(e) => setFormData(prev => ({ ...prev, lunchTime: e.target.value }))}
                className="w-full p-3 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Dinner Time</label>
              <input
                type="time"
                value={formData.dinnerTime}
                onChange={(e) => setFormData(prev => ({ ...prev, dinnerTime: e.target.value }))}
                className="w-full p-3 border border-gray-300 rounded-md"
              />
            </div>
          </div>

          {/* Free Text */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Describe Your Body Situation & Goals
            </label>
            <textarea
              value={formData.freeText}
              onChange={(e) => setFormData(prev => ({ ...prev, freeText: e.target.value }))}
              className="w-full p-3 border border-gray-300 rounded-md h-32"
              placeholder="I work a desk job and want to build muscle while losing some belly fat. I eat out for lunch most days and prefer quick meals..."
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-md font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Creating Profile...' : 'Create My Nutrition Plan'}
          </button>
        </form>
      </div>
    </div>
  )
}