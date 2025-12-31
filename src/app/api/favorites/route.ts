import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - Fetch all favorites for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    const favorites = await prisma.favoriteMeal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    })

    // Parse tags from JSON string
    const parsedFavorites = favorites.map(fav => ({
      ...fav,
      tags: fav.tags ? JSON.parse(fav.tags) : []
    }))

    return NextResponse.json({ favorites: parsedFavorites })
  } catch (error) {
    console.error('Failed to fetch favorites:', error)
    return NextResponse.json({ error: 'Failed to fetch favorites' }, { status: 500 })
  }
}

// POST - Add a meal to favorites
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, name, description, source, restaurant, calories, protein, carbs, fat, tags } = body

    if (!userId || !name || !source || calories === undefined || protein === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Check if already favorited (by name + restaurant + userId)
    const existing = await prisma.favoriteMeal.findFirst({
      where: {
        userId,
        name,
        restaurant: restaurant || null
      }
    })

    if (existing) {
      return NextResponse.json({
        error: 'Already favorited',
        favorite: existing,
        alreadyExists: true
      }, { status: 200 })
    }

    const favorite = await prisma.favoriteMeal.create({
      data: {
        userId,
        name,
        description: description || null,
        source,
        restaurant: restaurant || null,
        calories: Math.round(calories),
        protein: Math.round(protein),
        carbs: Math.round(carbs || 0),
        fat: Math.round(fat || 0),
        tags: tags ? JSON.stringify(tags) : '[]'
      }
    })

    return NextResponse.json({ success: true, favorite })
  } catch (error) {
    console.error('Failed to add favorite:', error)
    return NextResponse.json({ error: 'Failed to add favorite' }, { status: 500 })
  }
}

// DELETE - Remove a meal from favorites
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const favoriteId = searchParams.get('id')
    const userId = searchParams.get('userId')

    // Alternative: delete by meal details
    const name = searchParams.get('name')
    const restaurant = searchParams.get('restaurant')

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    if (favoriteId) {
      // Delete by ID
      await prisma.favoriteMeal.delete({
        where: { id: favoriteId }
      })
    } else if (name) {
      // Delete by name + restaurant
      await prisma.favoriteMeal.deleteMany({
        where: {
          userId,
          name,
          restaurant: restaurant || null
        }
      })
    } else {
      return NextResponse.json({ error: 'Favorite ID or name required' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to remove favorite:', error)
    return NextResponse.json({ error: 'Failed to remove favorite' }, { status: 500 })
  }
}
