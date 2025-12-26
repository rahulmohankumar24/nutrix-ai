import { NextRequest, NextResponse } from 'next/server'
import { calculateDistance } from '@/lib/calculations'
import { isKnownChain } from '@/lib/chains'
import { Restaurant } from '@/lib/types'

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
    const { lat, lng } = body

    if (!lat || !lng) {
      return NextResponse.json(
        { error: 'Latitude and longitude are required' },
        { status: 400 }
      )
    }

    // Query Overpass API for restaurants within 2km
    const overpassQuery = `
      [out:json][timeout:25];
      (
        node["amenity"="restaurant"](around:2000,${lat},${lng});
        node["amenity"="fast_food"](around:2000,${lat},${lng});
        way["amenity"="restaurant"](around:2000,${lat},${lng});
        way["amenity"="fast_food"](around:2000,${lat},${lng});
        relation["amenity"="restaurant"](around:2000,${lat},${lng});
        relation["amenity"="fast_food"](around:2000,${lat},${lng});
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
    const knownChains = consolidatedRestaurants.filter(r => r.isKnown).slice(0, 10)
    const unknownRestaurants = consolidatedRestaurants.filter(r => !r.isKnown).slice(0, 15)

    return NextResponse.json({
      restaurants: [...knownChains, ...unknownRestaurants],
      userLocation: { lat, lng }
    })
  } catch (error) {
    console.error('Nearby restaurants error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch nearby restaurants' },
      { status: 500 }
    )
  }
}