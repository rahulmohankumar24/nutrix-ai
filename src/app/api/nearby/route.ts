import { NextRequest, NextResponse } from 'next/server'
import { calculateDistance } from '@/lib/calculations'
import { isKnownChain } from '@/lib/chains'
import { Restaurant } from '@/lib/types'
import { cache, generateRestaurantCacheKey } from '@/lib/cache'

// Multiple Overpass API endpoints for fallback
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
]

async function fetchWithRetry(query: string, maxRetries = 2): Promise<any> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: query,
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        if (response.ok) {
          const data = await response.json()
          console.log(`✅ Overpass fetch succeeded from ${endpoint}`)
          return data
        }

        console.warn(`⚠️ Overpass endpoint ${endpoint} returned ${response.status}`)
      } catch (error: any) {
        lastError = error
        if (error.name === 'AbortError') {
          console.warn(`⏱️ Timeout on ${endpoint}`)
        } else {
          console.warn(`❌ Error from ${endpoint}:`, error.message)
        }
      }
    }

    // Wait before retry
    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  throw lastError || new Error('All Overpass endpoints failed')
}

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
    // Simplified query for faster response - only nodes (most common for restaurants)
    const overpassQuery = `
      [out:json][timeout:15];
      (
        node["amenity"="restaurant"](around:${radiusMeters},${lat},${lng});
        node["amenity"="fast_food"](around:${radiusMeters},${lat},${lng});
        node["amenity"="cafe"](around:${radiusMeters},${lat},${lng});
      );
      out body;
    `

    const data = await fetchWithRetry(overpassQuery)
    const restaurants: Restaurant[] = []

    // Process Overpass response - simplified for nodes only
    data.elements.forEach((element: any) => {
      if (!element.tags?.name || !element.lat || !element.lon) return

      const distance = calculateDistance(lat, lng, element.lat, element.lon)
      const name = element.tags.name
      const isKnown = isKnownChain(name)

      restaurants.push({
        id: element.id.toString(),
        name,
        lat: element.lat,
        lng: element.lon,
        distance: Math.round(distance * 100) / 100,
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
  } catch (error: any) {
    console.error('Nearby restaurants error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch nearby restaurants',
        message: error?.message || 'Unknown error',
        restaurants: [] // Return empty array so UI can handle gracefully
      },
      { status: 500 }
    )
  }
}