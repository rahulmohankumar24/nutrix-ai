'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Reminder {
  id: string
  name: string
  timeOfDay: string
  enabled: boolean
}

export default function RemindersPage() {
  const router = useRouter()
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const storedUserId = localStorage.getItem('userId')
    if (!storedUserId) {
      router.push('/onboarding')
      return
    }
    setUserId(storedUserId)
    loadReminders(storedUserId)
  }, [])

  const loadReminders = async (userId: string) => {
    try {
      const response = await fetch(`/api/reminders?userId=${userId}`)
      if (response.ok) {
        const data = await response.json()
        setReminders(data.reminders)
      }
    } catch (error) {
      console.error('Failed to load reminders:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleReminder = async (reminderId: string, enabled: boolean) => {
    if (!userId) return

    try {
      const response = await fetch('/api/reminders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reminderId, enabled })
      })

      if (response.ok) {
        setReminders(reminders.map(reminder =>
          reminder.id === reminderId ? { ...reminder, enabled } : reminder
        ))
      }
    } catch (error) {
      console.error('Failed to update reminder:', error)
    }
  }

  const updateReminderTime = async (reminderId: string, timeOfDay: string) => {
    if (!userId) return

    try {
      const response = await fetch('/api/reminders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reminderId, timeOfDay })
      })

      if (response.ok) {
        setReminders(reminders.map(reminder =>
          reminder.id === reminderId ? { ...reminder, timeOfDay } : reminder
        ))
      }
    } catch (error) {
      console.error('Failed to update reminder time:', error)
    }
  }

  const getNextReminderText = () => {
    const enabledReminders = reminders.filter(r => r.enabled)
    if (enabledReminders.length === 0) return 'No reminders enabled'

    const now = new Date()
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

    const todayReminders = enabledReminders
      .filter(r => r.timeOfDay > currentTime)
      .sort((a, b) => a.timeOfDay.localeCompare(b.timeOfDay))

    if (todayReminders.length > 0) {
      const next = todayReminders[0]
      return `Next: ${next.name} at ${formatTime(next.timeOfDay)}`
    }

    // If no more reminders today, show tomorrow's first reminder
    const sortedReminders = enabledReminders.sort((a, b) => a.timeOfDay.localeCompare(b.timeOfDay))
    if (sortedReminders.length > 0) {
      const next = sortedReminders[0]
      return `Next: ${next.name} tomorrow at ${formatTime(next.timeOfDay)}`
    }

    return 'No upcoming reminders'
  }

  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(':').map(Number)
    const period = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Nutrition Reminders</h1>
            <nav className="flex space-x-6">
              <a href="/dashboard" className="text-gray-600 hover:text-gray-900">Dashboard</a>
              <a href="/meals" className="text-gray-600 hover:text-gray-900">Meals</a>
            </nav>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Next Reminder Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <div className="text-blue-600 text-2xl mr-3">⏰</div>
            <div>
              <h3 className="font-medium text-blue-900">Upcoming Reminder</h3>
              <p className="text-blue-700">{getNextReminderText()}</p>
            </div>
          </div>
        </div>

        {/* Reminder List */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Your Reminder Schedule</h2>
            <p className="text-gray-500 mt-1">
              Set reminders to help you stay on track with your nutrition goals throughout the day.
            </p>
          </div>

          <div className="divide-y divide-gray-200">
            {reminders.map((reminder) => (
              <div key={reminder.id} className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center">
                      <h3 className="text-lg font-medium text-gray-900 mr-4">
                        {reminder.name}
                      </h3>
                      <input
                        type="time"
                        value={reminder.timeOfDay}
                        onChange={(e) => updateReminderTime(reminder.id, e.target.value)}
                        className="border border-gray-300 rounded-md px-3 py-1 text-sm"
                        disabled={!reminder.enabled}
                      />
                    </div>
                    <p className="text-gray-500 mt-1">
                      {reminder.enabled
                        ? `Reminder set for ${formatTime(reminder.timeOfDay)}`
                        : 'Reminder disabled'
                      }
                    </p>
                  </div>
                  <div className="flex items-center">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={reminder.enabled}
                        onChange={(e) => toggleReminder(reminder.id, e.target.checked)}
                        className="sr-only"
                      />
                      <div className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${
                        reminder.enabled ? 'bg-blue-600' : 'bg-gray-200'
                      }`}>
                        <div className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                          reminder.enabled ? 'translate-x-5' : 'translate-x-0'
                        } mt-0.5 ml-0.5`} />
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mt-6">
          <div className="flex">
            <div className="text-yellow-600 text-xl mr-3">💡</div>
            <div>
              <h3 className="font-medium text-yellow-900 mb-2">About Reminders</h3>
              <ul className="text-yellow-800 space-y-1 text-sm">
                <li>• <strong>Morning Protein:</strong> Aim for 30-40g protein by mid-morning</li>
                <li>• <strong>Lunch Check-in:</strong> Ensure you're at 70-80g protein by afternoon</li>
                <li>• <strong>Evening Protein:</strong> Target 110-120g protein before dinner</li>
                <li>• <strong>Daily Close-out:</strong> Review and complete remaining macros</li>
              </ul>
              <p className="text-yellow-700 mt-3 text-sm">
                <strong>Note:</strong> In this MVP, reminders are stored in the database but push notifications
                are not implemented. You can view your next reminder time here.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}