/**
 * Test script to verify dynamic meal generation
 * Run: npx ts-node scripts/test-dynamic-meals.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testDynamicMeals() {
  console.log('=== Testing Dynamic Meal Generation ===\n')

  // Check if ingredient data exists
  const restaurants = ['chipotle', 'cava', 'sweetgreen', 'panera', 'panda express']

  for (const restaurant of restaurants) {
    const ingredients = await prisma.foodCatalogItem.findMany({
      where: {
        source: 'restaurant',
        tags: { contains: restaurant.toLowerCase() }
      }
    })

    if (ingredients.length > 0) {
      console.log(`✅ ${restaurant}: ${ingredients.length} ingredients found`)

      // Show some examples
      const proteins = ingredients.filter(i =>
        i.name.toLowerCase().includes('chicken') ||
        i.name.toLowerCase().includes('steak') ||
        i.name.toLowerCase().includes('beef')
      )
      const bases = ingredients.filter(i =>
        i.name.toLowerCase().includes('rice') ||
        i.name.toLowerCase().includes('tortilla')
      )

      console.log(`   Proteins: ${proteins.map(p => `${p.name} (${p.protein}g)`).join(', ') || 'none'}`)
      console.log(`   Bases: ${bases.map(b => `${b.name} (${b.calories}cal)`).join(', ') || 'none'}`)
    } else {
      console.log(`❌ ${restaurant}: No ingredients found`)
      console.log(`   Run: node scripts/seed-restaurant-ingredients.js`)
    }
    console.log('')
  }

  // Test the meal-suggestions API simulation
  console.log('\n=== Simulating Meal Target Calculation ===')

  const targetCalories = 1815
  const targetProtein = 89

  console.log(`Target: ${targetCalories} cal, ${targetProtein}g protein\n`)

  // Check if we can build a meal close to target from Chipotle ingredients
  const chipotleIngredients = await prisma.foodCatalogItem.findMany({
    where: {
      source: 'restaurant',
      tags: { contains: 'chipotle' }
    }
  })

  if (chipotleIngredients.length > 0) {
    // Find best protein
    const chicken = chipotleIngredients.find(i => i.name.toLowerCase().includes('chicken'))
    const rice = chipotleIngredients.find(i => i.name.toLowerCase().includes('white rice') || i.name.toLowerCase().includes('rice'))
    const beans = chipotleIngredients.find(i => i.name.toLowerCase().includes('black beans') || i.name.toLowerCase().includes('beans'))
    const guac = chipotleIngredients.find(i => i.name.toLowerCase().includes('guac'))
    const cheese = chipotleIngredients.find(i => i.name.toLowerCase().includes('cheese'))

    if (chicken && rice) {
      // Calculate a "FEAST" meal (everything!)
      let totalCal = 0
      let totalProtein = 0
      const parts: string[] = []

      // Double rice
      if (rice) {
        totalCal += rice.calories * 2
        totalProtein += rice.protein * 2
        parts.push(`Double ${rice.name} (${Math.round(rice.calories * 2)}cal)`)
      }

      // Double chicken
      if (chicken) {
        totalCal += chicken.calories * 2
        totalProtein += chicken.protein * 2
        parts.push(`Double ${chicken.name} (${Math.round(chicken.calories * 2)}cal, ${Math.round(chicken.protein * 2)}g protein)`)
      }

      // Beans
      if (beans) {
        totalCal += beans.calories
        totalProtein += beans.protein
        parts.push(`${beans.name} (${beans.calories}cal)`)
      }

      // Guac
      if (guac) {
        totalCal += guac.calories
        totalProtein += guac.protein
        parts.push(`${guac.name} (${guac.calories}cal)`)
      }

      // Cheese
      if (cheese) {
        totalCal += cheese.calories
        totalProtein += cheese.protein
        parts.push(`${cheese.name} (${cheese.calories}cal)`)
      }

      // Sour cream
      const sourCream = chipotleIngredients.find(i => i.name.toLowerCase().includes('sour cream'))
      if (sourCream) {
        totalCal += sourCream.calories
        totalProtein += sourCream.protein
        parts.push(`${sourCream.name} (${sourCream.calories}cal)`)
      }

      // Salsa
      const salsa = chipotleIngredients.find(i => i.name.toLowerCase().includes('salsa'))
      if (salsa) {
        totalCal += salsa.calories
        totalProtein += salsa.protein
        parts.push(`${salsa.name} (${salsa.calories}cal)`)
      }

      console.log('🌯 Chipotle FEAST Combo:')
      parts.forEach(p => console.log(`   - ${p}`))
      console.log(`\n   TOTAL: ${Math.round(totalCal)} cal, ${Math.round(totalProtein)}g protein`)
      console.log(`   Target fit: ${Math.round(totalCal/targetCalories*100)}% cal, ${Math.round(totalProtein/targetProtein*100)}% protein`)

      if (totalCal/targetCalories >= 0.85 && totalProtein/targetProtein >= 0.85) {
        console.log('   ✅ This would hit the target!')
      } else {
        console.log('   ⚠️ Still short of target - may need chips + guac side')
      }

      // Also calculate with chips
      const chips = chipotleIngredients.find(i => i.name.toLowerCase().includes('chips'))
      if (chips) {
        const withChipsCal = totalCal + chips.calories
        console.log(`\n   + Add Chips (${chips.calories}cal) = ${Math.round(withChipsCal)}cal (${Math.round(withChipsCal/targetCalories*100)}%)`)
      }
    }
  } else {
    console.log('❌ No Chipotle ingredients found. Run the seed script first.')
  }

  await prisma.$disconnect()
}

testDynamicMeals().catch(console.error)
