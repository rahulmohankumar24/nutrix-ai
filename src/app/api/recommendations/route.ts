import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateFitScore } from '@/lib/calculations'
import { isKnownChain } from '@/lib/chains'
import { Restaurant, OrderRecommendation } from '@/lib/types'

export async function POST(request: NextRequest) {
  try {
    const { userId, restaurants }: { userId: string; restaurants: Restaurant[] } = await request.json()

    if (!userId || !restaurants) {
      return NextResponse.json(
        { error: 'User ID and restaurants are required' },
        { status: 400 }
      )
    }

    // Get user's remaining macros for today
    const macroResponse = await fetch(`${request.url.replace('/recommendations', '/macro-progress')}?userId=${userId}`)
    if (!macroResponse.ok) {
      throw new Error('Failed to fetch macro progress')
    }
    const macroProgress = await macroResponse.json()

    // Get all order templates for known chains
    const knownRestaurants = restaurants.filter(r => r.isKnown)
    const restaurantBrands = knownRestaurants.map(r => {
      const name = r.name.toLowerCase()
      // Map restaurant names to our template brands
      if (name.includes('chipotle')) return 'chipotle'
      if (name.includes('cava')) return 'cava'
      if (name.includes('sweetgreen')) return 'sweetgreen'
      if (name.includes('subway')) return 'subway'
      if (name.includes('panera')) return 'panera'
      if (name.includes('starbucks')) return 'starbucks'
      if (name.includes('panda')) return 'panda express'
      if (name.includes('chick-fil-a') || name.includes('chick fil a')) return 'chick-fil-a'
      if (name.includes('five guys')) return 'five guys'
      if (name.includes('in-n-out') || name.includes('in n out')) return 'in-n-out'
      if (name.includes('shake shack')) return 'shake shack'
      if (name.includes('habit') && name.includes('burger')) return 'the habit burger'
      if (name.includes('tender greens')) return 'tender greens'
      if (name.includes('flame broiler')) return 'flame broiler'
      if (name.includes('just salad')) return 'just salad'
      if (name.includes('chop\'t') || name.includes('chopt')) return 'chop\'t'
      if (name.includes('dig inn') || (name.includes('dig') && name.includes('inn'))) return 'dig'
      if (name.includes('pret a manger') || name.includes('pret')) return 'pret a manger'
      if (name.includes('joe\'s pizza') || name.includes('joes pizza')) return 'joe\'s pizza'
      if (name.includes('el pollo loco')) return 'el pollo loco'
      if (name.includes('jersey mike')) return 'jersey mike\'s'
      if (name.includes('taco bell')) return 'taco bell'
      if (name.includes('mcdonald')) return 'mcdonald\'s'
      if (name.includes('kfc')) return 'kfc'
      if (name.includes('popeyes')) return 'popeyes'
      if (name.includes('domino')) return 'domino\'s'
      if (name.includes('pizza hut')) return 'pizza hut'
      if (name.includes('jimmy john')) return 'jimmy john\'s'

      // Seattle-specific chains
      if (name.includes('dick\'s drive') || name.includes('dicks drive')) return 'dick\'s drive-in'
      if (name.includes('ivar\'s') || name.includes('ivars')) return 'ivar\'s'
      if (name.includes('teriyaki madness')) return 'teriyaki madness'
      if (name.includes('mod pizza')) return 'mod pizza'
      if (name.includes('ezell\'s') || name.includes('ezells')) return 'ezell\'s famous chicken'
      if (name.includes('pagliacci')) return 'pagliacci pizza'
      if (name.includes('katsu burger')) return 'katsu burger'
      if (name.includes('marination')) return 'marination'
      if (name.includes('paseo')) return 'paseo'
      if (name.includes('serious pie')) return 'serious pie'

      return null
    }).filter(brand => brand !== null) as string[]

    if (restaurantBrands.length === 0) {
      return NextResponse.json({ recommendations: [] })
    }

    const orderTemplates = await prisma.orderTemplate.findMany({
      where: {
        restaurantBrand: {
          in: restaurantBrands
        }
      }
    })

    // Generate recommendations
    const recommendations: OrderRecommendation[] = []

    knownRestaurants.forEach(restaurant => {
      const restaurantBrand = restaurantBrands.find(brand =>
        restaurant.name.toLowerCase().includes(brand!)
      )

      if (!restaurantBrand) return

      const templates = orderTemplates.filter((t: any) => t.restaurantBrand === restaurantBrand)

      templates.forEach((template: any) => {
        const fitScore = calculateFitScore(template, macroProgress.remaining)

        // Generate explanation
        let explanation = 'Good macro fit'
        if (template.protein >= 30) {
          explanation = 'High protein option'
        } else if (template.calories <= 500) {
          explanation = 'Light, balanced meal'
        } else if (fitScore < 50) {
          explanation = 'Perfect macro match'
        }

        recommendations.push({
          template,
          restaurant,
          fitScore,
          explanation
        })
      })
    })

    // Sort by fit score (lower is better) and take top recommendations
    recommendations.sort((a, b) => a.fitScore - b.fitScore)

    return NextResponse.json({
      recommendations: recommendations.slice(0, 12)
    })
  } catch (error) {
    console.error('Recommendations error:', error)
    return NextResponse.json(
      { error: 'Failed to generate recommendations' },
      { status: 500 }
    )
  }
}