// Simple in-memory cache with TTL support
interface CacheEntry {
  data: any
  expiry: number
}

class SimpleCache {
  private cache = new Map<string, CacheEntry>()

  set(key: string, data: any, ttlMinutes: number = 30): void {
    const expiry = Date.now() + (ttlMinutes * 60 * 1000)
    this.cache.set(key, { data, expiry })
  }

  get(key: string): any | null {
    const entry = this.cache.get(key)

    if (!entry) return null

    if (Date.now() > entry.expiry) {
      this.cache.delete(key)
      return null
    }

    return entry.data
  }

  clear(): void {
    this.cache.clear()
  }

  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  has(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false
    if (Date.now() > entry.expiry) {
      this.cache.delete(key)
      return false
    }
    return true
  }

  // Clean up expired entries periodically
  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key)
      }
    }
  }
}

// Global cache instance
export const cache = new SimpleCache()

// Cleanup expired entries every 5 minutes
setInterval(() => {
  cache.cleanup()
}, 5 * 60 * 1000)

// Utility functions for generating cache keys
export function generateAIMealCacheKey(
  restaurantBrand: string,
  userId: string,
  timeOfDay: string,
  remainingCalories: number,
  remainingProtein: number
): string {
  // Round calories and protein to ranges for better cache hits
  const calorieRange = Math.round(remainingCalories / 100) * 100 // Round to nearest 100
  const proteinRange = Math.round(remainingProtein / 10) * 10   // Round to nearest 10

  return `ai_meal_${restaurantBrand}_${userId}_${timeOfDay}_${calorieRange}cal_${proteinRange}p`
}

export function generateRestaurantCacheKey(lat: number, lng: number): string {
  // Round coordinates to reduce precision for better cache hits within ~100m radius
  const roundedLat = Math.round(lat * 1000) / 1000  // ~100m precision
  const roundedLng = Math.round(lng * 1000) / 1000

  return `restaurants_${roundedLat}_${roundedLng}`
}