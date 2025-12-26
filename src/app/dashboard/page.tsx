'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
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
  const [selectedRestaurant, setSelectedRestaurant] = useState<string | null>(null)

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your nutrition dashboard...</p>
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
            <h1 className="text-2xl font-bold text-gray-900">Nutrix AI</h1>
            <nav className="flex items-center space-x-6">
              <a href="/profile" className="text-gray-600 hover:text-gray-900">Profile</a>
              <a href="/meals" className="text-gray-600 hover:text-gray-900">Meals</a>
              <a href="/reminders" className="text-gray-600 hover:text-gray-900">Reminders</a>
              {session?.user && (
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-600">Hello, {session.user.name}</span>
                  <button
                    onClick={() => signOut({ callbackUrl: '/auth/signin' })}
                    className="text-sm text-gray-600 hover:text-gray-900"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </nav>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Macro Progress */}
        {macros && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Today's Progress</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {(['calories', 'protein', 'carbs', 'fat'] as const).map(macro => (
                <div key={macro} className="text-center">
                  <div className="text-2xl font-bold text-gray-900">
                    {macros.remaining[macro]}
                  </div>
                  <div className="text-sm text-gray-500">
                    remaining {macro} {macro === 'calories' ? '' : '(g)'}
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{
                        width: `${Math.min(100, (macros.current[macro] / macros.targets[macro]) * 100)}%`
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Location Status */}
        {locationPermission === 'pending' && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
            <p className="text-blue-800">Requesting location access to find nearby restaurants...</p>
          </div>
        )}

        {locationPermission === 'denied' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-6">
            <div className="flex items-center justify-between">
              <p className="text-yellow-800">Location access needed to find nearby restaurants.</p>
              <button
                onClick={requestLocation}
                className="bg-yellow-600 text-white px-4 py-2 rounded-md text-sm hover:bg-yellow-700"
              >
                Enable Location
              </button>
            </div>
          </div>
        )}

        {/* Best Orders Right Now */}
        {recommendations.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">🎯 Best Orders Near You Right Now</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recommendations.slice(0, 6).map((rec, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium">{rec.restaurant.name}</h3>
                    <span className="text-sm text-gray-500">{rec.restaurant.distance} mi</span>
                  </div>
                  <p className="text-sm font-medium text-blue-600 mb-2">{rec.template.title}</p>
                  <p className="text-xs text-gray-600 mb-3">{rec.template.description}</p>
                  <div className="grid grid-cols-4 gap-2 text-xs text-center mb-3">
                    <div>
                      <div className="font-medium">{rec.template.calories}</div>
                      <div className="text-gray-500">cal</div>
                    </div>
                    <div>
                      <div className="font-medium">{rec.template.protein}g</div>
                      <div className="text-gray-500">protein</div>
                    </div>
                    <div>
                      <div className="font-medium">{rec.template.carbs}g</div>
                      <div className="text-gray-500">carbs</div>
                    </div>
                    <div>
                      <div className="font-medium">{rec.template.fat}g</div>
                      <div className="text-gray-500">fat</div>
                    </div>
                  </div>
                  <p className="text-xs text-green-600 mb-3">✓ {rec.explanation}</p>
                  <div className="flex space-x-2">
                    <button className="flex-1 bg-gray-100 text-gray-700 text-xs py-2 rounded hover:bg-gray-200">
                      Log Meal
                    </button>
                    <button
                      onClick={() => openDeliveryApp(rec.restaurant.name, rec.template.keywordsForDeliverySearch)}
                      className="flex-1 bg-blue-600 text-white text-xs py-2 rounded hover:bg-blue-700"
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
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">🍽️ Restaurants Nearby</h2>

            {/* Known Chains */}
            {knownRestaurants.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-medium text-green-700 mb-3">
                  ✅ Macro-Known Restaurants (Recommended)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {knownRestaurants.map(restaurant => {
                    const restaurantRecommendations = recommendations.filter(rec => rec.restaurant.id === restaurant.id)
                    return (
                      <div key={restaurant.id} className="border border-green-200 bg-green-50 rounded-lg p-3 cursor-pointer hover:bg-green-100 transition-colors"
                           onClick={() => setSelectedRestaurant(restaurant.id === selectedRestaurant ? null : restaurant.id)}>
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-green-900">{restaurant.name}</h4>
                          <span className="text-sm text-green-600">{restaurant.distance} mi</span>
                        </div>
                        <p className="text-xs text-green-700 mt-1">
                          {restaurantRecommendations.length} meal option{restaurantRecommendations.length !== 1 ? 's' : ''} available
                        </p>
                        {selectedRestaurant === restaurant.id && (
                          <div className="mt-3 space-y-2">
                            {restaurantRecommendations.map((rec, index) => (
                              <div key={index} className="bg-white rounded-md p-3 border border-green-300">
                                <h5 className="font-medium text-green-900 text-sm">{rec.template.title}</h5>
                                <p className="text-xs text-green-700 mt-1">{rec.template.description}</p>
                                <div className="grid grid-cols-4 gap-1 text-xs text-center mt-2">
                                  <div>
                                    <div className="font-medium">{rec.template.calories}</div>
                                    <div className="text-green-600">cal</div>
                                  </div>
                                  <div>
                                    <div className="font-medium">{rec.template.protein}g</div>
                                    <div className="text-green-600">protein</div>
                                  </div>
                                  <div>
                                    <div className="font-medium">{rec.template.carbs}g</div>
                                    <div className="text-green-600">carbs</div>
                                  </div>
                                  <div>
                                    <div className="font-medium">{rec.template.fat}g</div>
                                    <div className="text-green-600">fat</div>
                                  </div>
                                </div>
                                <p className="text-xs text-green-600 mt-2">✓ {rec.explanation}</p>
                                <div className="flex space-x-2 mt-2">
                                  <button className="flex-1 bg-green-200 text-green-800 text-xs py-1 rounded hover:bg-green-300">
                                    Log Meal
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      openDeliveryApp(rec.restaurant.name, rec.template.keywordsForDeliverySearch)
                                    }}
                                    className="flex-1 bg-green-600 text-white text-xs py-1 rounded hover:bg-green-700"
                                  >
                                    Order Now
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Unknown Restaurants */}
            {unknownRestaurants.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-gray-700 mb-3">
                  ❓ Other Restaurants (Macros Unknown)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {unknownRestaurants.slice(0, 12).map(restaurant => (
                    <div key={restaurant.id} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-gray-900">{restaurant.name}</h4>
                        <span className="text-sm text-gray-500">{restaurant.distance} mi</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Use estimates for macros</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {locationPermission === 'granted' && knownRestaurants.length === 0 && unknownRestaurants.length === 0 && (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <div className="text-gray-400 text-6xl mb-4">🍽️</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No restaurants found nearby</h3>
            <p className="text-gray-500">Try expanding your search radius or check your location.</p>
          </div>
        )}
      </div>
    </div>
  )
}