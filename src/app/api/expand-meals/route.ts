import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Restaurant-specific customization rules
const restaurantCustomizations = {
  'chipotle': {
    proteins: [
      { name: 'chicken', calories: 180, protein: 32, carbs: 0, fat: 7, multiplier: 1 },
      { name: 'double chicken', calories: 360, protein: 64, carbs: 0, fat: 14, multiplier: 2 },
      { name: 'carnitas', calories: 210, protein: 23, carbs: 0, fat: 12, multiplier: 1 },
      { name: 'barbacoa', calories: 170, protein: 24, carbs: 2, fat: 7, multiplier: 1 },
      { name: 'steak', calories: 150, protein: 21, carbs: 2, fat: 6, multiplier: 1 }
    ],
    bases: [
      { name: 'white rice', calories: 210, protein: 4, carbs: 40, fat: 4, keywords: 'white rice' },
      { name: 'brown rice', calories: 210, protein: 5, carbs: 36, fat: 4, keywords: 'brown rice' },
      { name: 'no rice', calories: 0, protein: 0, carbs: 0, fat: 0, keywords: 'no rice' },
      { name: 'burrito bowl', calories: 0, protein: 0, carbs: 0, fat: 0, keywords: 'bowl' }
    ],
    additions: [
      { name: 'black beans', calories: 120, protein: 8, carbs: 23, fat: 1, keywords: 'black beans' },
      { name: 'pinto beans', calories: 120, protein: 8, carbs: 22, fat: 1, keywords: 'pinto beans' },
      { name: 'no beans', calories: 0, protein: 0, carbs: 0, fat: 0, keywords: 'no beans' },
      { name: 'fajita veggies', calories: 20, protein: 1, carbs: 5, fat: 0, keywords: 'fajita vegetables' },
      { name: 'guacamole', calories: 230, protein: 4, carbs: 8, fat: 22, keywords: 'guacamole' },
      { name: 'cheese', calories: 100, protein: 6, carbs: 1, fat: 8, keywords: 'cheese' },
      { name: 'sour cream', calories: 110, protein: 2, carbs: 2, fat: 10, keywords: 'sour cream' },
      { name: 'salsa', calories: 25, protein: 1, carbs: 5, fat: 0, keywords: 'salsa' }
    ]
  },
  'cava': {
    proteins: [
      { name: 'grilled chicken', calories: 130, protein: 26, carbs: 2, fat: 3, multiplier: 1 },
      { name: 'double grilled chicken', calories: 260, protein: 52, carbs: 4, fat: 6, multiplier: 2 },
      { name: 'lamb meatballs', calories: 200, protein: 15, carbs: 5, fat: 14, multiplier: 1 },
      { name: 'falafel', calories: 170, protein: 6, carbs: 18, fat: 9, multiplier: 1 }
    ],
    bases: [
      { name: 'basmati rice', calories: 170, protein: 3, carbs: 36, fat: 1, keywords: 'basmati rice' },
      { name: 'brown rice', calories: 170, protein: 4, carbs: 34, fat: 2, keywords: 'brown rice' },
      { name: 'greens', calories: 15, protein: 2, carbs: 3, fat: 0, keywords: 'mixed greens' },
      { name: 'super greens', calories: 25, protein: 3, carbs: 5, fat: 0, keywords: 'super greens' }
    ],
    additions: [
      { name: 'hummus', calories: 80, protein: 3, carbs: 6, fat: 6, keywords: 'hummus' },
      { name: 'tzatziki', calories: 60, protein: 3, carbs: 3, fat: 5, keywords: 'tzatziki' },
      { name: 'feta', calories: 90, protein: 6, carbs: 2, fat: 7, keywords: 'feta cheese' },
      { name: 'cucumber', calories: 5, protein: 0, carbs: 1, fat: 0, keywords: 'cucumber' },
      { name: 'tomatoes', calories: 10, protein: 1, carbs: 2, fat: 0, keywords: 'tomatoes' }
    ]
  },
  'sweetgreen': {
    proteins: [
      { name: 'grilled chicken', calories: 140, protein: 26, carbs: 0, fat: 4, multiplier: 1 },
      { name: 'double grilled chicken', calories: 280, protein: 52, carbs: 0, fat: 8, multiplier: 2 },
      { name: 'blackened fish', calories: 120, protein: 24, carbs: 1, fat: 3, multiplier: 1 }
    ],
    bases: [
      { name: 'chopped romaine', calories: 10, protein: 1, carbs: 2, fat: 0, keywords: 'romaine lettuce' },
      { name: 'mesclun', calories: 15, protein: 2, carbs: 3, fat: 0, keywords: 'mesclun greens' },
      { name: 'warm quinoa', calories: 170, protein: 6, carbs: 31, fat: 3, keywords: 'quinoa' }
    ],
    additions: [
      { name: 'avocado', calories: 110, protein: 2, carbs: 6, fat: 10, keywords: 'avocado' },
      { name: 'goat cheese', calories: 70, protein: 5, carbs: 1, fat: 6, keywords: 'goat cheese' },
      { name: 'roasted sweet potato', calories: 60, protein: 1, carbs: 14, fat: 0, keywords: 'sweet potato' }
    ]
  }
}

export async function POST(request: NextRequest) {
  try {
    const { restaurantBrand } = await request.json()

    if (!restaurantBrand) {
      return NextResponse.json({ error: 'Restaurant brand required' }, { status: 400 })
    }

    const customizations = restaurantCustomizations[restaurantBrand.toLowerCase()]
    if (!customizations) {
      return NextResponse.json({ error: 'No customizations available for this restaurant' }, { status: 400 })
    }

    const newMeals = []
    const { proteins, bases, additions } = customizations

    // Generate combinations for this restaurant
    for (const protein of proteins) {
      for (const base of bases) {
        // Create a few popular combinations with different add-ons
        const popularCombinations = [
          [], // base meal
          [additions[0]], // with first addition
          [additions[0], additions[1]], // with two additions
          [additions.find(a => a.name.includes('guac') || a.name.includes('avocado'))].filter(Boolean), // with healthy fats
        ]

        for (const addOnCombo of popularCombinations) {
          if (!addOnCombo) continue

          // Calculate nutrition
          const totalCalories = protein.calories + base.calories + addOnCombo.reduce((sum, item) => sum + item.calories, 0)
          const totalProtein = protein.protein + base.protein + addOnCombo.reduce((sum, item) => sum + item.protein, 0)
          const totalCarbs = protein.carbs + base.carbs + addOnCombo.reduce((sum, item) => sum + item.carbs, 0)
          const totalFat = protein.fat + base.fat + addOnCombo.reduce((sum, item) => sum + item.fat, 0)

          // Create meal title and description
          const addOnNames = addOnCombo.map(item => item.name).join(', ')
          const title = `${protein.name} ${base.name}${addOnNames ? ` with ${addOnNames}` : ''}`
          const description = `${protein.name}, ${base.name}${addOnNames ? `, ${addOnNames}` : ''}`

          // Create keywords for delivery search
          const keywords = [protein.name, base.keywords, ...addOnCombo.map(item => item.keywords)].join(' ')

          // Generate appropriate tags
          const tags = []
          if (totalProtein >= 30) tags.push('high-protein')
          if (totalCarbs <= 20) tags.push('low-carb')
          if (protein.name.includes('double')) tags.push('extra-protein')
          if (addOnCombo.some(item => item.name.includes('guac') || item.name.includes('avocado'))) tags.push('healthy-fats')
          if (!addOnCombo.length) tags.push('simple')

          const meal = {
            restaurantBrand: restaurantBrand.toLowerCase(),
            title: title.charAt(0).toUpperCase() + title.slice(1),
            description: description.charAt(0).toUpperCase() + description.slice(1),
            calories: Math.round(totalCalories),
            protein: Math.round(totalProtein),
            carbs: Math.round(totalCarbs),
            fat: Math.round(totalFat),
            tags: JSON.stringify(tags),
            keywordsForDeliverySearch: keywords
          }

          newMeals.push(meal)
        }
      }
    }

    // Save new meals to database
    const createdMeals = []
    for (const meal of newMeals) {
      // Check if meal already exists to avoid duplicates
      const existing = await prisma.orderTemplate.findFirst({
        where: {
          restaurantBrand: meal.restaurantBrand,
          title: meal.title
        }
      })

      if (!existing) {
        const created = await prisma.orderTemplate.create({ data: meal })
        createdMeals.push(created)
      }
    }

    return NextResponse.json({
      message: `Generated ${createdMeals.length} new meal variations`,
      newMeals: createdMeals,
      totalGenerated: newMeals.length
    })

  } catch (error) {
    console.error('Failed to expand meals:', error)
    return NextResponse.json({ error: 'Failed to expand meals' }, { status: 500 })
  }
}