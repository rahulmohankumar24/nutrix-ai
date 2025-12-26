import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const [orderTemplates, catalogItems] = await Promise.all([
      prisma.orderTemplate.findMany({
        orderBy: { restaurantBrand: 'asc' }
      }),
      prisma.foodCatalogItem.findMany({
        orderBy: { name: 'asc' }
      })
    ])

    return NextResponse.json({
      orderTemplates,
      catalogItems
    })
  } catch (error) {
    console.error('Meals API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch meals' },
      { status: 500 }
    )
  }
}