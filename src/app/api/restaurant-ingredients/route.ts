import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const restaurantBrand = searchParams.get('restaurantBrand')
    const useAI = searchParams.get('useAI') === 'true'

    if (!restaurantBrand) {
      return NextResponse.json({ error: 'Restaurant brand required' }, { status: 400 })
    }

    // Get available ingredients/components for this restaurant
    const ingredients = await prisma.foodCatalogItem.findMany({
      where: {
        source: 'restaurant',
        tags: {
          contains: restaurantBrand.toLowerCase()
        }
      },
      orderBy: {
        name: 'asc'
      }
    })

    let enhancedIngredients;

    if (useAI && process.env.OPENAI_API_KEY) {
      // Use AI categorization for more intelligent results
      try {
        const aiCategorizationResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/ai-ingredient-categorizer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ingredients: ingredients.map(ing => ({
              name: ing.name,
              calories: ing.calories,
              protein: ing.protein,
              carbs: ing.carbs,
              fat: ing.fat
            })),
            restaurantContext: restaurantBrand
          })
        })

        if (aiCategorizationResponse.ok) {
          const aiResult = await aiCategorizationResponse.json()
          const aiCategories = aiResult.categorization?.categorizedIngredients || []

          // Enhance ingredients with AI categorization
          enhancedIngredients = ingredients.map(ingredient => {
            const aiData = aiCategories.find((ai: any) => ai.name === ingredient.name) || {}
            return {
              ...ingredient,
              tags: ingredient.tags ? JSON.parse(ingredient.tags) : [],
              category: aiData.category || categorizeIngredient(ingredient.name, ingredient.tags ? JSON.parse(ingredient.tags) : []),
              aiEnhanced: !!aiData.category,
              primaryFunction: aiData.primaryFunction,
              secondaryCategories: aiData.secondaryCategories || [],
              buildingRole: aiData.buildingRole,
              macroProfile: aiData.macroProfile,
              confidence: aiData.confidence
            }
          })
        } else {
          // Fallback to rule-based categorization
          enhancedIngredients = ingredients.map(ingredient => ({
            ...ingredient,
            tags: ingredient.tags ? JSON.parse(ingredient.tags) : [],
            category: categorizeIngredient(ingredient.name, ingredient.tags ? JSON.parse(ingredient.tags) : []),
            aiEnhanced: false
          }))
        }
      } catch (aiError) {
        console.error('AI categorization failed, falling back to rule-based:', aiError)
        // Fallback to rule-based categorization
        enhancedIngredients = ingredients.map(ingredient => ({
          ...ingredient,
          tags: ingredient.tags ? JSON.parse(ingredient.tags) : [],
          category: categorizeIngredient(ingredient.name, ingredient.tags ? JSON.parse(ingredient.tags) : []),
          aiEnhanced: false
        }))
      }
    } else {
      // Use rule-based categorization
      enhancedIngredients = ingredients.map(ingredient => ({
        ...ingredient,
        tags: ingredient.tags ? JSON.parse(ingredient.tags) : [],
        category: categorizeIngredient(ingredient.name, ingredient.tags ? JSON.parse(ingredient.tags) : []),
        aiEnhanced: false
      }))
    }

    // Group by category for easier meal building
    const categorizedIngredients = groupByCategory(enhancedIngredients)

    return NextResponse.json({
      ingredients: enhancedIngredients,
      categorized: categorizedIngredients,
      count: ingredients.length,
      restaurantBrand,
      aiEnhanced: useAI && enhancedIngredients.some((ing: any) => ing.aiEnhanced)
    })
  } catch (error) {
    console.error('Failed to fetch restaurant ingredients:', error)
    return NextResponse.json({ error: 'Failed to fetch ingredients' }, { status: 500 })
  }
}

function categorizeIngredient(name: string, tags: string[]): string {
  const lowerName = name.toLowerCase()
  const lowerTags = tags.map(tag => tag.toLowerCase())

  // Check tags first
  if (lowerTags.includes('protein') || lowerTags.includes('meat')) return 'protein'
  if (lowerTags.includes('base') || lowerTags.includes('grain')) return 'base'
  if (lowerTags.includes('vegetable') || lowerTags.includes('veggie')) return 'vegetables'
  if (lowerTags.includes('sauce') || lowerTags.includes('dressing')) return 'sauces'
  if (lowerTags.includes('topping') || lowerTags.includes('extra')) return 'toppings'

  // Fallback to name-based categorization
  if (lowerName.includes('chicken') || lowerName.includes('beef') || lowerName.includes('lamb') ||
      lowerName.includes('salmon') || lowerName.includes('steak') || lowerName.includes('pork') ||
      lowerName.includes('tofu') || lowerName.includes('falafel') || lowerName.includes('meatball')) {
    return 'protein'
  }

  if (lowerName.includes('rice') || lowerName.includes('quinoa') || lowerName.includes('pita') ||
      lowerName.includes('bread') || lowerName.includes('tortilla') || lowerName.includes('bowl') ||
      lowerName.includes('base') || lowerName.includes('grain')) {
    return 'base'
  }

  if (lowerName.includes('tomato') || lowerName.includes('cucumber') || lowerName.includes('onion') ||
      lowerName.includes('pepper') || lowerName.includes('lettuce') || lowerName.includes('spinach') ||
      lowerName.includes('cabbage') || lowerName.includes('carrot') || lowerName.includes('corn') ||
      lowerName.includes('bean') || lowerName.includes('olive')) {
    return 'vegetables'
  }

  if (lowerName.includes('sauce') || lowerName.includes('dressing') || lowerName.includes('hummus') ||
      lowerName.includes('vinaigrette') || lowerName.includes('tahini') || lowerName.includes('tzatziki')) {
    return 'sauces'
  }

  if (lowerName.includes('cheese') || lowerName.includes('avocado') || lowerName.includes('nuts') ||
      lowerName.includes('seeds') || lowerName.includes('crumble') || lowerName.includes('chip')) {
    return 'toppings'
  }

  return 'other'
}

function groupByCategory(ingredients: any[]) {
  return ingredients.reduce((acc, ingredient) => {
    const category = ingredient.category
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(ingredient)
    return acc
  }, {} as Record<string, any[]>)
}