"use client"
import { ArrowRight, Star } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"

interface ApiRestaurant {
  id: string
  name: string
  distance: number
  tags?: Record<string, string>
  isKnown: boolean
}

interface Restaurant {
  id: string
  name: string
  distance: string
  rating: number
  type: string
  matchScore: number
  goalReason: string
}

interface FoodSuggestionsCardProps {
  onRestaurantClick?: (restaurant: Restaurant) => void
}

export function FoodSuggestionsCard({ onRestaurantClick }: FoodSuggestionsCardProps) {
  const router = useRouter()
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadNearbyRestaurants()
  }, [])

  const loadNearbyRestaurants = async () => {
    try {
      // Get location from localStorage or use default
      const storedLat = localStorage.getItem('userLat')
      const storedLng = localStorage.getItem('userLng')

      let lat = storedLat ? parseFloat(storedLat) : 37.7749 // Default SF
      let lng = storedLng ? parseFloat(storedLng) : -122.4194

      // Try to get current location if not stored
      if (!storedLat || !storedLng) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject)
          })
          lat = position.coords.latitude
          lng = position.coords.longitude
          localStorage.setItem('userLat', lat.toString())
          localStorage.setItem('userLng', lng.toString())
        } catch (err) {
          console.log('Using default location')
        }
      }

      const response = await fetch('/api/nearby', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng, limit: 50 })
      })

      if (!response.ok) throw new Error('Failed to fetch restaurants')

      const data = await response.json()
      const apiRestaurants = data.restaurants || []

      // Filter for known restaurants and convert to display format
      const displayRestaurants = apiRestaurants
        .filter((r: ApiRestaurant) => r.isKnown)
        .slice(0, 6)
        .map((apiRest: ApiRestaurant, idx: number) => ({
          id: apiRest.id,
          name: apiRest.name,
          distance: `${apiRest.distance.toFixed(1)} mi`,
          rating: 4.5 + (Math.random() * 0.5), // Mock ratings for now
          type: apiRest.tags?.cuisine || 'Restaurant',
          matchScore: Math.max(70, 95 - (idx * 4)),
          goalReason: getGoalReason(apiRest.name, apiRest.tags?.cuisine)
        }))

      setRestaurants(displayRestaurants)
    } catch (error) {
      console.error('Failed to load nearby restaurants:', error)
      // Keep empty array on error
    } finally {
      setLoading(false)
    }
  }

  const getGoalReason = (name: string, cuisine?: string) => {
    const nameLower = name.toLowerCase()
    if (nameLower.includes('chipotle') || nameLower.includes('cava')) return 'High protein bowls'
    if (nameLower.includes('sweetgreen') || nameLower.includes('salad')) return 'Fresh salads'
    if (cuisine?.toLowerCase().includes('mediterranean')) return 'Lean proteins'
    if (cuisine?.toLowerCase().includes('asian')) return 'Balanced nutrition'
    return 'Healthy options'
  }

  const handleRestaurantClick = (restaurant: Restaurant) => {
    // Store restaurant data in localStorage for the detail page
    localStorage.setItem(`restaurant_${restaurant.id}`, JSON.stringify({
      id: restaurant.id,
      name: restaurant.name,
      distance: parseFloat(restaurant.distance),
      tags: { cuisine: restaurant.type },
      isKnown: true
    }))

    router.push(`/restaurant/${restaurant.id}`)
  }

  return (
    <div className="rounded-2xl bg-card border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Nearby Restaurants</h3>
        <button
          onClick={() => router.push('/restaurants')}
          className="text-sm font-medium text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
          View all <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
        </div>
      ) : restaurants.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground">No nearby restaurants found</p>
          <button
            onClick={() => router.push('/restaurants')}
            className="mt-2 text-sm text-primary hover:underline"
          >
            Browse all restaurants
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {restaurants.map((restaurant) => (
            <button
              key={restaurant.id}
              onClick={() => handleRestaurantClick(restaurant)}
              className="group flex flex-col p-4 rounded-xl border border-border hover:border-primary/30 transition-all text-left"
            >
              <div className="flex items-center justify-between w-full mb-1.5">
                <h4 className="font-medium text-foreground text-sm">{restaurant.name}</h4>
                <span className="text-xs text-primary font-semibold">{restaurant.matchScore}% match</span>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-0.5">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  {restaurant.rating.toFixed(1)}
                </span>
                <span>•</span>
                <span>{restaurant.distance}</span>
              </div>

              <p className="text-xs text-muted-foreground mt-2">{restaurant.goalReason}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
