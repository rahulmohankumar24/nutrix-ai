'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Restaurant } from '@/lib/types'

export default function RestaurantsPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null)
  const [knownRestaurants, setKnownRestaurants] = useState<Restaurant[]>([])
  const [unknownRestaurants, setUnknownRestaurants] = useState<Restaurant[]>([])
  const [loading, setLoading] = useState(true)
  const [locationPermission, setLocationPermission] = useState<'pending' | 'granted' | 'denied'>('pending')

  useEffect(() => {
    if (status === 'loading') return

    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }

    if (session?.user?.id) {
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

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationPermission('denied')
      setLoading(false)
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

        // Store location for future visits
        localStorage.setItem('userLat', coords.lat.toString())
        localStorage.setItem('userLng', coords.lng.toString())

        loadNearbyRestaurants(coords)
      },
      (error) => {
        console.error('Location error:', error)
        setLocationPermission('denied')
        setLoading(false)
      }
    )
  }

  const loadNearbyRestaurants = async (coords: {lat: number, lng: number}) => {
    try {
      const response = await fetch('/api/nearby', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: coords.lat,
          lng: coords.lng,
          limit: 50
        })
      })

      if (response.ok) {
        const data = await response.json()

        const known = data.restaurants?.filter((r: Restaurant) => r.isKnown) || []
        const unknown = data.restaurants?.filter((r: Restaurant) => !r.isKnown) || []

        setKnownRestaurants(known)
        setUnknownRestaurants(unknown)

      }
    } catch (error) {
      console.error('Failed to load restaurants:', error)
    } finally {
      setLoading(false)
    }
  }


  const handleRestaurantClick = (restaurant: Restaurant) => {
    localStorage.setItem(`restaurant_${restaurant.id}`, JSON.stringify(restaurant))
    router.push(`/restaurant/${restaurant.id}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-2 border-blue-500 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-400 text-sm">Finding nearby restaurants...</p>
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
              <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
                <span className="text-white text-sm">🍽️</span>
              </div>
              <h1 className="text-xl font-semibold text-white">Find Food</h1>
            </div>
            <nav className="flex items-center space-x-6">
              <Link href="/dashboard" className="text-gray-400 hover:text-white transition-colors text-sm">
                Dashboard
              </Link>
              <Link href="/profile" className="text-gray-400 hover:text-white transition-colors text-sm">
                Profile
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
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


        {/* Restaurant Categories */}
        {knownRestaurants.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                <span className="text-white text-sm">⭐</span>
              </div>
              <h2 className="text-2xl font-bold text-white">Restaurants with Menu Data</h2>
              <span className="text-gray-400 text-sm">({knownRestaurants.length} nearby)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {knownRestaurants.map((restaurant) => (
                <div
                  key={restaurant.id}
                  onClick={() => handleRestaurantClick(restaurant)}
                  className="glass rounded-xl p-6 card-hover cursor-pointer group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-white text-lg group-hover:text-blue-300 transition-colors">
                        {restaurant.name}
                      </h3>
                      <div className="flex items-center space-x-2 mt-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <p className="text-gray-400 text-sm">{restaurant.distance.toFixed(1)} miles away</p>
                      </div>
                    </div>
                    <div className="text-blue-400 group-hover:text-blue-300 transition-colors">
                      →
                    </div>
                  </div>

                  {restaurant.tags && Object.keys(restaurant.tags).length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(restaurant.tags).slice(0, 3).map(([key, value], index) => (
                        <span key={index} className="px-2 py-1 bg-blue-900/30 text-blue-300 text-xs rounded-md border border-blue-500/30">
                          {key}: {value}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Other Nearby Restaurants */}
        {unknownRestaurants.length > 0 && (
          <div>
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-8 h-8 bg-gradient-to-r from-gray-500 to-gray-400 rounded-lg flex items-center justify-center">
                <span className="text-white text-sm">🏪</span>
              </div>
              <h2 className="text-2xl font-bold text-white">Other Nearby Options</h2>
              <span className="text-gray-400 text-sm">({unknownRestaurants.length} found)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {unknownRestaurants.slice(0, 12).map((restaurant) => (
                <div key={restaurant.id} className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
                  <h3 className="font-medium text-white text-sm mb-2">{restaurant.name}</h3>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">{restaurant.distance.toFixed(1)} miles</span>
                    <span className="text-gray-500">No menu data</span>
                  </div>
                </div>
              ))}
            </div>

            {unknownRestaurants.length > 12 && (
              <div className="text-center mt-6">
                <p className="text-gray-400 text-sm">
                  + {unknownRestaurants.length - 12} more restaurants nearby
                </p>
              </div>
            )}
          </div>
        )}

        {/* No restaurants found */}
        {knownRestaurants.length === 0 && unknownRestaurants.length === 0 && locationPermission === 'granted' && (
          <div className="glass rounded-2xl p-16 text-center">
            <div className="text-gray-600 text-6xl mb-6">🍽️</div>
            <h3 className="text-xl font-semibold text-white mb-3">No restaurants found nearby</h3>
            <p className="text-gray-400">Try enabling location access or check your internet connection.</p>
          </div>
        )}
      </div>
    </div>
  )
}