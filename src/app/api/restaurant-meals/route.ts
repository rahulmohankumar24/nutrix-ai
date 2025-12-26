import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const restaurantBrand = searchParams.get('restaurantBrand')

    if (!restaurantBrand) {
      return NextResponse.json({ error: 'Restaurant brand required' }, { status: 400 })
    }

    // Get meals for this restaurant brand
    const meals = await prisma.orderTemplate.findMany({
      where: {
        restaurantBrand: {
          contains: restaurantBrand,
          mode: 'insensitive'
        }
      },
      orderBy: {
        title: 'asc'
      }
    })

    // Parse tags from JSON string
    const enhancedMeals = meals.map(meal => ({
      ...meal,
      tags: meal.tags ? JSON.parse(meal.tags) : []
    }))

    return NextResponse.json({
      meals: enhancedMeals,
      count: meals.length
    })
  } catch (error) {
    console.error('Failed to fetch restaurant meals:', error)
    return NextResponse.json({ error: 'Failed to fetch meals' }, { status: 500 })
  }
}