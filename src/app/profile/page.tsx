"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"

export default function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false)
  const [profile, setProfile] = useState({
    name: "Sarah Johnson",
    email: "sarah@example.com",
    height: "5'6\"",
    weight: "145 lbs",
    activityLevel: "Moderately Active",
    age: "28",
    goal: "Maintain Weight",
  })

  const goals = {
    calories: 2700,
    protein: 140,
    carbs: 280,
    fat: 75,
  }

  const weeklyStats = {
    avgCalories: 2450,
    avgProtein: 125,
    daysOnTrack: 5,
    streak: 12,
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="px-6 py-10">
        {/* Profile Header */}
        <div className="flex items-center gap-4 mb-10">
          <div className="h-20 w-20 rounded-full bg-neutral-100 flex items-center justify-center text-3xl font-semibold text-neutral-600">
            {profile.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{profile.name}</h1>
            <p className="text-sm text-muted-foreground">{profile.email}</p>
          </div>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="ml-auto text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {isEditing ? "Save" : "Edit Profile"}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Personal Information */}
          <div className="rounded-xl border border-neutral-200 p-6 h-[280px]">
            <h2 className="text-sm font-medium text-foreground mb-5">Personal Information</h2>
            <div className="space-y-3">
              {[
                { label: "Age", key: "age" as const },
                { label: "Height", key: "height" as const },
                { label: "Weight", key: "weight" as const },
                { label: "Activity Level", key: "activityLevel" as const },
                { label: "Goal", key: "goal" as const },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                  {isEditing ? (
                    <Input
                      value={profile[item.key]}
                      onChange={(e) => setProfile({ ...profile, [item.key]: e.target.value })}
                      className="w-40 h-8 text-sm text-right"
                    />
                  ) : (
                    <span className="text-sm font-medium">{profile[item.key]}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Daily Nutrition Goals */}
          <div className="rounded-xl border border-neutral-200 p-6 h-[280px]">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-medium text-foreground">Daily Nutrition Goals</h2>
              <button className="text-sm text-muted-foreground hover:text-foreground transition-colors">Adjust</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Calories", value: goals.calories, unit: "kcal", color: "bg-neutral-50" },
                { label: "Protein", value: goals.protein, unit: "g", color: "bg-green-50" },
                { label: "Carbs", value: goals.carbs, unit: "g", color: "bg-neutral-50" },
                { label: "Fat", value: goals.fat, unit: "g", color: "bg-neutral-50" },
              ].map((goal) => (
                <div key={goal.label} className={`${goal.color} rounded-lg p-4`}>
                  <p className="text-2xl font-semibold text-foreground">
                    {goal.value}
                    <span className="text-sm font-normal text-muted-foreground ml-1">{goal.unit}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{goal.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-neutral-200 p-6 h-[280px]">
            <h2 className="text-sm font-medium text-foreground mb-5">Weekly Summary</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-neutral-50 rounded-lg p-4">
                <p className="text-2xl font-semibold text-foreground">{weeklyStats.avgCalories}</p>
                <p className="text-xs text-muted-foreground mt-1">Avg. Calories</p>
              </div>
              <div className="bg-neutral-50 rounded-lg p-4">
                <p className="text-2xl font-semibold text-foreground">{weeklyStats.avgProtein}g</p>
                <p className="text-xs text-muted-foreground mt-1">Avg. Protein</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-2xl font-semibold text-foreground">{weeklyStats.daysOnTrack}/7</p>
                <p className="text-xs text-muted-foreground mt-1">Days On Track</p>
              </div>
              <div className="bg-neutral-50 rounded-lg p-4">
                <p className="text-2xl font-semibold text-foreground">{weeklyStats.streak}</p>
                <p className="text-xs text-muted-foreground mt-1">Day Streak</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-neutral-200 p-6 h-[280px]">
            <h2 className="text-sm font-medium text-foreground mb-5">Account & Settings</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Email</span>
                <span className="text-sm font-medium">{profile.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Password</span>
                <button className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Change
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Notifications</span>
                <span className="text-sm font-medium">Enabled</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Units</span>
                <span className="text-sm font-medium">Imperial</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
                <span className="text-sm text-muted-foreground">Sign out</span>
                <button className="text-sm text-red-500 hover:text-red-600 transition-colors">Sign Out</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
