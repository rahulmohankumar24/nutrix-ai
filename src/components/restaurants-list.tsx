"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { Star, MapPin, Clock, Search, SlidersHorizontal, ChevronDown, ArrowRight } from "lucide-react"

interface MenuItem {
  name: string
  calories: number
  protein: number
  price: string
}

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
  reviewCount: number
  type: string
  priceRange: string
  matchScore: number
  goalReason: string
  hours: string
  address: string
  topItems: MenuItem[]
}

const mockRestaurants: Restaurant[] = [
  {
    id: "1",
    name: "Fresh & Green",
    distance: "0.3 mi",
    rating: 4.8,
    reviewCount: 342,
    type: "Salads & Bowls",
    priceRange: "$$",
    matchScore: 95,
    goalReason: "High protein salads to help hit your 120g daily goal",
    hours: "Open until 9pm",
    address: "123 Main St",
    topItems: [
      { name: "Grilled Chicken Power Bowl", calories: 520, protein: 45, price: "$14" },
      { name: "Salmon Avocado Salad", calories: 480, protein: 38, price: "$16" },
      { name: "Protein Green Smoothie", calories: 280, protein: 24, price: "$9" },
    ],
  },
  {
    id: "2",
    name: "Protein Kitchen",
    distance: "0.5 mi",
    rating: 4.6,
    reviewCount: 218,
    type: "Healthy Bowls",
    priceRange: "$$",
    matchScore: 88,
    goalReason: "Low carb options perfect for staying under 150g carbs",
    hours: "Open until 10pm",
    address: "456 Oak Ave",
    topItems: [
      { name: "Keto Steak Bowl", calories: 580, protein: 52, price: "$18" },
      { name: "Low Carb Turkey Wrap", calories: 420, protein: 38, price: "$13" },
      { name: "Egg White Scramble", calories: 320, protein: 28, price: "$11" },
    ],
  },
  {
    id: "3",
    name: "Mediterranean Grill",
    distance: "0.7 mi",
    rating: 4.7,
    reviewCount: 456,
    type: "Mediterranean",
    priceRange: "$$",
    matchScore: 82,
    goalReason: "Lean proteins and healthy fats for balanced nutrition",
    hours: "Open until 9:30pm",
    address: "789 Elm St",
    topItems: [
      { name: "Grilled Lamb Plate", calories: 620, protein: 48, price: "$19" },
      { name: "Chicken Shawarma Bowl", calories: 550, protein: 42, price: "$15" },
      { name: "Falafel & Hummus", calories: 480, protein: 18, price: "$12" },
    ],
  },
  {
    id: "4",
    name: "Green Leaf Cafe",
    distance: "0.9 mi",
    rating: 4.5,
    reviewCount: 189,
    type: "Vegetarian",
    priceRange: "$",
    matchScore: 78,
    goalReason: "Light options under 500 calories for your remaining intake",
    hours: "Open until 8pm",
    address: "321 Pine Rd",
    topItems: [
      { name: "Quinoa Buddha Bowl", calories: 420, protein: 18, price: "$13" },
      { name: "Tofu Stir Fry", calories: 380, protein: 22, price: "$12" },
      { name: "Garden Veggie Wrap", calories: 340, protein: 14, price: "$10" },
    ],
  },
  {
    id: "5",
    name: "Poke Paradise",
    distance: "1.1 mi",
    rating: 4.4,
    reviewCount: 267,
    type: "Hawaiian",
    priceRange: "$$",
    matchScore: 75,
    goalReason: "Protein-rich fish bowls with customizable portions",
    hours: "Open until 9pm",
    address: "555 Beach Blvd",
    topItems: [
      { name: "Ahi Tuna Poke Bowl", calories: 510, protein: 42, price: "$16" },
      { name: "Salmon Lover's Bowl", calories: 540, protein: 38, price: "$17" },
      { name: "Spicy Shrimp Bowl", calories: 480, protein: 32, price: "$15" },
    ],
  },
  {
    id: "6",
    name: "The Fit Bowl",
    distance: "1.2 mi",
    rating: 4.6,
    reviewCount: 312,
    type: "Power Bowls",
    priceRange: "$$",
    matchScore: 72,
    goalReason: "Balanced macros designed for active lifestyles",
    hours: "Open until 8:30pm",
    address: "777 Fitness Way",
    topItems: [
      { name: "Athlete's Power Bowl", calories: 650, protein: 55, price: "$17" },
      { name: "Lean & Clean Chicken", calories: 480, protein: 45, price: "$15" },
      { name: "Post-Workout Recovery", calories: 520, protein: 48, price: "$16" },
    ],
  },
  {
    id: "7",
    name: "Sushi Zen",
    distance: "1.4 mi",
    rating: 4.8,
    reviewCount: 523,
    type: "Japanese",
    priceRange: "$$$",
    matchScore: 70,
    goalReason: "Fresh sashimi for high protein, low fat options",
    hours: "Open until 10pm",
    address: "888 Tokyo Lane",
    topItems: [
      { name: "Sashimi Platter", calories: 380, protein: 52, price: "$24" },
      { name: "Salmon Nigiri Set", calories: 420, protein: 38, price: "$18" },
      { name: "Edamame & Miso", calories: 220, protein: 16, price: "$8" },
    ],
  },
  {
    id: "8",
    name: "Grain & Glory",
    distance: "1.6 mi",
    rating: 4.5,
    reviewCount: 178,
    type: "Grain Bowls",
    priceRange: "$$",
    matchScore: 68,
    goalReason: "Complex carbs for sustained energy throughout the day",
    hours: "Open until 7pm",
    address: "999 Harvest St",
    topItems: [
      { name: "Ancient Grains Bowl", calories: 580, protein: 28, price: "$14" },
      { name: "Farro & Chicken", calories: 520, protein: 35, price: "$15" },
      { name: "Brown Rice Power Bowl", calories: 490, protein: 32, price: "$13" },
    ],
  },
]

export function RestaurantsList() {
  const router = useRouter()
  const { user } = useUser()
  const [restaurants, setRestaurants] = useState<Restaurant[]>(mockRestaurants)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState<"match" | "distance" | "rating">("match")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [locationPermission, setLocationPermission] = useState<'pending' | 'granted' | 'denied'>('pending')

  useEffect(() => {
    const storedLat = localStorage.getItem('userLat')
    const storedLng = localStorage.getItem('userLng')

    if (storedLat && storedLng) {
      const coords = { lat: parseFloat(storedLat), lng: parseFloat(storedLng) }
      setLocationPermission('granted')
      loadNearbyRestaurants(coords)
    } else {
      requestLocation()
    }
  }, [])

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
        setLocationPermission('granted')
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
        const apiRestaurants: ApiRestaurant[] = data.restaurants || []

        // Convert API restaurants to display format, use mock data for known restaurants
        const displayRestaurants = apiRestaurants
          .filter((r: ApiRestaurant) => r.isKnown)
          .map((apiRest: ApiRestaurant) => {
            // Find matching mock restaurant or create new one
            const mockMatch = mockRestaurants.find(m =>
              m.name.toLowerCase().includes(apiRest.name.toLowerCase().split(' ')[0])
            )

            if (mockMatch) {
              return {
                ...mockMatch,
                id: apiRest.id,
                distance: `${apiRest.distance.toFixed(1)} mi`,
                address: apiRest.tags?.['addr:full'] || mockMatch.address
              }
            }

            // Create basic restaurant entry for unknown restaurants with data
            return {
              id: apiRest.id,
              name: apiRest.name,
              distance: `${apiRest.distance.toFixed(1)} mi`,
              rating: 4.5,
              reviewCount: 100,
              type: apiRest.tags?.cuisine || apiRest.tags?.amenity || 'Restaurant',
              priceRange: '$$',
              matchScore: 70,
              goalReason: 'Nearby option for your nutrition goals',
              hours: 'Check hours',
              address: apiRest.tags?.['addr:full'] || 'Address not available',
              topItems: []
            }
          })

        setRestaurants(displayRestaurants)
      }
    } catch (error) {
      console.error('Failed to load restaurants:', error)
      // Keep mock data on error
    } finally {
      setLoading(false)
    }
  }

  const handleRestaurantClick = (restaurant: Restaurant) => {
    localStorage.setItem(`restaurant_${restaurant.id}`, JSON.stringify({
      id: restaurant.id,
      name: restaurant.name,
      distance: parseFloat(restaurant.distance),
      tags: { cuisine: restaurant.type },
      isKnown: true
    }))
    router.push(`/restaurant/${restaurant.id}`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary border-t-transparent mx-auto"></div>
          <p className="mt-4 text-muted-foreground text-sm">Finding nearby restaurants...</p>
        </div>
      </div>
    )
  }

  if (locationPermission === 'denied') {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
        <h3 className="text-lg font-semibold text-foreground mb-2">Location access needed</h3>
        <p className="text-muted-foreground text-sm mb-4">We need your location to find nearby restaurants.</p>
        <button
          onClick={requestLocation}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm hover:bg-primary/90 transition-all"
        >
          Enable Location
        </button>
      </div>
    )
  }

  const filteredRestaurants = restaurants
    .filter(
      (r) =>
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.type.toLowerCase().includes(searchQuery.toLowerCase()),
    )
    .sort((a, b) => {
      if (sortBy === "match") return b.matchScore - a.matchScore
      if (sortBy === "distance") return Number.parseFloat(a.distance) - Number.parseFloat(b.distance)
      return b.rating - a.rating
    })

  return (
    <>
      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search restaurants or cuisine..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30"
          />
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "match" | "distance" | "rating")}
              className="appearance-none pl-4 pr-10 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
            >
              <option value="match">Best Match</option>
              <option value="distance">Nearest</option>
              <option value="rating">Top Rated</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
          <button className="p-2.5 rounded-xl border border-border bg-card hover:bg-muted transition-colors">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Restaurant List */}
      <div className="space-y-3">
        {filteredRestaurants.map((restaurant) => (
          <div key={restaurant.id} className="rounded-2xl border border-border bg-card overflow-hidden transition-all">
            <div
              className="w-full p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-semibold text-foreground">{restaurant.name}</h3>
                    <span className="text-xs font-semibold text-primary">{restaurant.matchScore}% match</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground mb-2">
                    <span className="flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      {restaurant.rating}
                      <span className="text-xs">({restaurant.reviewCount})</span>
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {restaurant.distance}
                    </span>
                    <span>•</span>
                    <span>{restaurant.type}</span>
                    <span>•</span>
                    <span>{restaurant.priceRange}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{restaurant.goalReason}</p>
                </div>
                <button
                  onClick={() => setExpandedId(expandedId === restaurant.id ? null : restaurant.id)}
                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronDown
                    className={`h-5 w-5 transition-transform ${expandedId === restaurant.id ? "rotate-180" : ""}`}
                  />
                </button>
              </div>
            </div>

            {/* Expanded Content */}
            {expandedId === restaurant.id && (
              <div className="px-5 pb-5 border-t border-border">
                <div className="pt-4">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {restaurant.hours}
                    </span>
                    <span>•</span>
                    <span>{restaurant.address}</span>
                  </div>

                  <h4 className="text-sm font-medium text-foreground mb-3">Recommended for your goals</h4>
                  <div className="space-y-2">
                    {restaurant.topItems.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                        <div>
                          <p className="text-sm font-medium text-foreground">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.calories} cal • {item.protein}g protein
                          </p>
                        </div>
                        <span className="text-sm font-medium text-foreground">{item.price}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => handleRestaurantClick(restaurant)}
                    className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors"
                  >
                    View Full Menu
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}
