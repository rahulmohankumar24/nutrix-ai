'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { Restaurant, MacroProgress, OrderRecommendation } from '@/lib/types'

export default function DashboardPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [userId, setUserId] = useState<string | null>(null)
  const [macros, setMacros] = useState<MacroProgress | null>(null)
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null)
  const [knownRestaurants, setKnownRestaurants] = useState<Restaurant[]>([])
  const [unknownRestaurants, setUnknownRestaurants] = useState<Restaurant[]>([])
  const [recommendations, setRecommendations] = useState<OrderRecommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [locationPermission, setLocationPermission] = useState<'pending' | 'granted' | 'denied'>('pending')

  useEffect(() => {
    if (status === 'loading') return

    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }

    if (session?.user?.id) {
      setUserId(session.user.id)

      // Load macro progress
      loadMacroProgress(session.user.id)

      // Check for stored location
      const storedLat = localStorage.getItem('userLat')
      const storedLng = localStorage.getItem('userLng')

      if (storedLat && storedLng) {
        const coords = { lat: parseFloat(storedLat), lng: parseFloat(storedLng) }
        setLocation(coords)
        setLocationPermission('granted')
        loadNearbyRestaurants(coords)
      } else {
        requestLocation()
      }
    }

    setLoading(false)
  }, [session, status, router])

  const loadMacroProgress = async (userId: string) => {
    try {
      const response = await fetch(`/api/macro-progress?userId=${userId}`)
      if (response.ok) {
        const data = await response.json()
        setMacros(data)
      }
    } catch (error) {
      console.error('Failed to load macro progress:', error)
    }
  }

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationPermission('denied')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        }
        setLocation(coords)
        setLocationPermission('granted')

        // Store location
        localStorage.setItem('userLat', coords.lat.toString())
        localStorage.setItem('userLng', coords.lng.toString())

        loadNearbyRestaurants(coords)
      },
      (error) => {
        console.error('Geolocation error:', error)
        setLocationPermission('denied')
      }
    )
  }

  const loadNearbyRestaurants = async (coords: {lat: number, lng: number}) => {
    try {
      const response = await fetch(`/api/nearby?lat=${coords.lat}&lng=${coords.lng}`)
      if (response.ok) {
        const data = await response.json()
        setKnownRestaurants(data.knownChains)
        setUnknownRestaurants(data.unknownRestaurants)

        // Load recommendations for known restaurants
        if (userId && data.knownChains.length > 0) {
          loadRecommendations(userId, data.knownChains)
        }
      }
    } catch (error) {
      console.error('Failed to load nearby restaurants:', error)
    }
  }

  const loadRecommendations = async (userId: string, restaurants: Restaurant[]) => {
    try {
      const response = await fetch('/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, restaurants })
      })
      if (response.ok) {
        const data = await response.json()
        setRecommendations(data.recommendations)
      }
    } catch (error) {
      console.error('Failed to load recommendations:', error)
    }
  }

  const openDeliveryApp = (restaurant: string, keywords: string) => {
    const searchQuery = encodeURIComponent(`${restaurant} ${keywords}`)
    // Try DoorDash first, fallback to Google search
    const doordashUrl = `https://www.doordash.com/store-search/?query=${searchQuery}`
    window.open(doordashUrl, '_blank')
  }

  const navigateToRestaurant = (restaurant: Restaurant) => {
    // Store restaurant data in localStorage for the restaurant page
    localStorage.setItem(`restaurant_${restaurant.id}`, JSON.stringify(restaurant))
    router.push(`/restaurant/${restaurant.id}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-2 border-blue-500 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-400 text-sm">Loading your nutrition dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="glass border-b border-gray-800/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">M</span>
              </div>
              <h1 className="text-xl font-semibold text-white">Mootra AI</h1>
            </div>
            <nav className="flex items-center space-x-6">
              <a href="/profile" className="text-gray-400 hover:text-white transition-colors text-sm">Profile</a>
              <a href="/meals" className="text-gray-400 hover:text-white transition-colors text-sm">Meals</a>
              <a href="/reminders" className="text-gray-400 hover:text-white transition-colors text-sm">Reminders</a>
              {session?.user && (
                <button
                  onClick={() => signOut({ callbackUrl: '/auth/signin' })}
                  className="text-xs text-gray-400 hover:text-white transition-colors"
                >
                  Sign out
                </button>
              )}
            </nav>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Macro Progress */}
        {macros && (
          <div className="glass rounded-2xl p-8 mb-8 card-hover">
            <h2 className="text-2xl font-bold text-white mb-6">Today's Progress</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {(['calories', 'protein', 'carbs', 'fat'] as const).map((macro, index) => {
                const colors = ['blue', 'green', 'yellow', 'purple']
                const color = colors[index]
                const percentage = Math.min(100, (macros.current[macro] / macros.targets[macro]) * 100)

                return (
                  <div key={macro} className="relative">
                    <div className="text-center">
                      <div className={`text-3xl font-bold text-${color}-400 mb-1`}>
                        {macros.remaining[macro]}
                      </div>
                      <div className="text-sm text-gray-400 capitalize mb-3">
                        remaining {macro} {macro === 'calories' ? '' : '(g)'}
                      </div>
                      <div className="relative">
                        <div className="w-full bg-gray-800 rounded-full h-2">
                          <div
                            className={`bg-gradient-to-r from-${color}-500 to-${color}-400 h-2 rounded-full transition-all duration-700 ease-out`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <div className="text-xs text-gray-500 mt-2">
                          {macros.current[macro]} / {macros.targets[macro]}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Location Status */}
        {locationPermission === 'pending' && (
          <div className="glass rounded-xl p-4 mb-6 border border-blue-500/30">
            <div className="flex items-center space-x-3">
              <div className="animate-pulse w-3 h-3 bg-blue-500 rounded-full"></div>
              <p className="text-blue-300 text-sm">Requesting location access to find nearby restaurants...</p>
            </div>
          </div>
        )}

        {locationPermission === 'denied' && (
          <div className="glass rounded-xl p-4 mb-6 border border-yellow-500/30">
            <div className="flex items-center justify-between">
              <p className="text-yellow-300 text-sm">Location access needed to find nearby restaurants.</p>
              <button
                onClick={requestLocation}
                className="bg-gradient-to-r from-yellow-600 to-yellow-500 text-white px-4 py-2 rounded-lg text-sm hover:from-yellow-700 hover:to-yellow-600 transition-all"
              >
                Enable Location
              </button>
            </div>
          </div>
        )}

        {/* Best Orders Right Now */}
        {recommendations.length > 0 && (
          <div className="glass rounded-2xl p-8 mb-8 card-hover">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
                <span className="text-white text-sm">🎯</span>
              </div>
              <h2 className="text-2xl font-bold text-white">AI Recommendations</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recommendations.slice(0, 6).map((rec, index) => (
                <div key={index} className="bg-gray-900/50 rounded-xl p-5 border border-gray-800/50 hover:border-gray-700/50 transition-all card-hover">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-white text-sm">{rec.restaurant.name}</h3>
                    <span className="text-xs text-gray-400">{rec.restaurant.distance.toFixed(1)} mi</span>
                  </div>
                  <p className="text-sm font-medium text-blue-400 mb-2">{rec.template.title}</p>
                  <p className="text-xs text-gray-400 mb-4 line-clamp-2">{rec.template.description}</p>
                  <div className="grid grid-cols-4 gap-3 text-xs text-center mb-4">
                    <div className="bg-gray-800/50 rounded-lg py-2">
                      <div className="font-semibold text-white">{rec.template.calories}</div>
                      <div className="text-gray-500">cal</div>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg py-2">
                      <div className="font-semibold text-green-400">{rec.template.protein}g</div>
                      <div className="text-gray-500">protein</div>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg py-2">
                      <div className="font-semibold text-yellow-400">{rec.template.carbs}g</div>
                      <div className="text-gray-500">carbs</div>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg py-2">
                      <div className="font-semibold text-purple-400">{rec.template.fat}g</div>
                      <div className="text-gray-500">fat</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 mb-4">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <p className="text-xs text-green-400">{rec.explanation}</p>
                  </div>
                  <div className="flex space-x-3">
                    <button className="flex-1 bg-gray-700/50 text-gray-300 text-xs py-2.5 rounded-lg hover:bg-gray-700 transition-all">
                      Add to Log
                    </button>
                    <button
                      onClick={() => openDeliveryApp(rec.restaurant.name, rec.template.keywordsForDeliverySearch)}
                      className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 text-white text-xs py-2.5 rounded-lg hover:from-blue-700 hover:to-blue-600 transition-all"
                    >
                      Order Now
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Restaurants Nearby */}
        {(knownRestaurants.length > 0 || unknownRestaurants.length > 0) && (
          <div className="glass rounded-2xl p-8">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
                <span className="text-white text-sm">🍽️</span>
              </div>
              <h2 className="text-2xl font-bold text-white">Restaurants Nearby</h2>
            </div>

            {/* Known Chains */}
            {knownRestaurants.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center space-x-2 mb-4">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <h3 className="text-lg font-semibold text-green-400">
                    AI-Enhanced Restaurants
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {knownRestaurants.map(restaurant => {
                    const restaurantRecommendations = recommendations.filter(rec => rec.restaurant.id === restaurant.id)
                    return (
                      <div
                        key={restaurant.id}
                        className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 rounded-xl p-5 border border-green-500/30 cursor-pointer hover:border-green-500/50 transition-all card-hover group"
                        onClick={() => navigateToRestaurant(restaurant)}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-white group-hover:text-green-300 transition-colors">{restaurant.name}</h4>
                          <span className="text-xs text-gray-400">{restaurant.distance.toFixed(1)} mi</span>
                        </div>
                        <p className="text-xs text-green-400 mb-3">
                          {restaurantRecommendations.length} AI-analyzed meal{restaurantRecommendations.length !== 1 ? 's' : ''}
                        </p>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-400">Click for insights</span>
                          <div className="text-green-400 group-hover:translate-x-1 transition-transform">→</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Unknown Restaurants */}
            {unknownRestaurants.length > 0 && (
              <div>
                <div className="flex items-center space-x-2 mb-4">
                  <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                  <h3 className="text-lg font-semibold text-gray-400">
                    Other Restaurants
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {unknownRestaurants.slice(0, 8).map(restaurant => (
                    <div key={restaurant.id} className="bg-gray-900/30 rounded-lg p-4 border border-gray-800/50">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-gray-300 text-sm">{restaurant.name}</h4>
                        <span className="text-xs text-gray-500">{restaurant.distance.toFixed(1)} mi</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">Limited nutrition data</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {locationPermission === 'granted' && knownRestaurants.length === 0 && unknownRestaurants.length === 0 && (
          <div className="glass rounded-2xl p-16 text-center">
            <div className="text-gray-600 text-6xl mb-6">🍽️</div>
            <h3 className="text-xl font-semibold text-white mb-3">No restaurants found nearby</h3>
            <p className="text-gray-400">Try expanding your search radius or check your location.</p>
          </div>
        )}
      </div>
    </div>
  )
}