import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET: List all pantry items for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const category = searchParams.get('category')
    const inStock = searchParams.get('inStock')

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    const where: any = { userId }

    if (category && category !== 'all') {
      where.category = category
    }

    if (inStock !== null && inStock !== 'all') {
      where.inStock = inStock === 'true'
    }

    const items = await prisma.pantryItem.findMany({
      where,
      orderBy: [
        { category: 'asc' },
        { name: 'asc' }
      ]
    })

    // Group by category for easier display
    const grouped = items.reduce((acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = []
      }
      acc[item.category].push(item)
      return acc
    }, {} as Record<string, typeof items>)

    return NextResponse.json({
      items,
      grouped,
      totalCount: items.length,
      inStockCount: items.filter(i => i.inStock).length
    })
  } catch (error) {
    console.error('Failed to fetch pantry items:', error)
    return NextResponse.json({ error: 'Failed to fetch pantry items' }, { status: 500 })
  }
}

// POST: Add new pantry item(s)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, items } = body

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Items array required' }, { status: 400 })
    }

    // Create all items
    const createdItems = await prisma.pantryItem.createMany({
      data: items.map((item: any) => ({
        userId,
        name: item.name,
        category: item.category || 'other',
        quantity: item.quantity || null,
        calories: item.calories || null,
        protein: item.protein || null,
        carbs: item.carbs || null,
        fat: item.fat || null,
        servingSize: item.servingSize || null,
        expiresAt: item.expiresAt ? new Date(item.expiresAt) : null,
        source: item.source || 'manual',
        isStaple: item.isStaple || false,
        inStock: true
      }))
    })

    return NextResponse.json({
      success: true,
      count: createdItems.count
    })
  } catch (error) {
    console.error('Failed to add pantry items:', error)
    return NextResponse.json({ error: 'Failed to add pantry items' }, { status: 500 })
  }
}

// PATCH: Update a pantry item
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { itemId, userId, ...updates } = body

    if (!itemId || !userId) {
      return NextResponse.json({ error: 'Item ID and User ID required' }, { status: 400 })
    }

    // Verify ownership
    const existing = await prisma.pantryItem.findFirst({
      where: { id: itemId, userId }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    const updated = await prisma.pantryItem.update({
      where: { id: itemId },
      data: {
        ...updates,
        expiresAt: updates.expiresAt ? new Date(updates.expiresAt) : existing.expiresAt
      }
    })

    return NextResponse.json({ success: true, item: updated })
  } catch (error) {
    console.error('Failed to update pantry item:', error)
    return NextResponse.json({ error: 'Failed to update pantry item' }, { status: 500 })
  }
}

// DELETE: Remove a pantry item
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const itemId = searchParams.get('itemId')
    const userId = searchParams.get('userId')

    if (!itemId || !userId) {
      return NextResponse.json({ error: 'Item ID and User ID required' }, { status: 400 })
    }

    // Verify ownership before deleting
    const existing = await prisma.pantryItem.findFirst({
      where: { id: itemId, userId }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    await prisma.pantryItem.delete({
      where: { id: itemId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete pantry item:', error)
    return NextResponse.json({ error: 'Failed to delete pantry item' }, { status: 500 })
  }
}
