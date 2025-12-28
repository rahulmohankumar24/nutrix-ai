"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { Search, ChevronDown, RefreshCw, Car, PersonStanding, Sparkles, Leaf, Flame, Zap } from "lucide-react"

type QuickFilter = 'all' | 'high-protein' | 'low-carb' | 'vegetarian' | 'known-menu'

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
  type: string
  priceRange: string
  goalReason: string
  address: string
  isKnown: boolean
}

export function RestaurantsList() {
  const router = useRouter()
  const { user } = useUser()
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState<"match" | "distance">("match")
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all')
  const [cuisineFilter, setCuisineFilter] = useState<string>('all')
  const [locationPermission, setLocationPermission] = useState<'pending' | 'granted' | 'denied'>('pending')
  const [refreshingLocation, setRefreshingLocation] = useState(false)
  const [transportMode, setTransportMode] = useState<'walk' | 'drive'>('drive')
  const [radiusMiles, setRadiusMiles] = useState(5) // Default 5 miles for driving
  const [userGoal, setUserGoal] = useState<string>('recomp')

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
          limit: 100
        })
      })

      if (response.ok) {
        const data = await response.json()
        const apiRestaurants: ApiRestaurant[] = data.restaurants || []

        // Convert API restaurants to display format - only real restaurants from the API
        const displayRestaurants: Restaurant[] = apiRestaurants.map((apiRest: ApiRestaurant) => {
          const cuisineType = apiRest.tags?.cuisine || apiRest.tags?.amenity || 'Restaurant'

          return {
            id: apiRest.id,
            name: apiRest.name,
            distance: `${apiRest.distance.toFixed(1)} mi`,
            type: cuisineType,
            priceRange: '$$',
            goalReason: getPersonalizedGoalReason(apiRest.name, cuisineType),
            address: apiRest.tags?.['addr:full'] || apiRest.tags?.['addr:street'] || '',
            isKnown: apiRest.isKnown
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
            setRestaurants(displayRestaurants)
          }
        } catch (scoreError) {
          console.error('Failed to score restaurants:', scoreError)
          setRestaurants(displayRestaurants)
        }
      }
    } catch (error) {
      console.error('Failed to load restaurants:', error)
      setRestaurants([])
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
      isKnown: restaurant.isKnown
    }))

    // Set a flag to show loading state immediately on the restaurant page
    sessionStorage.setItem('generatingMeals', 'true')

    // Navigate to restaurant page
    router.push(`/restaurant/${restaurant.id}`)
  }

  const handleSearchAnyRestaurant = (restaurantName: string) => {
    // Create a custom ID for the searched restaurant
    const customId = `search_${encodeURIComponent(restaurantName.toLowerCase().replace(/\s+/g, '-'))}`

    // Save restaurant data to localStorage
    localStorage.setItem(`restaurant_${customId}`, JSON.stringify({
      id: customId,
      name: restaurantName,
      distance: null, // Unknown distance
      tags: { cuisine: 'Restaurant' },
      isKnown: false,
      isCustomSearch: true // Flag to indicate this was a custom search
    }))

    // Set a flag to show loading state immediately on the restaurant page
    sessionStorage.setItem('generatingMeals', 'true')

    // Clear the search query
    setSearchQuery('')

    // Navigate to restaurant page
    router.push(`/restaurant/${customId}`)
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

  // Helper function to check if restaurant matches quick filter
  const matchesQuickFilter = (restaurant: Restaurant, filter: QuickFilter): boolean => {
    const nameLower = restaurant.name.toLowerCase()
    const typeLower = restaurant.type.toLowerCase()
    const goalLower = restaurant.goalReason.toLowerCase()

    switch (filter) {
      case 'all':
        return true
      case 'high-protein':
        return goalLower.includes('protein') ||
               typeLower.includes('grill') ||
               typeLower.includes('poke') ||
               typeLower.includes('mediterranean') ||
               typeLower.includes('mexican')
      case 'low-carb':
        return goalLower.includes('low carb') ||
               goalLower.includes('keto') ||
               typeLower.includes('salad') ||
               typeLower.includes('poke')
      case 'vegetarian':
        return typeLower.includes('vegetarian') ||
               typeLower.includes('vegan') ||
               typeLower.includes('salad')
      case 'known-menu':
        return restaurant.isKnown
      default:
        return true
    }
  }

  // Get unique cuisine types for filter dropdown
  const cuisineTypes = ['all', ...new Set(restaurants.map(r => r.type).filter(Boolean))].slice(0, 10)

  const filteredRestaurants = restaurants
    .filter((r) => {
      // Text search filter
      const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.type.toLowerCase().includes(searchQuery.toLowerCase())

      // Quick filter
      const matchesQuick = matchesQuickFilter(r, quickFilter)

      // Cuisine filter
      const matchesCuisine = cuisineFilter === 'all' || r.type.toLowerCase() === cuisineFilter.toLowerCase()

      return matchesSearch && matchesQuick && matchesCuisine
    })
    .sort((a, b) => {
      if (sortBy === "match") {
        // Sort by AI score if available, otherwise distance
        const scoreA = (a as any).aiScore ?? 70
        const scoreB = (b as any).aiScore ?? 70
        return scoreB - scoreA
      }
      // Sort by distance
      return Number.parseFloat(a.distance) - Number.parseFloat(b.distance)
    })

  // Distance options based on transport mode
  const distanceOptions = transportMode === 'walk'
    ? [{ value: 0.5, label: '0.5 mi' }, { value: 1, label: '1 mi' }, { value: 2, label: '2 mi' }]
    : [{ value: 3, label: '3 mi' }, { value: 5, label: '5 mi' }, { value: 10, label: '10 mi' }, { value: 15, label: '15 mi' }]

  const handleTransportChange = (mode: 'walk' | 'drive') => {
    setTransportMode(mode)
    // Auto-set reasonable defaults when switching
    if (mode === 'walk' && radiusMiles > 2) {
      setRadiusMiles(1)
    } else if (mode === 'drive' && radiusMiles < 3) {
      setRadiusMiles(5)
    }
  }

  return (
    <>
      {/* Search Bar */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search any restaurant..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30"
        />

        {/* Search Any Restaurant Option */}
        {searchQuery.trim().length >= 2 && (
          <div className="absolute top-full left-0 right-0 mt-1 z-50">
            <button
              onClick={() => handleSearchAnyRestaurant(searchQuery.trim())}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-sky-500/30 bg-card hover:bg-sky-50 dark:hover:bg-sky-500/10 hover:border-sky-500/50 transition-all text-left shadow-lg"
            >
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-sky-500/20 to-blue-500/20 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-sky-500" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground">Search "{searchQuery.trim()}"</p>
                <p className="text-xs text-muted-foreground">Get AI-powered meal recommendations</p>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground -rotate-90" />
            </button>
          </div>
        )}
      </div>

      {/* Transport & Distance Controls - Always Visible */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* Transport Toggle */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => handleTransportChange('walk')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-all ${
              transportMode === 'walk'
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-muted-foreground hover:bg-muted'
            }`}
          >
            <PersonStanding className="h-3.5 w-3.5" />
            Walk
          </button>
          <button
            onClick={() => handleTransportChange('drive')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-all ${
              transportMode === 'drive'
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-muted-foreground hover:bg-muted'
            }`}
          >
            <Car className="h-3.5 w-3.5" />
            Drive
          </button>
        </div>

        {/* Distance Quick Select */}
        <div className="flex gap-1">
          {distanceOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setRadiusMiles(opt.value)}
              className={`px-2.5 py-1.5 rounded-lg text-sm transition-all ${
                radiusMiles === opt.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Sort Dropdown */}
        <div className="relative ml-auto">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "match" | "distance")}
            className="appearance-none pl-3 pr-8 py-1.5 rounded-lg border border-border bg-card text-sm cursor-pointer"
          >
            <option value="match">Best Match</option>
            <option value="distance">Nearest</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        </div>

        {/* Refresh Button */}
        <button
          onClick={handleRefreshLocation}
          disabled={refreshingLocation}
          className="p-1.5 rounded-lg border border-border bg-card hover:bg-muted transition-colors disabled:opacity-50"
          title="Refresh location"
        >
          <RefreshCw className={`h-4 w-4 text-muted-foreground ${refreshingLocation ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Quick Filter Chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {[
          { id: 'all' as QuickFilter, label: 'All', icon: null },
          { id: 'high-protein' as QuickFilter, label: 'High Protein', icon: Zap },
          { id: 'low-carb' as QuickFilter, label: 'Low Carb', icon: Flame },
          { id: 'vegetarian' as QuickFilter, label: 'Vegetarian', icon: Leaf },
          { id: 'known-menu' as QuickFilter, label: 'Known Menus', icon: Sparkles },
        ].map((filter) => (
          <button
            key={filter.id}
            onClick={() => setQuickFilter(filter.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              quickFilter === filter.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {filter.icon && <filter.icon className="h-3.5 w-3.5" />}
            {filter.label}
          </button>
        ))}

        {/* Cuisine Type Dropdown */}
        {cuisineTypes.length > 2 && (
          <div className="relative">
            <select
              value={cuisineFilter}
              onChange={(e) => setCuisineFilter(e.target.value)}
              className={`appearance-none pl-3 pr-8 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer ${
                cuisineFilter !== 'all'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              <option value="all">All Cuisines</option>
              {cuisineTypes.filter(c => c !== 'all').map((cuisine) => (
                <option key={cuisine} value={cuisine}>{cuisine}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" />
          </div>
        )}
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          {filteredRestaurants.length} restaurant{filteredRestaurants.length !== 1 ? 's' : ''} found
        </p>
        {(quickFilter !== 'all' || cuisineFilter !== 'all' || searchQuery) && (
          <button
            onClick={() => {
              setQuickFilter('all')
              setCuisineFilter('all')
              setSearchQuery('')
            }}
            className="text-sm text-primary hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Restaurant List */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredRestaurants.map((restaurant) => (
          <button
            key={restaurant.id}
            onClick={() => handleRestaurantClick(restaurant)}
            className="rounded-2xl border border-border bg-card overflow-hidden transition-all hover:border-primary/30 hover:shadow-sm text-left flex flex-col group"
          >
            <div className="p-5 flex-1 flex flex-col">
              {/* Header with name and score */}
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{restaurant.name}</h3>
                  {restaurant.isKnown && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-primary/10 text-primary mt-1">
                      <Sparkles className="h-3 w-3" />
                      Known Menu
                    </span>
                  )}
                </div>
                {(restaurant as any).aiScore && (
                  <div className={`flex flex-col items-center px-2 py-1 rounded-lg ${
                    (restaurant as any).aiScore >= 85
                      ? 'bg-green-500/10'
                      : (restaurant as any).aiScore >= 75
                      ? 'bg-blue-500/10'
                      : 'bg-muted'
                  }`}>
                    <span className={`text-lg font-bold ${
                      (restaurant as any).aiScore >= 85
                        ? 'text-green-600'
                        : (restaurant as any).aiScore >= 75
                        ? 'text-blue-600'
                        : 'text-muted-foreground'
                    }`}>
                      {(restaurant as any).aiScore}
                    </span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">score</span>
                  </div>
                )}
              </div>

              {/* Distance and type */}
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground mb-3">
                <span className="flex items-center gap-1">
                  {transportMode === 'walk' ? (
                    <PersonStanding className="h-3.5 w-3.5" />
                  ) : (
                    <Car className="h-3.5 w-3.5" />
                  )}
                  {restaurant.distance} • {getTravelTime(parseFloat(restaurant.distance), transportMode)}
                </span>
                <span>•</span>
                <span>{restaurant.type}</span>
              </div>

              {/* Goal reason */}
              <p className="text-sm text-muted-foreground mt-auto">{restaurant.goalReason}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Empty state */}
      {filteredRestaurants.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-2">No restaurants match your filters</p>
          <button
            onClick={() => {
              setQuickFilter('all')
              setCuisineFilter('all')
              setSearchQuery('')
            }}
            className="text-sm text-primary hover:underline"
          >
            Clear all filters
          </button>
        </div>
      )}
    </>
  )
}
