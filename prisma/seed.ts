import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'

// Load from .env.local or .env
config({ path: '.env.local' })
config({ path: '.env' })

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting seed...')

  // Clear existing data
  await prisma.orderTemplate.deleteMany({})
  await prisma.foodCatalogItem.deleteMany({})

  // Seed Order Templates for Known Chains (Irvine, SF, NYC focused)
  const orderTemplates = [
    // Chipotle (National)
    {
      restaurantBrand: 'chipotle',
      title: 'Double Chicken Bowl',
      description: 'White rice, black beans, double chicken, fajita veggies, tomato salsa, corn salsa',
      calories: 830,
      protein: 71,
      carbs: 65,
      fat: 32,
      tags: JSON.stringify(['high-protein', 'balanced']),
      keywordsForDeliverySearch: 'double chicken bowl white rice black beans'
    },
    {
      restaurantBrand: 'chipotle',
      title: 'Chicken Burrito Bowl',
      description: 'Brown rice, black beans, chicken, fajita veggies, pico de gallo, guacamole',
      calories: 750,
      protein: 42,
      carbs: 74,
      fat: 28,
      tags: JSON.stringify(['balanced', 'fiber']),
      keywordsForDeliverySearch: 'chicken burrito bowl brown rice guacamole'
    },
    {
      restaurantBrand: 'chipotle',
      title: 'Carnitas Salad Bowl',
      description: 'Romaine, carnitas, black beans, tomato salsa, cheese, light sour cream',
      calories: 520,
      protein: 32,
      carbs: 18,
      fat: 35,
      tags: JSON.stringify(['low-carb', 'keto-friendly']),
      keywordsForDeliverySearch: 'carnitas salad bowl cheese'
    },

    // Cava (National)
    {
      restaurantBrand: 'cava',
      title: 'Grilled Chicken + Rice Bowl',
      description: 'Basmati rice, grilled chicken, roasted vegetables, hummus, tzatziki',
      calories: 680,
      protein: 45,
      carbs: 58,
      fat: 25,
      tags: JSON.stringify(['mediterranean', 'balanced']),
      keywordsForDeliverySearch: 'grilled chicken rice bowl hummus'
    },
    {
      restaurantBrand: 'cava',
      title: 'Lamb Meatball Greens Bowl',
      description: 'Mixed greens, lamb meatballs, roasted red pepper hummus, cucumber, feta',
      calories: 590,
      protein: 38,
      carbs: 24,
      fat: 38,
      tags: JSON.stringify(['low-carb', 'high-protein']),
      keywordsForDeliverySearch: 'lamb meatball greens bowl feta'
    },

    // Sweetgreen (National, popular in all 3 cities) - VERIFIED from sweetgreen.com
    {
      restaurantBrand: 'sweetgreen',
      title: 'Harvest Bowl',
      description: 'Warm quinoa, roasted chicken, roasted sweet potato, apples, goat cheese, balsamic',
      calories: 705,
      protein: 38,
      carbs: 54,
      fat: 39,
      tags: JSON.stringify(['whole-grain', 'seasonal', 'high-protein']),
      keywordsForDeliverySearch: 'harvest bowl chicken quinoa sweet potato'
    },
    {
      restaurantBrand: 'sweetgreen',
      title: 'Chicken Pesto Parm',
      description: 'Warm quinoa, roasted chicken, tomatoes, shaved parmesan, pesto',
      calories: 620,
      protein: 44,
      carbs: 42,
      fat: 32,
      tags: JSON.stringify(['high-protein', 'italian']),
      keywordsForDeliverySearch: 'chicken pesto parm'
    },
    {
      restaurantBrand: 'sweetgreen',
      title: 'Kale Caesar',
      description: 'Chopped kale, roasted chicken, parmesan, caesar dressing, croutons',
      calories: 530,
      protein: 36,
      carbs: 24,
      fat: 34,
      tags: JSON.stringify(['kale', 'caesar', 'high-protein']),
      keywordsForDeliverySearch: 'kale caesar chicken'
    },
    {
      restaurantBrand: 'sweetgreen',
      title: 'Guacamole Greens',
      description: 'Chopped romaine, mesclun, avocado, roasted chicken, tortilla chips',
      calories: 580,
      protein: 34,
      carbs: 32,
      fat: 36,
      tags: JSON.stringify(['avocado', 'balanced']),
      keywordsForDeliverySearch: 'guacamole greens chicken avocado'
    },
    {
      restaurantBrand: 'sweetgreen',
      title: 'Fish Taco Bowl',
      description: 'Warm quinoa, blackened fish, avocado, black beans, cilantro lime dressing',
      calories: 600,
      protein: 36,
      carbs: 54,
      fat: 28,
      tags: JSON.stringify(['pescatarian', 'balanced']),
      keywordsForDeliverySearch: 'fish taco bowl quinoa avocado'
    },

    // In-N-Out (California specific) - VERIFIED from in-n-out.com/menu/nutrition-info
    {
      restaurantBrand: 'in-n-out',
      title: 'Protein Style Double-Double',
      description: 'Two beef patties, two cheese slices, lettuce wrap, tomato, onion, spread (no bun)',
      calories: 520,
      protein: 33,
      carbs: 11,
      fat: 39,
      tags: JSON.stringify(['keto-friendly', 'low-carb', 'california', 'high-protein']),
      keywordsForDeliverySearch: 'protein style double double lettuce wrap'
    },
    {
      restaurantBrand: 'in-n-out',
      title: 'Double-Double',
      description: 'Two beef patties, two cheese slices, lettuce, tomato, onion, spread on bun',
      calories: 610,
      protein: 34,
      carbs: 42,
      fat: 34,
      tags: JSON.stringify(['high-protein', 'california']),
      keywordsForDeliverySearch: 'double double burger'
    },
    {
      restaurantBrand: 'in-n-out',
      title: 'Cheeseburger',
      description: 'Beef patty, cheese, lettuce, tomato, onion, spread on bun',
      calories: 400,
      protein: 19,
      carbs: 41,
      fat: 18,
      tags: JSON.stringify(['california', 'classic']),
      keywordsForDeliverySearch: 'cheeseburger'
    },
    {
      restaurantBrand: 'in-n-out',
      title: '3x3 (Triple Triple)',
      description: 'Three beef patties, three cheese slices, lettuce, tomato, onion, spread',
      calories: 860,
      protein: 48,
      carbs: 42,
      fat: 56,
      tags: JSON.stringify(['high-protein', 'california', 'max']),
      keywordsForDeliverySearch: '3x3 triple triple'
    },
    {
      restaurantBrand: 'in-n-out',
      title: 'Grilled Cheese',
      description: 'Two cheese slices, lettuce, tomato, onion, spread on bun (no meat)',
      calories: 380,
      protein: 16,
      carbs: 41,
      fat: 18,
      tags: JSON.stringify(['vegetarian', 'california']),
      keywordsForDeliverySearch: 'grilled cheese'
    },
    {
      restaurantBrand: 'in-n-out',
      title: 'Grilled Cheese Animal Style',
      description: 'Two cheese slices, lettuce, tomato, grilled onions, extra spread, pickles on bun (no meat)',
      calories: 480,
      protein: 17,
      carbs: 43,
      fat: 26,
      tags: JSON.stringify(['vegetarian', 'california', 'animal-style']),
      keywordsForDeliverySearch: 'grilled cheese animal style'
    },

    // Shake Shack (National, popular in NYC) - VERIFIED from shakeshack.com
    {
      restaurantBrand: 'shake shack',
      title: 'ShackBurger (Single)',
      description: 'Angus beef, lettuce, tomato, ShackSauce on potato bun',
      calories: 530,
      protein: 29,
      carbs: 26,
      fat: 34,
      tags: JSON.stringify(['burger', 'balanced']),
      keywordsForDeliverySearch: 'shackburger single'
    },
    {
      restaurantBrand: 'shake shack',
      title: 'Double ShackBurger',
      description: 'Double angus beef, lettuce, tomato, ShackSauce on potato bun',
      calories: 790,
      protein: 49,
      carbs: 26,
      fat: 55,
      tags: JSON.stringify(['burger', 'high-protein']),
      keywordsForDeliverySearch: 'double shackburger'
    },
    {
      restaurantBrand: 'shake shack',
      title: 'Chicken Shack',
      description: 'Crispy chicken breast, lettuce, pickles, buttermilk herb mayo',
      calories: 580,
      protein: 27,
      carbs: 51,
      fat: 29,
      tags: JSON.stringify(['chicken', 'crispy']),
      keywordsForDeliverySearch: 'chicken shack sandwich'
    },
    {
      restaurantBrand: 'shake shack',
      title: 'Grilled Chicken Sandwich',
      description: 'Herb-marinated grilled chicken, lettuce, tomato, ShackSauce',
      calories: 360,
      protein: 36,
      carbs: 32,
      fat: 10,
      tags: JSON.stringify(['chicken', 'grilled', 'lean']),
      keywordsForDeliverySearch: 'grilled chicken sandwich'
    },

    // The Habit Burger (California) - VERIFIED from habitburger.com/nutritional-information
    {
      restaurantBrand: 'the habit burger',
      title: 'Charburger with Cheese',
      description: 'Charburger patty, American cheese, lettuce, tomato, onion, pickles, mayo on seeded bun',
      calories: 470,
      protein: 24,
      carbs: 34,
      fat: 27,
      tags: JSON.stringify(['burger', 'california']),
      keywordsForDeliverySearch: 'charburger with cheese'
    },
    {
      restaurantBrand: 'the habit burger',
      title: 'Double Charburger with Cheese',
      description: 'Two charburger patties, cheese, lettuce, tomato, onion, pickles, mayo on seeded bun',
      calories: 730,
      protein: 37,
      carbs: 32,
      fat: 49,
      tags: JSON.stringify(['burger', 'california', 'high-protein']),
      keywordsForDeliverySearch: 'double charburger with cheese'
    },
    {
      restaurantBrand: 'the habit burger',
      title: 'Santa Barbara Charburger',
      description: 'Charburger with avocado, bacon, cheese, lettuce, tomato, onion, mayo',
      calories: 720,
      protein: 34,
      carbs: 40,
      fat: 50,
      tags: JSON.stringify(['burger', 'california', 'bacon', 'avocado']),
      keywordsForDeliverySearch: 'santa barbara charburger'
    },
    {
      restaurantBrand: 'the habit burger',
      title: 'Double Santa Barbara Charburger',
      description: 'Double charburger with avocado, bacon, cheese, lettuce, tomato, onion, mayo',
      calories: 1010,
      protein: 54,
      carbs: 42,
      fat: 72,
      tags: JSON.stringify(['burger', 'california', 'high-protein', 'bacon', 'avocado']),
      keywordsForDeliverySearch: 'double santa barbara charburger'
    },
    {
      restaurantBrand: 'the habit burger',
      title: 'Teriyaki Charburger',
      description: 'Charburger with teriyaki sauce, grilled pineapple, lettuce, tomato, onion',
      calories: 510,
      protein: 26,
      carbs: 48,
      fat: 24,
      tags: JSON.stringify(['burger', 'california']),
      keywordsForDeliverySearch: 'teriyaki charburger'
    },
    {
      restaurantBrand: 'the habit burger',
      title: 'BBQ Bacon Charburger',
      description: 'Charburger with BBQ sauce, bacon, onion rings, cheese, lettuce, tomato',
      calories: 730,
      protein: 36,
      carbs: 52,
      fat: 42,
      tags: JSON.stringify(['burger', 'california', 'bacon', 'bbq']),
      keywordsForDeliverySearch: 'bbq bacon charburger'
    },
    {
      restaurantBrand: 'the habit burger',
      title: 'Grilled Chicken Sandwich',
      description: 'Grilled chicken breast, lettuce, tomato, onion, mayo on toasted bun',
      calories: 540,
      protein: 38,
      carbs: 42,
      fat: 24,
      tags: JSON.stringify(['chicken', 'california', 'grilled']),
      keywordsForDeliverySearch: 'grilled chicken sandwich'
    },
    {
      restaurantBrand: 'the habit burger',
      title: 'Crispy Chicken Sandwich',
      description: 'Crispy fried chicken, lettuce, tomato, pickle, mayo on toasted bun',
      calories: 680,
      protein: 32,
      carbs: 58,
      fat: 36,
      tags: JSON.stringify(['chicken', 'california', 'crispy']),
      keywordsForDeliverySearch: 'crispy chicken sandwich'
    },
    {
      restaurantBrand: 'the habit burger',
      title: 'Ahi Tuna Sandwich',
      description: 'Seared ahi tuna, teriyaki sauce, lettuce, tomato, wasabi mayo',
      calories: 560,
      protein: 42,
      carbs: 44,
      fat: 24,
      tags: JSON.stringify(['pescatarian', 'california', 'healthy']),
      keywordsForDeliverySearch: 'ahi tuna sandwich'
    },
    {
      restaurantBrand: 'the habit burger',
      title: 'Grilled Chicken Salad',
      description: 'Grilled chicken breast, mixed greens, tomato, cucumber, croutons, balsamic',
      calories: 420,
      protein: 42,
      carbs: 24,
      fat: 18,
      tags: JSON.stringify(['salad', 'california', 'healthy', 'high-protein']),
      keywordsForDeliverySearch: 'grilled chicken salad'
    },
    {
      restaurantBrand: 'the habit burger',
      title: 'Tri-Tip Sandwich',
      description: 'Grilled tri-tip steak, caramelized onions, cheese, horseradish mayo',
      calories: 640,
      protein: 46,
      carbs: 44,
      fat: 32,
      tags: JSON.stringify(['steak', 'california', 'high-protein']),
      keywordsForDeliverySearch: 'tri-tip sandwich'
    },
    {
      restaurantBrand: 'the habit burger',
      title: 'Portabella Charburger',
      description: 'Charburger with grilled portabella mushroom, swiss cheese, roasted garlic aioli',
      calories: 580,
      protein: 28,
      carbs: 42,
      fat: 34,
      tags: JSON.stringify(['burger', 'california', 'mushroom']),
      keywordsForDeliverySearch: 'portabella charburger'
    },

    // Tender Greens (California)
    {
      restaurantBrand: 'tender greens',
      title: 'Grilled Chicken Salad',
      description: 'Free-range chicken, mixed greens, avocado, cucumber, balsamic vinaigrette',
      calories: 520,
      protein: 38,
      carbs: 18,
      fat: 34,
      tags: JSON.stringify(['salad', 'california', 'free-range']),
      keywordsForDeliverySearch: 'grilled chicken salad avocado'
    },
    {
      restaurantBrand: 'tender greens',
      title: 'Steak + Farro Bowl',
      description: 'Grilled steak, farro, roasted vegetables, chimichurri',
      calories: 680,
      protein: 41,
      carbs: 58,
      fat: 29,
      tags: JSON.stringify(['steak', 'whole-grain', 'california']),
      keywordsForDeliverySearch: 'steak farro bowl chimichurri'
    },

    // Flame Broiler (California - Orange County/Irvine area)
    {
      restaurantBrand: 'flame broiler',
      title: 'Chicken Bowl',
      description: 'Grilled chicken breast, steamed rice, teriyaki sauce',
      calories: 480,
      protein: 42,
      carbs: 58,
      fat: 8,
      tags: JSON.stringify(['lean', 'asian', 'california', 'irvine']),
      keywordsForDeliverySearch: 'chicken bowl steamed rice'
    },
    {
      restaurantBrand: 'flame broiler',
      title: 'Chicken & Beef Bowl',
      description: 'Half chicken, half beef, steamed rice, teriyaki sauce',
      calories: 520,
      protein: 38,
      carbs: 56,
      fat: 12,
      tags: JSON.stringify(['combo', 'asian', 'california']),
      keywordsForDeliverySearch: 'chicken beef bowl'
    },

    // Just Salad (NYC)
    {
      restaurantBrand: 'just salad',
      title: 'Tokyo Supergreens',
      description: 'Mixed greens, edamame, cucumbers, carrots, sesame ginger dressing',
      calories: 420,
      protein: 18,
      carbs: 32,
      fat: 26,
      tags: JSON.stringify(['vegan', 'asian', 'nyc']),
      keywordsForDeliverySearch: 'tokyo supergreens edamame'
    },
    {
      restaurantBrand: 'just salad',
      title: 'Chicken Poblano',
      description: 'Grilled chicken, black beans, corn, pepper jack, poblano ranch',
      calories: 580,
      protein: 42,
      carbs: 28,
      fat: 34,
      tags: JSON.stringify(['mexican', 'high-protein', 'nyc']),
      keywordsForDeliverySearch: 'chicken poblano black beans'
    },

    // Chop\'t (NYC)
    {
      restaurantBrand: 'chop\'t',
      title: 'Mexican Caesar',
      description: 'Romaine, grilled chicken, avocado, tortilla strips, caesar dressing',
      calories: 630,
      protein: 38,
      carbs: 24,
      fat: 42,
      tags: JSON.stringify(['mexican', 'caesar', 'nyc']),
      keywordsForDeliverySearch: 'mexican caesar chicken avocado'
    },
    {
      restaurantBrand: 'chop\'t',
      title: 'Kale Caesar',
      description: 'Kale, grilled chicken, parmesan, croutons, caesar dressing',
      calories: 560,
      protein: 36,
      carbs: 26,
      fat: 36,
      tags: JSON.stringify(['kale', 'caesar', 'nyc']),
      keywordsForDeliverySearch: 'kale caesar chicken'
    },

    // Dig (NYC)
    {
      restaurantBrand: 'dig',
      title: 'Roasted Chicken + Vegetables',
      description: 'Roasted chicken thigh, roasted vegetables, quinoa',
      calories: 620,
      protein: 42,
      carbs: 48,
      fat: 28,
      tags: JSON.stringify(['farm-to-table', 'nyc', 'roasted']),
      keywordsForDeliverySearch: 'roasted chicken vegetables quinoa'
    },
    {
      restaurantBrand: 'dig',
      title: 'Meatballs + Greens',
      description: 'Turkey meatballs, market greens, sweet potatoes',
      calories: 540,
      protein: 36,
      carbs: 42,
      fat: 24,
      tags: JSON.stringify(['turkey', 'nyc', 'farm-to-table']),
      keywordsForDeliverySearch: 'turkey meatballs market greens'
    },

    // Pret A Manger (NYC)
    {
      restaurantBrand: 'pret a manger',
      title: 'Chicken & Avocado Salad',
      description: 'Grilled chicken, avocado, mixed leaves, cherry tomatoes, balsamic',
      calories: 480,
      protein: 32,
      carbs: 18,
      fat: 32,
      tags: JSON.stringify(['british', 'avocado', 'nyc']),
      keywordsForDeliverySearch: 'chicken avocado salad'
    },
    {
      restaurantBrand: 'pret a manger',
      title: 'Tuna & Cucumber Baguette',
      description: 'Tuna salad, cucumber, mixed leaves on whole grain baguette',
      calories: 420,
      protein: 28,
      carbs: 38,
      fat: 18,
      tags: JSON.stringify(['seafood', 'sandwich', 'nyc']),
      keywordsForDeliverySearch: 'tuna cucumber baguette'
    },

    // Joe\'s Pizza (NYC)
    {
      restaurantBrand: 'joe\'s pizza',
      title: 'Cheese Slice',
      description: 'Classic NY-style cheese pizza slice',
      calories: 290,
      protein: 12,
      carbs: 36,
      fat: 12,
      tags: JSON.stringify(['pizza', 'classic', 'nyc']),
      keywordsForDeliverySearch: 'cheese slice pizza'
    },
    {
      restaurantBrand: 'joe\'s pizza',
      title: 'Pepperoni Slice',
      description: 'NY-style pizza with pepperoni',
      calories: 340,
      protein: 15,
      carbs: 36,
      fat: 17,
      tags: JSON.stringify(['pizza', 'pepperoni', 'nyc']),
      keywordsForDeliverySearch: 'pepperoni slice pizza'
    },

    // El Pollo Loco (California)
    {
      restaurantBrand: 'el pollo loco',
      title: 'Chicken Power Bowl',
      description: 'Fire-grilled chicken, cilantro lime rice, black beans, salsa',
      calories: 560,
      protein: 46,
      carbs: 52,
      fat: 18,
      tags: JSON.stringify(['mexican', 'grilled', 'california']),
      keywordsForDeliverySearch: 'chicken power bowl cilantro rice'
    },
    {
      restaurantBrand: 'el pollo loco',
      title: 'Chicken Tostada Salad',
      description: 'Fire-grilled chicken, mixed greens, beans, cheese, salsa in tortilla bowl',
      calories: 480,
      protein: 36,
      carbs: 32,
      fat: 24,
      tags: JSON.stringify(['mexican', 'salad', 'california']),
      keywordsForDeliverySearch: 'chicken tostada salad'
    },

    // Panda Express (National, very popular in CA) - VERIFIED from pandaexpress.com
    {
      restaurantBrand: 'panda express',
      title: 'Grilled Teriyaki Chicken (Entree)',
      description: 'Grilled chicken with teriyaki glaze, order with sides separately',
      calories: 300,
      protein: 36,
      carbs: 8,
      fat: 13,
      tags: JSON.stringify(['asian', 'lean', 'high-protein']),
      keywordsForDeliverySearch: 'grilled teriyaki chicken'
    },
    {
      restaurantBrand: 'panda express',
      title: 'Grilled Teriyaki Chicken Plate',
      description: 'Grilled teriyaki chicken, fried rice, super greens',
      calories: 620,
      protein: 42,
      carbs: 64,
      fat: 20,
      tags: JSON.stringify(['asian', 'balanced']),
      keywordsForDeliverySearch: 'grilled teriyaki chicken plate fried rice'
    },
    {
      restaurantBrand: 'panda express',
      title: 'String Bean Chicken Breast (Entree)',
      description: 'Chicken breast wok-tossed with string beans and onions',
      calories: 190,
      protein: 14,
      carbs: 13,
      fat: 9,
      tags: JSON.stringify(['vegetable', 'lean']),
      keywordsForDeliverySearch: 'string bean chicken breast'
    },
    {
      restaurantBrand: 'panda express',
      title: 'Double Protein Bowl',
      description: 'Double grilled teriyaki chicken, super greens, brown rice',
      calories: 730,
      protein: 72,
      carbs: 58,
      fat: 26,
      tags: JSON.stringify(['high-protein', 'lean']),
      keywordsForDeliverySearch: 'double protein bowl teriyaki chicken'
    },
    {
      restaurantBrand: 'panda express',
      title: 'Mushroom Chicken + Super Greens',
      description: 'Mushroom chicken (entree only), super greens side',
      calories: 250,
      protein: 15,
      carbs: 16,
      fat: 14,
      tags: JSON.stringify(['low-carb', 'vegetables']),
      keywordsForDeliverySearch: 'mushroom chicken super greens'
    },
    {
      restaurantBrand: 'panda express',
      title: 'Kung Pao Chicken + Steamed Rice',
      description: 'Kung pao chicken, steamed white rice',
      calories: 560,
      protein: 22,
      carbs: 72,
      fat: 20,
      tags: JSON.stringify(['spicy', 'asian']),
      keywordsForDeliverySearch: 'kung pao chicken rice'
    },

    // Jersey Mike\'s (National)
    {
      restaurantBrand: 'jersey mike\'s',
      title: 'Turkey & Provolone in a Tub',
      description: 'Turkey, provolone, lettuce, tomato, onion, oil & vinegar (no bread)',
      calories: 380,
      protein: 28,
      carbs: 8,
      fat: 26,
      tags: JSON.stringify(['low-carb', 'deli']),
      keywordsForDeliverySearch: 'turkey provolone in a tub'
    },
    {
      restaurantBrand: 'jersey mike\'s',
      title: 'Chicken Philly',
      description: 'Grilled chicken, peppers, onions, white American cheese on sub roll',
      calories: 680,
      protein: 48,
      carbs: 52,
      fat: 28,
      tags: JSON.stringify(['sandwich', 'philly']),
      keywordsForDeliverySearch: 'chicken philly peppers onions'
    },

    // Subway (National) - VERIFIED from subway.com nutrition
    {
      restaurantBrand: 'subway',
      title: '6" Turkey Breast Sub',
      description: 'Turkey breast, lettuce, tomato, onion on 9-grain wheat (no cheese, no mayo)',
      calories: 280,
      protein: 18,
      carbs: 46,
      fat: 4,
      tags: JSON.stringify(['lean-protein', 'low-fat']),
      keywordsForDeliverySearch: '6 inch turkey breast sub'
    },
    {
      restaurantBrand: 'subway',
      title: '6" Rotisserie Chicken Sub',
      description: 'Rotisserie chicken, lettuce, tomato, onion on 9-grain wheat',
      calories: 340,
      protein: 28,
      carbs: 44,
      fat: 7,
      tags: JSON.stringify(['chicken', 'lean']),
      keywordsForDeliverySearch: '6 inch rotisserie chicken sub'
    },
    {
      restaurantBrand: 'subway',
      title: 'Chicken & Bacon Ranch (6")',
      description: '6" whole wheat, grilled chicken, bacon, lettuce, tomato, ranch',
      calories: 570,
      protein: 36,
      carbs: 48,
      fat: 26,
      tags: JSON.stringify(['sandwich', 'protein', 'bacon']),
      keywordsForDeliverySearch: 'chicken bacon ranch 6 inch'
    },
    {
      restaurantBrand: 'subway',
      title: 'Turkey & Ham Protein Bowl',
      description: 'Spinach, turkey, ham, cucumbers, tomatoes, green peppers',
      calories: 160,
      protein: 18,
      carbs: 10,
      fat: 5,
      tags: JSON.stringify(['low-carb', 'lean-protein', 'bowl']),
      keywordsForDeliverySearch: 'turkey ham protein bowl'
    },
    {
      restaurantBrand: 'subway',
      title: 'Steak & Cheese (6")',
      description: '6" steak with American cheese, onions, peppers',
      calories: 390,
      protein: 26,
      carbs: 46,
      fat: 12,
      tags: JSON.stringify(['steak', 'cheese']),
      keywordsForDeliverySearch: '6 inch steak cheese sub'
    },

    // Panera (National) - VERIFIED from panerabread.com (2024 nutrition guide)
    {
      restaurantBrand: 'panera',
      title: 'Greek Chicken Bowl',
      description: 'Quinoa, grilled chicken, cucumber, tomato, feta, tahini dressing',
      calories: 550,
      protein: 37,
      carbs: 48,
      fat: 24,
      tags: JSON.stringify(['mediterranean', 'whole-grain', 'high-protein']),
      keywordsForDeliverySearch: 'greek chicken bowl quinoa feta'
    },
    {
      restaurantBrand: 'panera',
      title: 'Green Goddess Cobb Salad with Chicken (Whole)',
      description: 'Mixed greens, grilled chicken, avocado, bacon, eggs, green goddess dressing',
      calories: 490,
      protein: 40,
      carbs: 24,
      fat: 27,
      tags: JSON.stringify(['salad', 'avocado', 'high-protein']),
      keywordsForDeliverySearch: 'green goddess cobb salad chicken'
    },
    {
      restaurantBrand: 'panera',
      title: 'Mediterranean Bowl with Chicken',
      description: 'Cilantro lime rice, grilled chicken, arugula, hummus, feta',
      calories: 630,
      protein: 37,
      carbs: 58,
      fat: 28,
      tags: JSON.stringify(['mediterranean', 'balanced']),
      keywordsForDeliverySearch: 'mediterranean bowl chicken'
    },
    {
      restaurantBrand: 'panera',
      title: 'Chipotle Chicken Avocado Melt (Whole)',
      description: 'Grilled chicken, smoked gouda, fresh avocado, chipotle aioli on ciabatta',
      calories: 830,
      protein: 47,
      carbs: 58,
      fat: 45,
      tags: JSON.stringify(['sandwich', 'avocado', 'high-protein']),
      keywordsForDeliverySearch: 'chipotle chicken avocado melt'
    },

    // Starbucks (National)
    {
      restaurantBrand: 'starbucks',
      title: 'Protein Box - Eggs & Cheese',
      description: 'Hard-boiled eggs, white cheddar, apple slices, grapes, multigrain muesli',
      calories: 470,
      protein: 21,
      carbs: 43,
      fat: 24,
      tags: JSON.stringify(['breakfast', 'snack']),
      keywordsForDeliverySearch: 'protein box eggs cheese'
    },
    {
      restaurantBrand: 'starbucks',
      title: 'Grilled Chicken & Hummus Bowl',
      description: 'Grilled chicken, hummus, tomatoes, cucumber, feta, warm pita',
      calories: 400,
      protein: 35,
      carbs: 32,
      fat: 15,
      tags: JSON.stringify(['mediterranean', 'lean']),
      keywordsForDeliverySearch: 'grilled chicken hummus bowl'
    },

    // Chick-fil-A (National) - VERIFIED from chick-fil-a.com
    {
      restaurantBrand: 'chick-fil-a',
      title: 'Grilled Chicken Sandwich',
      description: 'Grilled chicken breast, multigrain brioche, lettuce, tomato',
      calories: 320,
      protein: 28,
      carbs: 39,
      fat: 7,
      tags: JSON.stringify(['grilled', 'lean']),
      keywordsForDeliverySearch: 'grilled chicken sandwich'
    },
    {
      restaurantBrand: 'chick-fil-a',
      title: 'Chick-fil-A Chicken Sandwich',
      description: 'Pressure-cooked chicken breast, toasted butter bun, pickles',
      calories: 420,
      protein: 28,
      carbs: 40,
      fat: 17,
      tags: JSON.stringify(['classic', 'crispy']),
      keywordsForDeliverySearch: 'chicken sandwich original'
    },
    {
      restaurantBrand: 'chick-fil-a',
      title: 'Grilled Nuggets (12-count)',
      description: 'Grilled chicken nuggets, 12 pieces',
      calories: 200,
      protein: 38,
      carbs: 2,
      fat: 4,
      tags: JSON.stringify(['grilled', 'lean', 'high-protein']),
      keywordsForDeliverySearch: 'grilled nuggets 12 count'
    },
    {
      restaurantBrand: 'chick-fil-a',
      title: 'Cobb Salad with Grilled Chicken',
      description: 'Mixed greens, grilled chicken, bacon, eggs, cheese, no dressing',
      calories: 430,
      protein: 41,
      carbs: 16,
      fat: 22,
      tags: JSON.stringify(['low-carb', 'salad', 'high-protein']),
      keywordsForDeliverySearch: 'cobb salad grilled chicken'
    },
    {
      restaurantBrand: 'chick-fil-a',
      title: 'Grilled Market Salad',
      description: 'Mixed greens, grilled chicken, berries, blue cheese, no dressing',
      calories: 320,
      protein: 28,
      carbs: 24,
      fat: 14,
      tags: JSON.stringify(['salad', 'berries', 'lean']),
      keywordsForDeliverySearch: 'grilled market salad berries'
    },
    {
      restaurantBrand: 'chick-fil-a',
      title: 'Spicy Deluxe Sandwich',
      description: 'Spicy chicken breast, lettuce, tomato, pepper jack cheese',
      calories: 530,
      protein: 32,
      carbs: 43,
      fat: 26,
      tags: JSON.stringify(['spicy', 'crispy']),
      keywordsForDeliverySearch: 'spicy deluxe sandwich'
    },

    // Dick\'s Drive-In (Seattle icon)
    {
      restaurantBrand: 'dick\'s drive-in',
      title: 'Deluxe Burger',
      description: 'Beef patty, cheese, lettuce, tomato, mayo, pickles on sesame bun',
      calories: 520,
      protein: 23,
      carbs: 38,
      fat: 30,
      tags: JSON.stringify(['burger', 'seattle', 'classic']),
      keywordsForDeliverySearch: 'deluxe burger'
    },
    {
      restaurantBrand: 'dick\'s drive-in',
      title: 'Special Burger',
      description: 'Two beef patties, cheese, lettuce, tomato, special sauce',
      calories: 650,
      protein: 32,
      carbs: 42,
      fat: 38,
      tags: JSON.stringify(['burger', 'seattle', 'double']),
      keywordsForDeliverySearch: 'special burger double'
    },

    // Ivar\'s (Seattle seafood)
    {
      restaurantBrand: 'ivar\'s',
      title: 'Fish & Chips',
      description: 'Beer-battered cod, french fries, coleslaw, tartar sauce',
      calories: 820,
      protein: 35,
      carbs: 78,
      fat: 42,
      tags: JSON.stringify(['seafood', 'seattle', 'fried']),
      keywordsForDeliverySearch: 'fish and chips cod'
    },
    {
      restaurantBrand: 'ivar\'s',
      title: 'Grilled Salmon',
      description: 'Grilled salmon fillet, rice pilaf, seasonal vegetables',
      calories: 580,
      protein: 42,
      carbs: 38,
      fat: 26,
      tags: JSON.stringify(['seafood', 'seattle', 'grilled', 'salmon']),
      keywordsForDeliverySearch: 'grilled salmon rice pilaf'
    },

    // Teriyaki Madness (Seattle teriyaki culture)
    {
      restaurantBrand: 'teriyaki madness',
      title: 'Chicken Teriyaki Bowl',
      description: 'Grilled chicken teriyaki, steamed rice, mixed vegetables',
      calories: 490,
      protein: 38,
      carbs: 62,
      fat: 8,
      tags: JSON.stringify(['asian', 'seattle', 'lean', 'teriyaki']),
      keywordsForDeliverySearch: 'chicken teriyaki bowl'
    },
    {
      restaurantBrand: 'teriyaki madness',
      title: 'Beef Teriyaki Bowl',
      description: 'Grilled beef teriyaki, steamed rice, mixed vegetables',
      calories: 540,
      protein: 36,
      carbs: 58,
      fat: 14,
      tags: JSON.stringify(['asian', 'seattle', 'beef', 'teriyaki']),
      keywordsForDeliverySearch: 'beef teriyaki bowl'
    },

    // MOD Pizza (Seattle-born)
    {
      restaurantBrand: 'mod pizza',
      title: 'Mad Dog Pizza',
      description: 'Red sauce, mozzarella, pepperoni, mild sausage, ground beef',
      calories: 580,
      protein: 28,
      carbs: 52,
      fat: 28,
      tags: JSON.stringify(['pizza', 'seattle', 'meat']),
      keywordsForDeliverySearch: 'mad dog pizza pepperoni sausage'
    },
    {
      restaurantBrand: 'mod pizza',
      title: 'Calexico Pizza',
      description: 'Red sauce, mozzarella, chicken, red onions, corn, cilantro',
      calories: 520,
      protein: 32,
      carbs: 50,
      fat: 22,
      tags: JSON.stringify(['pizza', 'seattle', 'chicken', 'mexican']),
      keywordsForDeliverySearch: 'calexico pizza chicken corn'
    },

    // Ezell\'s Famous Chicken (Seattle fried chicken)
    {
      restaurantBrand: 'ezell\'s famous chicken',
      title: '2-Piece Dark Meal',
      description: 'Two pieces dark meat fried chicken, mashed potatoes, coleslaw',
      calories: 740,
      protein: 42,
      carbs: 48,
      fat: 42,
      tags: JSON.stringify(['fried-chicken', 'seattle', 'comfort']),
      keywordsForDeliverySearch: '2 piece dark chicken meal'
    },
    {
      restaurantBrand: 'ezell\'s famous chicken',
      title: 'Grilled Chicken Breast',
      description: 'Grilled chicken breast, green beans, mashed potatoes',
      calories: 520,
      protein: 48,
      carbs: 32,
      fat: 18,
      tags: JSON.stringify(['grilled', 'seattle', 'lean']),
      keywordsForDeliverySearch: 'grilled chicken breast'
    },

    // Pagliacci Pizza (Seattle favorite)
    {
      restaurantBrand: 'pagliacci pizza',
      title: 'Margherita Pizza',
      description: 'Tomato sauce, fresh mozzarella, basil, extra virgin olive oil',
      calories: 420,
      protein: 18,
      carbs: 48,
      fat: 18,
      tags: JSON.stringify(['pizza', 'seattle', 'margherita', 'classic']),
      keywordsForDeliverySearch: 'margherita pizza fresh mozzarella'
    },
    {
      restaurantBrand: 'pagliacci pizza',
      title: 'Primo Pepperoni',
      description: 'Tomato sauce, mozzarella, premium pepperoni, italian herbs',
      calories: 510,
      protein: 22,
      carbs: 46,
      fat: 26,
      tags: JSON.stringify(['pizza', 'seattle', 'pepperoni']),
      keywordsForDeliverySearch: 'primo pepperoni pizza'
    },

    // Katsu Burger (Seattle Asian-fusion)
    {
      restaurantBrand: 'katsu burger',
      title: 'Original Katsu Burger',
      description: 'Panko-crusted chicken katsu, cabbage, katsu sauce, brioche bun',
      calories: 620,
      protein: 35,
      carbs: 52,
      fat: 28,
      tags: JSON.stringify(['japanese', 'seattle', 'katsu', 'fusion']),
      keywordsForDeliverySearch: 'original katsu burger chicken'
    },
    {
      restaurantBrand: 'katsu burger',
      title: 'Tofu Katsu Burger',
      description: 'Panko-crusted tofu katsu, cabbage, katsu sauce, brioche bun',
      calories: 480,
      protein: 18,
      carbs: 58,
      fat: 20,
      tags: JSON.stringify(['vegetarian', 'seattle', 'katsu', 'tofu']),
      keywordsForDeliverySearch: 'tofu katsu burger vegetarian'
    },

    // Marination (Seattle Korean-Mexican)
    {
      restaurantBrand: 'marination',
      title: 'Kalbi Tacos',
      description: 'Korean BBQ short ribs, kimchi slaw, cilantro, corn tortillas (2 tacos)',
      calories: 540,
      protein: 28,
      carbs: 42,
      fat: 28,
      tags: JSON.stringify(['korean', 'mexican', 'seattle', 'fusion', 'tacos']),
      keywordsForDeliverySearch: 'kalbi tacos korean bbq'
    },
    {
      restaurantBrand: 'marination',
      title: 'Spam Musubi',
      description: 'Grilled spam, rice, nori seaweed wrap, teriyaki glaze (2 pieces)',
      calories: 420,
      protein: 16,
      carbs: 58,
      fat: 14,
      tags: JSON.stringify(['hawaiian', 'seattle', 'spam', 'rice']),
      keywordsForDeliverySearch: 'spam musubi rice'
    },

    // Paseo (Seattle Caribbean sandwiches)
    {
      restaurantBrand: 'paseo',
      title: 'Caribbean Roast Sandwich',
      description: 'Slow-roasted pork shoulder, caramelized onions, cilantro, jalapeños',
      calories: 680,
      protein: 42,
      carbs: 48,
      fat: 32,
      tags: JSON.stringify(['caribbean', 'seattle', 'pork', 'sandwich']),
      keywordsForDeliverySearch: 'caribbean roast sandwich pork'
    },
    {
      restaurantBrand: 'paseo',
      title: 'Tofu Sandwich',
      description: 'Marinated tofu, caramelized onions, cilantro, jalapeños',
      calories: 520,
      protein: 22,
      carbs: 52,
      fat: 24,
      tags: JSON.stringify(['vegetarian', 'seattle', 'tofu', 'sandwich']),
      keywordsForDeliverySearch: 'tofu sandwich vegetarian'
    },

    // Serious Pie (Tom Douglas restaurant)
    {
      restaurantBrand: 'serious pie',
      title: 'Mushroom Pizza',
      description: 'Truffle cheese, roasted mushrooms, caramelized onions, thyme',
      calories: 580,
      protein: 24,
      carbs: 52,
      fat: 30,
      tags: JSON.stringify(['pizza', 'seattle', 'mushroom', 'gourmet']),
      keywordsForDeliverySearch: 'mushroom pizza truffle'
    },
    {
      restaurantBrand: 'serious pie',
      title: 'Salami Pizza',
      description: 'Tomato sauce, mozzarella, salami, red onions, oregano',
      calories: 540,
      protein: 26,
      carbs: 48,
      fat: 28,
      tags: JSON.stringify(['pizza', 'seattle', 'salami']),
      keywordsForDeliverySearch: 'salami pizza red onions'
    }
  ]

  console.log('🍽️ Creating order templates...')
  for (const template of orderTemplates) {
    await prisma.orderTemplate.create({ data: template })
  }

  // Seed Food Catalog Items (Home/Grocery)
  const foodCatalogItems = [
    // Proteins
    {
      name: 'Chicken Breast (4oz grilled)',
      source: 'home',
      tags: JSON.stringify(['protein', 'lean', 'versatile']),
      calories: 185,
      protein: 35,
      carbs: 0,
      fat: 4,
      ingredientsText: 'Boneless, skinless chicken breast'
    },
    {
      name: 'Greek Yogurt (1 cup)',
      source: 'grocery',
      tags: JSON.stringify(['protein', 'dairy', 'breakfast']),
      calories: 150,
      protein: 20,
      carbs: 9,
      fat: 4,
      ingredientsText: 'Plain Greek yogurt'
    },
    {
      name: 'Eggs (2 large)',
      source: 'home',
      tags: JSON.stringify(['protein', 'breakfast', 'versatile']),
      calories: 140,
      protein: 12,
      carbs: 1,
      fat: 10,
      ingredientsText: 'Large eggs'
    },
    {
      name: 'Salmon Fillet (4oz)',
      source: 'home',
      tags: JSON.stringify(['protein', 'omega-3', 'fish']),
      calories: 250,
      protein: 35,
      carbs: 0,
      fat: 12,
      ingredientsText: 'Atlantic salmon fillet'
    },
    {
      name: 'Lean Ground Turkey (4oz)',
      source: 'home',
      tags: JSON.stringify(['protein', 'lean', 'ground']),
      calories: 220,
      protein: 34,
      carbs: 0,
      fat: 8,
      ingredientsText: '93/7 ground turkey'
    },
    {
      name: 'Protein Shake',
      source: 'grocery',
      tags: JSON.stringify(['protein', 'supplement', 'quick']),
      calories: 120,
      protein: 25,
      carbs: 3,
      fat: 1,
      ingredientsText: 'Whey protein powder with water'
    },

    // Carbs
    {
      name: 'Brown Rice (1 cup cooked)',
      source: 'home',
      tags: JSON.stringify(['carbs', 'whole-grain', 'fiber']),
      calories: 220,
      protein: 5,
      carbs: 45,
      fat: 2,
      ingredientsText: 'Long grain brown rice'
    },
    {
      name: 'Sweet Potato (medium baked)',
      source: 'home',
      tags: JSON.stringify(['carbs', 'fiber', 'vitamin-a']),
      calories: 180,
      protein: 4,
      carbs: 41,
      fat: 0,
      ingredientsText: 'Medium sweet potato with skin'
    },
    {
      name: 'Oatmeal (1 cup)',
      source: 'home',
      tags: JSON.stringify(['carbs', 'breakfast', 'fiber']),
      calories: 300,
      protein: 10,
      carbs: 54,
      fat: 6,
      ingredientsText: 'Old-fashioned rolled oats'
    },
    {
      name: 'Quinoa (1 cup cooked)',
      source: 'home',
      tags: JSON.stringify(['carbs', 'complete-protein', 'gluten-free']),
      calories: 220,
      protein: 8,
      carbs: 39,
      fat: 4,
      ingredientsText: 'Cooked quinoa'
    },
    {
      name: 'Whole Wheat Bread (2 slices)',
      source: 'grocery',
      tags: JSON.stringify(['carbs', 'whole-grain', 'sandwich']),
      calories: 160,
      protein: 8,
      carbs: 28,
      fat: 3,
      ingredientsText: '100% whole wheat bread'
    },

    // Vegetables
    {
      name: 'Mixed Vegetables (1 cup)',
      source: 'home',
      tags: JSON.stringify(['vegetables', 'fiber', 'vitamins']),
      calories: 50,
      protein: 2,
      carbs: 10,
      fat: 0,
      ingredientsText: 'Broccoli, carrots, bell peppers'
    },
    {
      name: 'Spinach Salad (2 cups)',
      source: 'home',
      tags: JSON.stringify(['vegetables', 'iron', 'low-calorie']),
      calories: 20,
      protein: 2,
      carbs: 3,
      fat: 0,
      ingredientsText: 'Fresh spinach leaves'
    },
    {
      name: 'Avocado (1 medium)',
      source: 'grocery',
      tags: JSON.stringify(['healthy-fats', 'fiber', 'potassium']),
      calories: 320,
      protein: 4,
      carbs: 17,
      fat: 29,
      ingredientsText: 'Fresh avocado'
    },

    // Fats
    {
      name: 'Olive Oil (1 tbsp)',
      source: 'home',
      tags: JSON.stringify(['healthy-fats', 'cooking', 'mediterranean']),
      calories: 120,
      protein: 0,
      carbs: 0,
      fat: 14,
      ingredientsText: 'Extra virgin olive oil'
    },
    {
      name: 'Almonds (1 oz)',
      source: 'grocery',
      tags: JSON.stringify(['healthy-fats', 'protein', 'snack']),
      calories: 160,
      protein: 6,
      carbs: 6,
      fat: 14,
      ingredientsText: 'Raw almonds'
    },
    {
      name: 'Peanut Butter (2 tbsp)',
      source: 'grocery',
      tags: JSON.stringify(['protein', 'fats', 'snack']),
      calories: 190,
      protein: 8,
      carbs: 8,
      fat: 16,
      ingredientsText: 'Natural peanut butter'
    },

    // Snacks/Misc
    {
      name: 'Cottage Cheese (1 cup)',
      source: 'grocery',
      tags: JSON.stringify(['protein', 'dairy', 'snack']),
      calories: 220,
      protein: 25,
      carbs: 9,
      fat: 10,
      ingredientsText: '2% cottage cheese'
    },
    {
      name: 'Banana (medium)',
      source: 'grocery',
      tags: JSON.stringify(['carbs', 'potassium', 'quick-energy']),
      calories: 105,
      protein: 1,
      carbs: 27,
      fat: 0,
      ingredientsText: 'Fresh banana'
    },
    {
      name: 'Apple with Almond Butter',
      source: 'grocery',
      tags: JSON.stringify(['balanced', 'snack', 'fiber']),
      calories: 280,
      protein: 6,
      carbs: 32,
      fat: 16,
      ingredientsText: 'Medium apple with 2 tbsp almond butter'
    }
  ]

  console.log('🥗 Creating food catalog items...')
  for (const item of foodCatalogItems) {
    await prisma.foodCatalogItem.create({ data: item })
  }

  console.log(`✅ Seed completed for Irvine, San Francisco, NYC, and Seattle:`)
  console.log(`📄 ${orderTemplates.length} order templates created`)
  console.log(`🍎 ${foodCatalogItems.length} food catalog items created`)
  console.log(`🏪 Chains covered: 25+ including regional favorites`)
  console.log(`🌎 Coverage: National + CA-specific + NYC-specific + Seattle-specific restaurants`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })