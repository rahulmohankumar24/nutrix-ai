'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { calculateTargets } from '@/lib/calculations'

interface Profile {
  id: string
  sex: string
  age: number | null
  heightIn: number
  weightLb: number
  goal: string
  liftingDays: number
  stepsLevel: string
  constraints: string
  dislikes: string
  wakeTime: string
  lunchTime: string
  dinnerTime: string
}

interface Preferences {
  id: string
  eatingPattern: string
  dislikesDetected: string
  preferredCuisines: string
  timeToCook: string
  budget: string | null
  coachingNotes: string
}

interface DailyTargets {
  calories: number
  protein: number
  carbs: number
  fat: number
}

export default function ProfilePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [preferences, setPreferences] = useState<Preferences | null>(null)
  const [targets, setTargets] = useState<DailyTargets | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Profile>>({})

  useEffect(() => {
    if (status === 'loading') return

    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }

    if (session?.user?.id) {
      loadProfile(session.user.id)
    }
  }, [session, status, router])

  const loadProfile = async (userId: string) => {
    try {
      const [profileRes, preferencesRes, targetsRes] = await Promise.all([
        fetch(`/api/profile?userId=${userId}`),
        fetch(`/api/preferences?userId=${userId}`),
        fetch(`/api/daily-targets?userId=${userId}`)
      ])

      if (profileRes.ok) {
        const profileData = await profileRes.json()
        setProfile(profileData)

        // Calculate current targets based on profile
        if (profileData) {
          const calculatedTargets = calculateTargets(
            profileData.heightIn,
            profileData.weightLb,
            profileData.age || 27, // Default to 27 if age is null
            profileData.sex,
            profileData.goal,
            profileData.liftingDays,
            profileData.stepsLevel
          )
          setTargets(calculatedTargets)
        }
      }

      if (preferencesRes.ok) {
        const preferencesData = await preferencesRes.json()
        setPreferences(preferencesData)
      }

    } catch (error) {
      console.error('Failed to load profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateProfile = async (updatedProfile: Partial<Profile>) => {
    if (!session?.user?.id) return

    setSaving(true)
    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.user.id,
          ...updatedProfile
        })
      })

      if (response.ok) {
        await loadProfile(session.user.id)
        setEditing(false)
      }
    } catch (error) {
      console.error('Failed to update profile:', error)
    } finally {
      setSaving(false)
    }
  }

  const getGoalDescription = (goal: string) => {
    switch (goal) {
      case 'cut': return 'Fat Loss (-300 calories/day)'
      case 'recomp': return 'Body Recomposition (+100 calories/day)'
      case 'lean_bulk': return 'Lean Muscle Gain (+250 calories/day)'
      default: return goal
    }
  }

  const getStepsDescription = (level: string) => {
    switch (level) {
      case 'low': return 'Low (< 5,000 steps/day)'
      case 'med': return 'Medium (5,000-10,000 steps/day)'
      case 'high': return 'High (> 10,000 steps/day)'
      default: return level
    }
  }

  const formatHeight = (heightIn: number) => {
    const feet = Math.floor(heightIn / 12)
    const inches = heightIn % 12
    return `${feet}'${inches}"`
  }

  const parseConstraints = (constraintsStr: string) => {
    try {
      return JSON.parse(constraintsStr) as string[]
    } catch {
      return []
    }
  }

  const parsePreferencesList = (str: string) => {
    try {
      return JSON.parse(str) as string[]
    } catch {
      return []
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your profile...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Your Profile</h1>
            <nav className="flex items-center space-x-6">
              <a href="/dashboard" className="text-gray-600 hover:text-gray-900">Dashboard</a>
              <a href="/meals" className="text-gray-600 hover:text-gray-900">Meals</a>
              <a href="/reminders" className="text-gray-600 hover:text-gray-900">Reminders</a>
              {session?.user && (
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-600">Hello, {session.user.name}</span>
                </div>
              )}
            </nav>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Profile Overview */}
        {profile && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Profile Information</h2>
              {editing ? (
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      setEditing(false)
                      setEditForm({})
                    }}
                    disabled={saving}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => updateProfile(editForm)}
                    disabled={saving}
                    className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setEditing(true)
                    setEditForm(profile)
                  }}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                  Edit Profile
                </button>
              )}
            </div>

            {editing ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Info - Editable */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Sex</label>
                    <select
                      value={editForm.sex || profile.sex}
                      onChange={(e) => setEditForm(prev => ({ ...prev, sex: e.target.value }))}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Age</label>
                    <input
                      type="number"
                      value={editForm.age ?? profile.age ?? ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, age: e.target.value ? parseInt(e.target.value) : null }))}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      min="13"
                      max="100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Height (inches)</label>
                    <input
                      type="number"
                      value={editForm.heightIn ?? profile.heightIn}
                      onChange={(e) => setEditForm(prev => ({ ...prev, heightIn: parseInt(e.target.value) }))}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      min="36"
                      max="96"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Weight (lbs)</label>
                    <input
                      type="number"
                      value={editForm.weightLb ?? profile.weightLb}
                      onChange={(e) => setEditForm(prev => ({ ...prev, weightLb: parseInt(e.target.value) }))}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      min="50"
                      max="500"
                    />
                  </div>
                </div>

                {/* Goals & Activity - Editable */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Goal</label>
                    <select
                      value={editForm.goal || profile.goal}
                      onChange={(e) => setEditForm(prev => ({ ...prev, goal: e.target.value }))}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="cut">Fat Loss (-300 calories/day)</option>
                      <option value="recomp">Body Recomposition (+100 calories/day)</option>
                      <option value="lean_bulk">Lean Muscle Gain (+250 calories/day)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Lifting Days</label>
                    <input
                      type="number"
                      value={editForm.liftingDays ?? profile.liftingDays}
                      onChange={(e) => setEditForm(prev => ({ ...prev, liftingDays: parseInt(e.target.value) }))}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      min="0"
                      max="7"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Daily Steps</label>
                    <select
                      value={editForm.stepsLevel || profile.stepsLevel}
                      onChange={(e) => setEditForm(prev => ({ ...prev, stepsLevel: e.target.value }))}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="low">Low (&lt; 5,000 steps/day)</option>
                      <option value="med">Medium (5,000-10,000 steps/day)</option>
                      <option value="high">High (&gt; 10,000 steps/day)</option>
                    </select>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Info - Display */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Sex</label>
                    <p className="mt-1 text-sm text-gray-900 capitalize">{profile.sex}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Age</label>
                    <p className="mt-1 text-sm text-gray-900">{profile.age || 'Not specified'} years old</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Height</label>
                    <p className="mt-1 text-sm text-gray-900">{formatHeight(profile.heightIn)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Weight</label>
                    <p className="mt-1 text-sm text-gray-900">{profile.weightLb} lbs</p>
                  </div>
                </div>

                {/* Goals & Activity - Display */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Goal</label>
                    <p className="mt-1 text-sm text-gray-900">{getGoalDescription(profile.goal)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Lifting Days</label>
                    <p className="mt-1 text-sm text-gray-900">{profile.liftingDays} days per week</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Daily Steps</label>
                    <p className="mt-1 text-sm text-gray-900">{getStepsDescription(profile.stepsLevel)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Dietary Info */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Dietary Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Dietary Constraints</label>
                  <div className="mt-1">
                    {parseConstraints(profile.constraints).length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {parseConstraints(profile.constraints).map((constraint, index) => (
                          <span key={index} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {constraint}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">None specified</p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Dislikes</label>
                  <p className="mt-1 text-sm text-gray-900">{profile.dislikes || 'None specified'}</p>
                </div>
              </div>
            </div>

            {/* Meal Times */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Meal Schedule</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Wake Time</label>
                  <p className="mt-1 text-sm text-gray-900">{profile.wakeTime}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Lunch Time</label>
                  <p className="mt-1 text-sm text-gray-900">{profile.lunchTime}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Dinner Time</label>
                  <p className="mt-1 text-sm text-gray-900">{profile.dinnerTime}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Nutrition Plan */}
        {targets && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Your Personalized Nutrition Plan</h2>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{targets.calories}</div>
                <div className="text-sm text-blue-800">Daily Calories</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{targets.protein}g</div>
                <div className="text-sm text-green-800">Protein</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{targets.carbs}g</div>
                <div className="text-sm text-yellow-800">Carbohydrates</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{targets.fat}g</div>
                <div className="text-sm text-purple-800">Fat</div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-2">How we calculated your plan:</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Based on Mifflin-St Jeor equation for metabolic rate</li>
                <li>• Adjusted for your activity level and lifting frequency</li>
                <li>• Protein optimized for {profile?.goal === 'cut' ? 'muscle preservation during fat loss' : profile?.goal === 'lean_bulk' ? 'muscle building' : 'body recomposition'}</li>
                <li>• Fat set at 0.35g per lb of body weight for hormone optimization</li>
                <li>• Remaining calories filled with carbohydrates for energy</li>
              </ul>
            </div>
          </div>
        )}

        {/* Eating Preferences */}
        {preferences && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Eating Preferences</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">Eating Pattern</label>
                <p className="mt-1 text-sm text-gray-900 capitalize">{preferences.eatingPattern.replace('_', ' ')}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Time to Cook</label>
                <p className="mt-1 text-sm text-gray-900">{preferences.timeToCook}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Budget</label>
                <p className="mt-1 text-sm text-gray-900 capitalize">{preferences.budget || 'Not specified'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Preferred Cuisines</label>
                <div className="mt-1">
                  {parsePreferencesList(preferences.preferredCuisines).length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {parsePreferencesList(preferences.preferredCuisines).map((cuisine, index) => (
                        <span key={index} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {cuisine}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">None specified</p>
                  )}
                </div>
              </div>
            </div>

            {preferences.coachingNotes && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <label className="block text-sm font-medium text-gray-700">AI Coaching Notes</label>
                <p className="mt-1 text-sm text-gray-900">{preferences.coachingNotes}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}