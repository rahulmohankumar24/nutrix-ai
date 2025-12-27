"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { MapPin, Search, SlidersHorizontal, ChevronDown, RefreshCw, Car, PersonStanding } from "lucide-react"

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
  const [locationPermission, setLocationPermission] = useState<'pending' | 'granted' | 'denied'>('pending')
  const [refreshingLocation, setRefreshingLocation] = useState(false)
  const [transportMode, setTransportMode] = useState<'walk' | 'drive'>('walk')
  const [radiusMiles, setRadiusMiles] = useState(1) // Default 1 mile for walking
  const [showSettings, setShowSettings] = useState(false)
  const [userGoal, setUserGoal] = useState<string>('recomp')

  // Temporary state for settings before applying
  const [tempTransportMode, setTempTransportMode] = useState<'walk' | 'drive'>('walk')
  const [tempRadiusMiles, setTempRadiusMiles] = useState(1)

  // Fetch user goal from profile
  useEffect(() => {
    const fetchUserGoal = async () => {
      if (!user?.id) return

      try {
        const response = await fetch(`/api/profile?userId=${user.id}`)
        if (response.ok) {
          const data = await response.json()
          if (data.profile?.goal) {
            setUserGoal(data.profile.goal)
          }
        }
      } catch (error) {
        console.error('Failed to fetch user goal:', error)
      }
    }

    fetchUserGoal()
  }, [user?.id])

  useEffect(() => {
    const storedLat = localStorage.getItem('userLat')
    const storedLng = localStorage.getItem('userLng')
    const lastLocationUpdate = localStorage.getItem('locationUpdatedAt')

    // Check if location is stale (older than 30 minutes)
    const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000)
    const isLocationStale = !lastLocationUpdate || parseInt(lastLocationUpdate) < thirtyMinutesAgo

    if (storedLat && storedLng && !isLocationStale) {
      const coords = { lat: parseFloat(storedLat), lng: parseFloat(storedLng) }
      setLocationPermission('granted')
      setLoading(true) // Show loading when reloading with new radius
      loadNearbyRestaurants(coords)
    } else {
      // Refresh location if it's stale or not stored
      requestLocation()
    }
  }, [radiusMiles]) // Reload when radius changes

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
        localStorage.setItem('locationUpdatedAt', Date.now().toString())
        loadNearbyRestaurants(coords)
        setRefreshingLocation(false)
      },
      (error) => {
        console.error('Location error:', error)
        setLocationPermission('denied')
        setLoading(false)
        setRefreshingLocation(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0 // Don't use cached position
      }
    )
  }

  const getPersonalizedGoalReason = (name: string, cuisine?: string) => {
    const nameLower = name.toLowerCase()
    const cuisineLower = (cuisine || '').toLowerCase()

    // Chain restaurants with specific recommendations
    if (nameLower.includes('chipotle') || nameLower.includes('qdoba') || nameLower.includes("moe's")) {
      return 'Customizable bowls perfect for hitting your protein targets'
    }
    if (nameLower.includes('cava') || nameLower.includes('roti')) {
      return 'Build-your-own Mediterranean bowls with lean proteins'
    }
    if (nameLower.includes('sweetgreen') || nameLower.includes('chopt')) {
      return 'Fresh salads with grilled chicken for high-protein meals'
    }
    if (nameLower.includes('subway') || nameLower.includes('jersey mike')) {
      return 'Customizable subs - choose lean protein and whole grains'
    }
    if (nameLower.includes('panera')) {
      return 'Balanced soups, salads, and sandwiches for macro tracking'
    }
    if (nameLower.includes('chick-fil-a')) {
      return 'Grilled chicken options for lean protein without excess fat'
    }
    if (nameLower.includes('poke') || nameLower.includes('poké')) {
      return 'Protein-rich fish bowls with customizable portions'
    }
    if (nameLower.includes('salad')) {
      return 'Fresh greens with protein toppings to meet your daily goals'
    }

    // Cuisine-based recommendations
    if (cuisineLower.includes('mediterranean') || cuisineLower.includes('greek')) {
      return 'Lean proteins and healthy fats for balanced nutrition'
    }
    if (cuisineLower.includes('mexican')) {
      return 'Protein-packed options with customizable portions'
    }
    if (cuisineLower.includes('asian') || cuisineLower.includes('chinese') || cuisineLower.includes('thai')) {
      return 'Balanced proteins and vegetables for your macro needs'
    }
    if (cuisineLower.includes('japanese') || cuisineLower.includes('sushi')) {
      return 'High-protein sushi and sashimi options'
    }
    if (cuisineLower.includes('indian')) {
      return 'Protein-rich curries and tandoori options'
    }
    if (cuisineLower.includes('italian')) {
      return 'Balance carbs and protein with pasta and grilled proteins'
    }
    if (cuisineLower.includes('american') || cuisineLower.includes('burger')) {
      return 'Grilled options and salads to fit your macros'
    }
    if (cuisineLower.includes('vegetarian') || cuisineLower.includes('vegan')) {
      return 'Plant-based proteins and nutrient-dense options'
    }
    if (cuisineLower.includes('breakfast') || cuisineLower.includes('cafe')) {
      return 'High-protein breakfast and brunch options'
    }

    // Default personalized message
    return 'Great options to help you reach your nutrition targets'
  }

  const getTravelTime = (distanceMiles: number, mode: 'walk' | 'drive') => {
    // Walking speed: ~3 mph, Driving speed: ~25 mph in city
    const speed = mode === 'walk' ? 3 : 25
    const hours = distanceMiles / speed
    const minutes = Math.round(hours * 60)

    if (minutes < 1) return '< 1 min'
    if (minutes < 60) return `${minutes} min`
    const hrs = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`
  }

  const loadNearbyRestaurants = async (coords: {lat: number, lng: number}) => {
    try {
      const radiusMeters = Math.round(radiusMiles * 1609.34) // Convert miles to meters
      const response = await fetch('/api/nearby', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: coords.lat,
          lng: coords.lng,
          radiusMeters,
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

            const cuisineType = apiRest.tags?.cuisine || apiRest.tags?.amenity || 'Restaurant'

            // Create basic restaurant entry for unknown restaurants with data
            return {
              id: apiRest.id,
              name: apiRest.name,
              distance: `${apiRest.distance.toFixed(1)} mi`,
              rating: 4.5,
              reviewCount: 100,
              type: cuisineType,
              priceRange: '$$',
              matchScore: 70,
              goalReason: getPersonalizedGoalReason(apiRest.name, cuisineType),
              hours: 'Check hours',
              address: apiRest.tags?.['addr:full'] || 'Address not available',
              topItems: []
            }
          })

        // Score restaurants with AI
        try {
          const scoreResponse = await fetch('/api/score-restaurants', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              restaurants: displayRestaurants,
              userGoal
            })
          })

          if (scoreResponse.ok) {
            const scoreData = await scoreResponse.json()
            setRestaurants(scoreData.scoredRestaurants)
          } else {
            // Fallback to unscored restaurants
            setRestaurants(displayRestaurants)
          }
        } catch (scoreError) {
          console.error('Failed to score restaurants:', scoreError)
          // Fallback to unscored restaurants
          setRestaurants(displayRestaurants)
        }
      }
    } catch (error) {
      console.error('Failed to load restaurants:', error)
      // Keep mock data on error
    } finally {
      setLoading(false)
    }
  }

  const handleRefreshLocation = () => {
    setRefreshingLocation(true)
    setLoading(true)
    requestLocation()
  }

  const handleRestaurantClick = (restaurant: Restaurant) => {
    // Save restaurant data to localStorage
    localStorage.setItem(`restaurant_${restaurant.id}`, JSON.stringify({
      id: restaurant.id,
      name: restaurant.name,
      distance: parseFloat(restaurant.distance),
      tags: { cuisine: restaurant.type },
      isKnown: true
    }))

    // Set a flag to show loading state immediately on the restaurant page
    sessionStorage.setItem('generatingMeals', 'true')

    // Navigate to restaurant page
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
      if (sortBy === "match") {
        // Sort by AI score if available, otherwise distance
        const scoreA = (a as any).aiScore ?? 70
        const scoreB = (b as any).aiScore ?? 70
        return scoreB - scoreA
      }
      if (sortBy === "distance") return Number.parseFloat(a.distance) - Number.parseFloat(b.distance)
      return b.rating - a.rating
    })

  return (
    <>
      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
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
          <button
            onClick={handleRefreshLocation}
            disabled={refreshingLocation}
            className="p-2.5 rounded-xl border border-border bg-card hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refresh location"
          >
            <RefreshCw className={`h-4 w-4 text-muted-foreground ${refreshingLocation ? 'animate-spin' : ''}`} />
          </button>
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "match" | "distance" | "rating")}
              className="appearance-none pl-4 pr-10 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
            >
              <option value="match">Best for Your Goals (AI)</option>
              <option value="distance">Nearest First</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
          <button
            onClick={() => {
              if (!showSettings) {
                // Sync temp values with current values when opening settings
                setTempTransportMode(transportMode)
                setTempRadiusMiles(radiusMiles)
              }
              setShowSettings(!showSettings)
            }}
            className={`p-2.5 rounded-xl border border-border bg-card hover:bg-muted transition-colors ${showSettings ? 'bg-primary/10 border-primary/30' : ''}`}
          >
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="mb-6 p-4 rounded-xl border border-border bg-card">
          <div className="space-y-5">
            {/* Transport Mode Toggle */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Transport Mode</label>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setTempTransportMode('walk')
                    // Auto-adjust to reasonable walking distance if current is too far
                    if (tempRadiusMiles > 5) {
                      setTempRadiusMiles(2)
                    }
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border transition-all ${
                    tempTransportMode === 'walk'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card border-border hover:border-primary/30'
                  }`}
                >
                  <PersonStanding className="h-4 w-4" />
                  <span className="text-sm font-medium">Walking</span>
                </button>
                <button
                  onClick={() => {
                    setTempTransportMode('drive')
                    // Auto-adjust to reasonable driving distance if current is too small
                    if (tempRadiusMiles < 2) {
                      setTempRadiusMiles(5)
                    }
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border transition-all ${
                    tempTransportMode === 'drive'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card border-border hover:border-primary/30'
                  }`}
                >
                  <Car className="h-4 w-4" />
                  <span className="text-sm font-medium">Driving</span>
                </button>
              </div>
            </div>

            {/* Distance Slider */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-foreground">Distance</label>
                <span className="text-sm font-semibold text-primary">{tempRadiusMiles.toFixed(1)} mi</span>
              </div>
              <div className="relative">
                <div
                  className="absolute h-2 bg-primary rounded-lg pointer-events-none"
                  style={{
                    width: `${((tempRadiusMiles - (tempTransportMode === 'walk' ? 0.5 : 1)) /
                      ((tempTransportMode === 'walk' ? 5 : 25) - (tempTransportMode === 'walk' ? 0.5 : 1))) * 100}%`
                  }}
                />
                <input
                  type="range"
                  min={tempTransportMode === 'walk' ? 0.5 : 1}
                  max={tempTransportMode === 'walk' ? 5 : 25}
                  step={0.5}
                  value={tempRadiusMiles}
                  onChange={(e) => setTempRadiusMiles(parseFloat(e.target.value))}
                  className="relative w-full h-2 bg-muted/60 rounded-lg appearance-none cursor-pointer slider"
                />
              </div>
              <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                <span>{tempTransportMode === 'walk' ? '0.5' : '1'} mi</span>
                <span>{tempTransportMode === 'walk' ? '5' : '25'} mi</span>
              </div>
            </div>

            {/* Apply Button */}
            <button
              onClick={() => {
                setTransportMode(tempTransportMode)
                setRadiusMiles(tempRadiusMiles)
                setLoading(true)
                setShowSettings(false)
              }}
              className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-all"
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}

      {/* Restaurant List */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredRestaurants.map((restaurant) => (
          <button
            key={restaurant.id}
            onClick={() => handleRestaurantClick(restaurant)}
            className="rounded-2xl border border-border bg-card overflow-hidden transition-all hover:border-primary/30 hover:shadow-sm text-left flex flex-col"
          >
            <div className="p-5 flex-1 flex flex-col">
              <div className="mb-3 flex items-start justify-between gap-2">
                <h3 className="font-semibold text-foreground flex-1">{restaurant.name}</h3>
                {(restaurant as any).aiScore && (
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                    (restaurant as any).aiScore >= 80
                      ? 'bg-green-500/20 text-green-700 border border-green-500/30'
                      : (restaurant as any).aiScore >= 70
                      ? 'bg-blue-500/20 text-blue-700 border border-blue-500/30'
                      : 'bg-gray-500/20 text-gray-700 border border-gray-500/30'
                  }`}>
                    Rovia Score: {(restaurant as any).aiScore}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 text-sm text-muted-foreground mb-3">
                <span className="flex items-center gap-1">
                  {transportMode === 'walk' ? (
                    <PersonStanding className="h-3.5 w-3.5" />
                  ) : (
                    <Car className="h-3.5 w-3.5" />
                  )}
                  {restaurant.distance} • {getTravelTime(parseFloat(restaurant.distance), transportMode)}
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                <span>{restaurant.type}</span>
                <span>•</span>
                <span>{restaurant.priceRange}</span>
              </div>

              <p className="text-sm text-muted-foreground mt-auto">{restaurant.goalReason}</p>
            </div>
          </button>
        ))}
      </div>
    </>
  )
}
