import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const {
      userId,
      restaurantName,
      restaurantType,
      mealData,
      contributionType,
      notes,
      verification
    } = await request.json()

    if (!userId || !restaurantName || !mealData) {
      return NextResponse.json({ error: 'User ID, restaurant name, and meal data are required' }, { status: 400 })
    }

    // Create a restaurant contribution record
    const contribution = await prisma.restaurantContribution.create({
      data: {
        userId,
        restaurantName: restaurantName.trim(),
        restaurantType: restaurantType || null,
        mealName: mealData.name,
        calories: mealData.calories,
        protein: mealData.protein,
        carbs: mealData.carbs,
        fat: mealData.fat,
        contributionType: contributionType || 'user_input', // 'user_input', 'menu_photo', 'receipt_scan'
        notes: notes || null,
        confidence: verification?.confidence || 'medium',
        source: verification?.source || 'user_reported',
        verified: false, // Requires admin verification
        createdAt: new Date()
      }
    })

    // If multiple users report the same data, automatically verify it
    const similarContributions = await prisma.restaurantContribution.count({
      where: {
        restaurantName: restaurantName.trim(),
        mealName: mealData.name,
        calories: {
          gte: mealData.calories * 0.9, // Within 10% range
          lte: mealData.calories * 1.1
        },
        protein: {
          gte: mealData.protein * 0.9,
          lte: mealData.protein * 1.1
        }
      }
    })

    let autoVerified = false
    if (similarContributions >= 2) { // If 2+ users report similar data
      await prisma.restaurantContribution.updateMany({
        where: {
          restaurantName: restaurantName.trim(),
          mealName: mealData.name,
          verified: false
        },
        data: { verified: true }
      })
      autoVerified = true
    }

    return NextResponse.json({
      success: true,
      contributionId: contribution.id,
      message: autoVerified
        ? 'Thank you! Your contribution has been auto-verified due to multiple confirmations.'
        : 'Thank you for your contribution! It will be reviewed and verified soon.',
      autoVerified,
      similarContributions
    })

  } catch (error) {
    console.error('Restaurant contribution error:', error)
    return NextResponse.json({ error: 'Failed to save contribution' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const restaurantName = searchParams.get('restaurantName')
    const verified = searchParams.get('verified') === 'true'

    if (!restaurantName) {
      return NextResponse.json({ error: 'Restaurant name is required' }, { status: 400 })
    }

    // Get verified contributions for this restaurant
    const contributions = await prisma.restaurantContribution.findMany({
      where: {
        restaurantName: restaurantName.trim(),
        ...(verified && { verified: true })
      },
      orderBy: [
        { verified: 'desc' },
        { createdAt: 'desc' }
      ],
      take: 20
    })

    // Group by meal name and average the macros for verified entries
    const verifiedMeals = contributions
      .filter(c => c.verified)
      .reduce((acc: any, contribution) => {
        const mealName = contribution.mealName
        if (!acc[mealName]) {
          acc[mealName] = {
            name: mealName,
            calories: [],
            protein: [],
            carbs: [],
            fat: [],
            count: 0,
            sources: []
          }
        }

        acc[mealName].calories.push(contribution.calories)
        acc[mealName].protein.push(contribution.protein)
        acc[mealName].carbs.push(contribution.carbs || 0)
        acc[mealName].fat.push(contribution.fat || 0)
        acc[mealName].count++
        acc[mealName].sources.push(contribution.source)

        return acc
      }, {})

    // Calculate averages
    const averagedMeals = Object.values(verifiedMeals).map((meal: any) => ({
      name: meal.name,
      calories: Math.round(meal.calories.reduce((a: number, b: number) => a + b, 0) / meal.calories.length),
      protein: Math.round(meal.protein.reduce((a: number, b: number) => a + b, 0) / meal.protein.length),
      carbs: Math.round(meal.carbs.reduce((a: number, b: number) => a + b, 0) / meal.carbs.length),
      fat: Math.round(meal.fat.reduce((a: number, b: number) => a + b, 0) / meal.fat.length),
      contributionCount: meal.count,
      confidence: meal.count >= 3 ? 'high' : meal.count >= 2 ? 'medium' : 'low',
      verified: true
    }))

    return NextResponse.json({
      success: true,
      restaurantName,
      verifiedMeals: averagedMeals,
      totalContributions: contributions.length,
      verifiedContributions: contributions.filter(c => c.verified).length
    })

  } catch (error) {
    console.error('Failed to get restaurant contributions:', error)
    return NextResponse.json({ error: 'Failed to get contributions' }, { status: 500 })
  }
}