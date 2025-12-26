'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Restaurant {
  brand: string
  count: number
}

export default function MealAdminPage() {
  const router = useRouter()
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [loading, setLoading] = useState(true)
  const [expandLoading, setExpandLoading] = useState<string | null>(null)
  const [results, setResults] = useState<{[key: string]: any}>({})

  useEffect(() => {
    loadRestaurants()
  }, [])

  const loadRestaurants = async () => {
    try {
      const response = await fetch('/api/restaurants-summary')
      if (response.ok) {
        const data = await response.json()
        setRestaurants(data.restaurants || [])
      }
    } catch (error) {
      console.error('Failed to load restaurants:', error)
    } finally {
      setLoading(false)
    }
  }

  const expandRestaurantMeals = async (restaurantBrand: string, method: 'rules' | 'ai') => {
    setExpandLoading(`${restaurantBrand}-${method}`)
    try {
      const endpoint = method === 'rules' ? '/api/expand-meals' : '/api/ai-meal-generator'
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantBrand
        })
      })

      if (response.ok) {
        const data = await response.json()
        setResults(prev => ({
          ...prev,
          [`${restaurantBrand}-${method}`]: data
        }))
        loadRestaurants() // Refresh counts
      }
    } catch (error) {
      console.error('Failed to expand meals:', error)
    } finally {
      setExpandLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-2 border-blue-500 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-400 text-sm">Loading restaurants...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black">
      <header className="glass border-b border-gray-800/50 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
                <span className="text-white text-sm">⚙️</span>
              </div>
              <h1 className="text-2xl font-bold text-white">Meal Database Admin</h1>
            </div>
            <nav className="flex items-center space-x-6">
              <a href="/dashboard" className="text-gray-400 hover:text-white transition-colors text-sm">Dashboard</a>
              <a href="/profile" className="text-gray-400 hover:text-white transition-colors text-sm">Profile</a>
            </nav>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="glass rounded-2xl p-8 mb-8">
          <h2 className="text-xl font-bold text-white mb-6">Restaurant Meal Database</h2>
          <p className="text-gray-400 mb-6">
            Expand meal options for restaurants using rule-based combinations or AI generation.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {restaurants.map((restaurant) => (
              <div key={restaurant.brand} className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-white capitalize">
                    {restaurant.brand.replace(/[_-]/g, ' ')}
                  </h3>
                  <span className="text-blue-400 text-sm">
                    {restaurant.count} meals
                  </span>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={() => expandRestaurantMeals(restaurant.brand, 'rules')}
                    disabled={expandLoading === `${restaurant.brand}-rules`}
                    className="w-full bg-green-600/20 text-green-400 border border-green-500/30 py-2 px-4 rounded-lg hover:bg-green-600/30 disabled:opacity-50 transition-all text-sm"
                  >
                    {expandLoading === `${restaurant.brand}-rules` ? 'Generating...' : '🔧 Rule-Based Expansion'}
                  </button>

                  <button
                    onClick={() => expandRestaurantMeals(restaurant.brand, 'ai')}
                    disabled={expandLoading === `${restaurant.brand}-ai`}
                    className="w-full bg-purple-600/20 text-purple-400 border border-purple-500/30 py-2 px-4 rounded-lg hover:bg-purple-600/30 disabled:opacity-50 transition-all text-sm"
                  >
                    {expandLoading === `${restaurant.brand}-ai` ? 'Generating...' : '🤖 AI Generation'}
                  </button>
                </div>

                {/* Show results */}
                {(results[`${restaurant.brand}-rules`] || results[`${restaurant.brand}-ai`]) && (
                  <div className="mt-4 space-y-2">
                    {results[`${restaurant.brand}-rules`] && (
                      <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3">
                        <p className="text-green-400 text-xs">
                          ✅ Rules: +{results[`${restaurant.brand}-rules`].newMeals?.length || 0} meals
                        </p>
                      </div>
                    )}
                    {results[`${restaurant.brand}-ai`] && (
                      <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-3">
                        <p className="text-purple-400 text-xs">
                          🤖 AI: +{results[`${restaurant.brand}-ai`].newMeals?.length || 0} meals
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {restaurants.length === 0 && (
            <div className="text-center py-12">
              <div className="text-gray-600 text-6xl mb-4">🍽️</div>
              <h3 className="text-xl font-semibold text-white mb-3">No restaurants found</h3>
              <p className="text-gray-400">Run the database seed first to populate restaurants.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}