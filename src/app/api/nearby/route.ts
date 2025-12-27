import { NextRequest, NextResponse } from 'next/server'
import { calculateDistance } from '@/lib/calculations'
import { isKnownChain } from '@/lib/chains'
import { Restaurant } from '@/lib/types'
import { cache, generateRestaurantCacheKey } from '@/lib/cache'

function consolidateRestaurants(restaurants: Restaurant[]): Restaurant[] {
  const restaurantMap = new Map<string, Restaurant>()

  restaurants.forEach(restaurant => {
    const normalizedName = restaurant.name.toLowerCase().trim()
    const existing = restaurantMap.get(normalizedName)

    if (!existing || restaurant.distance < existing.distance) {
      restaurantMap.set(normalizedName, restaurant)
    }
  })

  return Array.from(restaurantMap.values()).sort((a, b) => a.distance - b.distance)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { lat, lng, radiusMeters = 2000 } = body

    if (!lat || !lng) {
      return NextResponse.json(
        { error: 'Latitude and longitude are required' },
        { status: 400 }
      )
    }

    // Check cache first with radius in key
    const cacheKey = `${generateRestaurantCacheKey(lat, lng)}_${radiusMeters}`
    const cachedResult = cache.get(cacheKey)
    if (cachedResult) {
      console.log('🚀 Restaurant cache hit:', cacheKey)
      return NextResponse.json({
        ...cachedResult,
        cached: true
      })
    }

    // Query Overpass API for restaurants within specified radius
    const overpassQuery = `
      [out:json][timeout:25];
      (
        node["amenity"="restaurant"](around:${radiusMeters},${lat},${lng});
        node["amenity"="fast_food"](around:${radiusMeters},${lat},${lng});
        way["amenity"="restaurant"](around:${radiusMeters},${lat},${lng});
        way["amenity"="fast_food"](around:${radiusMeters},${lat},${lng});
        relation["amenity"="restaurant"](around:${radiusMeters},${lat},${lng});
        relation["amenity"="fast_food"](around:${radiusMeters},${lat},${lng});
      );
      out geom;
    `

    const overpassUrl = 'https://overpass-api.de/api/interpreter'
    const response = await fetch(overpassUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: overpassQuery
    })

    if (!response.ok) {
      throw new Error('Failed to fetch restaurant data')
    }

    const data = await response.json()
    const restaurants: Restaurant[] = []

    // Process Overpass response
    data.elements.forEach((element: any) => {
      if (!element.tags?.name) return

      let elementLat: number
      let elementLng: number

      if (element.type === 'node') {
        elementLat = element.lat
        elementLng = element.lon
      } else if (element.type === 'way' && element.center) {
        elementLat = element.center.lat
        elementLng = element.center.lon
      } else if (element.geometry && element.geometry.length > 0) {
        // Use first coordinate for ways/relations without center
        elementLat = element.geometry[0].lat
        elementLng = element.geometry[0].lon
      } else {
        return // Skip if no valid coordinates
      }

      const distance = calculateDistance(lat, lng, elementLat, elementLng)
      const name = element.tags.name
      const isKnown = isKnownChain(name)

      restaurants.push({
        id: element.id.toString(),
        name,
        lat: elementLat,
        lng: elementLng,
        distance: Math.round(distance * 100) / 100, // Round to 2 decimal places
        tags: element.tags,
        isKnown
      })
    })

    // Sort by distance first
    restaurants.sort((a, b) => a.distance - b.distance)

    // Consolidate duplicate restaurant names, keeping only the closest location
    const consolidatedRestaurants = consolidateRestaurants(restaurants)

    // Split into known and unknown chains
    const knownChains = consolidatedRestaurants.filter(r => r.isKnown)
    const unknownRestaurants = consolidatedRestaurants.filter(r => !r.isKnown)

    // Prioritize known chains, but ensure we get at least 9 total restaurants if available
    let finalRestaurants = [...knownChains.slice(0, 20)] // Take up to 20 known chains

    // If we have less than 9, add unknown restaurants to reach at least 9
    if (finalRestaurants.length < 9) {
      const needed = 9 - finalRestaurants.length
      finalRestaurants = [...finalRestaurants, ...unknownRestaurants.slice(0, Math.max(needed, 15))]
    } else {
      // Add some unknowns anyway for variety
      finalRestaurants = [...finalRestaurants, ...unknownRestaurants.slice(0, 10)]
    }

    const result = {
      restaurants: finalRestaurants.slice(0, 30), // Cap at 30 total
      userLocation: { lat, lng }
    }

    // Cache the result for 30 minutes (restaurants don't change often)
    cache.set(cacheKey, result, 30)
    console.log('💾 Restaurant data cached:', cacheKey)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Nearby restaurants error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch nearby restaurants' },
      { status: 500 }
    )
  }
}