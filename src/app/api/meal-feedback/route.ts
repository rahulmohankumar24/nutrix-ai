import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    const {
      userId,
      aiGeneratedMealId,
      suggestedCalories,
      suggestedProtein,
      suggestedCarbs,
      suggestedFat,
      feedbackType,
      caloriesFeedback,
      proteinFeedback,
      comment
    } = await request.json()

    if (!userId || !aiGeneratedMealId || !feedbackType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Get the current meal data
    const meal = await prisma.aiGeneratedMeal.findUnique({
      where: { id: aiGeneratedMealId },
      include: { feedback: true }
    })

    if (!meal) {
      return NextResponse.json(
        { error: 'Meal not found' },
        { status: 404 }
      )
    }

    // Build detailed comment from individual feedbacks
    const feedbackDetails: string[] = []
    if (caloriesFeedback) {
      feedbackDetails.push(`Calories: ${caloriesFeedback}${suggestedCalories ? ` (suggested: ${suggestedCalories})` : ''}`)
    }
    if (proteinFeedback) {
      feedbackDetails.push(`Protein: ${proteinFeedback}${suggestedProtein ? ` (suggested: ${suggestedProtein}g)` : ''}`)
    }
    const detailedComment = feedbackDetails.length > 0
      ? feedbackDetails.join(', ') + (comment ? `. ${comment}` : '')
      : comment

    // Create the feedback
    const feedback = await prisma.mealFeedback.create({
      data: {
        userId,
        aiGeneratedMealId,
        suggestedCalories,
        suggestedProtein,
        suggestedCarbs,
        suggestedFat,
        feedbackType,
        comment: detailedComment,
        helpful: true
      }
    })

    // Recalculate average adjustments from all feedback
    const allFeedback = await prisma.mealFeedback.findMany({
      where: { aiGeneratedMealId }
    })

    const feedbackWithSuggestions = allFeedback.filter(f =>
      f.suggestedCalories !== null ||
      f.suggestedProtein !== null ||
      f.suggestedCarbs !== null ||
      f.suggestedFat !== null
    )

    let avgCaloriesAdjustment = 0
    let avgProteinAdjustment = 0
    let avgCarbsAdjustment = 0
    let avgFatAdjustment = 0

    // Calculate averages only if there are valid suggestions for each macro
    const caloriesSuggestions = feedbackWithSuggestions.filter(f => f.suggestedCalories !== null)
    if (caloriesSuggestions.length > 0) {
      avgCaloriesAdjustment = Math.round(
        caloriesSuggestions.reduce((sum, f) => sum + ((f.suggestedCalories || 0) - meal.calories), 0) /
        caloriesSuggestions.length
      )
    }

    const proteinSuggestions = feedbackWithSuggestions.filter(f => f.suggestedProtein !== null)
    if (proteinSuggestions.length > 0) {
      avgProteinAdjustment = Math.round(
        proteinSuggestions.reduce((sum, f) => sum + ((f.suggestedProtein || 0) - meal.protein), 0) /
        proteinSuggestions.length
      )
    }

    const carbsSuggestions = feedbackWithSuggestions.filter(f => f.suggestedCarbs !== null)
    if (carbsSuggestions.length > 0) {
      avgCarbsAdjustment = Math.round(
        carbsSuggestions.reduce((sum, f) => sum + ((f.suggestedCarbs || 0) - meal.carbs), 0) /
        carbsSuggestions.length
      )
    }

    const fatSuggestions = feedbackWithSuggestions.filter(f => f.suggestedFat !== null)
    if (fatSuggestions.length > 0) {
      avgFatAdjustment = Math.round(
        fatSuggestions.reduce((sum, f) => sum + ((f.suggestedFat || 0) - meal.fat), 0) /
        fatSuggestions.length
      )
    }

    // Calculate confidence score (increases with feedback, especially "accurate" feedback)
    const accurateFeedbackCount = allFeedback.filter(f => f.feedbackType === 'accurate').length
    const totalFeedbackCount = allFeedback.length
    const newConfidenceScore = Math.min(
      0.95,
      meal.confidenceScore + (accurateFeedbackCount * 0.1) + (totalFeedbackCount * 0.02)
    )

    // Update the meal with aggregated feedback
    const updatedMeal = await prisma.aiGeneratedMeal.update({
      where: { id: aiGeneratedMealId },
      data: {
        feedbackCount: totalFeedbackCount,
        avgCaloriesAdjustment,
        avgProteinAdjustment,
        avgCarbsAdjustment,
        avgFatAdjustment,
        confidenceScore: newConfidenceScore,
        // Update source if enough people verify it
        source: totalFeedbackCount >= 5 && newConfidenceScore >= 0.8
          ? 'user_verified'
          : meal.source
      }
    })

    console.log(`✅ Feedback saved for meal ${meal.title}. New confidence: ${newConfidenceScore.toFixed(2)}`)

    return NextResponse.json({
      success: true,
      feedback,
      updatedMeal: {
        ...updatedMeal,
        calories: updatedMeal.calories + updatedMeal.avgCaloriesAdjustment,
        protein: updatedMeal.protein + updatedMeal.avgProteinAdjustment,
        carbs: updatedMeal.carbs + updatedMeal.avgCarbsAdjustment,
        fat: updatedMeal.fat + updatedMeal.avgFatAdjustment
      }
    })
  } catch (error) {
    console.error('Meal feedback error:', error)
    return NextResponse.json(
      { error: 'Failed to save feedback' },
      { status: 500 }
    )
  }
}
