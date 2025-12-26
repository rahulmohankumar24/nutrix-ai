import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Get restaurant brands and their meal counts
    const restaurants = await prisma.orderTemplate.groupBy({
      by: ['restaurantBrand'],
      _count: {
        id: true
      },
      orderBy: {
        restaurantBrand: 'asc'
      }
    })

    const restaurantSummary = restaurants.map(r => ({
      brand: r.restaurantBrand,
      count: r._count.id
    }))

    return NextResponse.json({
      restaurants: restaurantSummary,
      totalRestaurants: restaurants.length,
      totalMeals: restaurants.reduce((sum, r) => sum + r._count.id, 0)
    })
  } catch (error) {
    console.error('Failed to get restaurant summary:', error)
    return NextResponse.json({ error: 'Failed to get restaurant summary' }, { status: 500 })
  }
}