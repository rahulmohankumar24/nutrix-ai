const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const restaurantIngredients = {
  cava: [
    // BASES
    { name: "Basmati Rice", source: "restaurant", tags: ["base", "grain", "cava"], calories: 280, protein: 6, carbs: 58, fat: 0 },
    { name: "Brown Rice", source: "restaurant", tags: ["base", "grain", "cava"], calories: 220, protein: 5, carbs: 45, fat: 2 },
    { name: "Black Lentils", source: "restaurant", tags: ["base", "protein", "cava"], calories: 250, protein: 18, carbs: 40, fat: 1 },
    { name: "Greens & Grains", source: "restaurant", tags: ["base", "grain", "cava"], calories: 170, protein: 7, carbs: 35, fat: 2 },
    { name: "Romaine Lettuce", source: "restaurant", tags: ["base", "vegetable", "cava"], calories: 15, protein: 1, carbs: 3, fat: 0 },
    { name: "Baby Spinach", source: "restaurant", tags: ["base", "vegetable", "cava"], calories: 20, protein: 2, carbs: 3, fat: 0 },

    // PROTEINS
    { name: "Grilled Chicken", source: "restaurant", tags: ["protein", "meat", "cava"], calories: 180, protein: 35, carbs: 0, fat: 4 },
    { name: "Braised Lamb", source: "restaurant", tags: ["protein", "meat", "cava"], calories: 200, protein: 28, carbs: 2, fat: 9 },
    { name: "Spicy Lamb Meatballs", source: "restaurant", tags: ["protein", "meat", "cava"], calories: 210, protein: 24, carbs: 3, fat: 11 },
    { name: "Roasted White Fish", source: "restaurant", tags: ["protein", "fish", "cava"], calories: 140, protein: 30, carbs: 0, fat: 3 },
    { name: "Harissa Honey Chicken", source: "restaurant", tags: ["protein", "meat", "cava"], calories: 190, protein: 33, carbs: 4, fat: 5 },
    { name: "Falafel", source: "restaurant", tags: ["protein", "vegetarian", "cava"], calories: 180, protein: 8, carbs: 16, fat: 10 },

    // VEGETABLES
    { name: "Cucumber", source: "restaurant", tags: ["vegetable", "cava"], calories: 5, protein: 0, carbs: 1, fat: 0 },
    { name: "Tomatoes", source: "restaurant", tags: ["vegetable", "cava"], calories: 10, protein: 0, carbs: 2, fat: 0 },
    { name: "Red Onion", source: "restaurant", tags: ["vegetable", "cava"], calories: 15, protein: 0, carbs: 4, fat: 0 },
    { name: "Roasted Red Peppers", source: "restaurant", tags: ["vegetable", "cava"], calories: 25, protein: 1, carbs: 6, fat: 0 },
    { name: "Pickled Onions", source: "restaurant", tags: ["vegetable", "cava"], calories: 10, protein: 0, carbs: 2, fat: 0 },
    { name: "Kalamata Olives", source: "restaurant", tags: ["vegetable", "fat", "cava"], calories: 45, protein: 0, carbs: 2, fat: 4 },
    { name: "Cabbage Slaw", source: "restaurant", tags: ["vegetable", "cava"], calories: 15, protein: 1, carbs: 3, fat: 0 },

    // SAUCES
    { name: "Tzatziki", source: "restaurant", tags: ["sauce", "cava"], calories: 50, protein: 2, carbs: 3, fat: 4 },
    { name: "Hummus", source: "restaurant", tags: ["sauce", "cava"], calories: 80, protein: 4, carbs: 6, fat: 6 },
    { name: "Harissa", source: "restaurant", tags: ["sauce", "spicy", "cava"], calories: 15, protein: 1, carbs: 3, fat: 0 },
    { name: "Tahini Caesar", source: "restaurant", tags: ["sauce", "cava"], calories: 90, protein: 2, carbs: 2, fat: 9 },
    { name: "Red Pepper Hummus", source: "restaurant", tags: ["sauce", "cava"], calories: 70, protein: 3, carbs: 5, fat: 5 },
    { name: "Garlic Dressing", source: "restaurant", tags: ["sauce", "cava"], calories: 60, protein: 0, carbs: 2, fat: 6 },

    // TOPPINGS
    { name: "Pita Chips", source: "restaurant", tags: ["topping", "crunch", "cava"], calories: 130, protein: 4, carbs: 18, fat: 5 },
    { name: "Feta Cheese", source: "restaurant", tags: ["topping", "cheese", "cava"], calories: 70, protein: 4, carbs: 1, fat: 6 },
    { name: "Avocado", source: "restaurant", tags: ["topping", "fat", "cava"], calories: 120, protein: 2, carbs: 6, fat: 11 },
    { name: "Seeds & Nuts", source: "restaurant", tags: ["topping", "crunch", "cava"], calories: 140, protein: 5, carbs: 4, fat: 12 }
  ],

  chipotle: [
    // BASES
    { name: "Cilantro Lime Rice", source: "restaurant", tags: ["base", "grain", "chipotle"], calories: 210, protein: 4, carbs: 40, fat: 4 },
    { name: "Brown Rice", source: "restaurant", tags: ["base", "grain", "chipotle"], calories: 210, protein: 4, carbs: 36, fat: 6 },
    { name: "Black Beans", source: "restaurant", tags: ["base", "protein", "chipotle"], calories: 120, protein: 8, carbs: 22, fat: 1 },
    { name: "Pinto Beans", source: "restaurant", tags: ["base", "protein", "chipotle"], calories: 120, protein: 8, carbs: 22, fat: 1 },
    { name: "Romaine Lettuce", source: "restaurant", tags: ["base", "vegetable", "chipotle"], calories: 5, protein: 0, carbs: 1, fat: 0 },

    // PROTEINS
    { name: "Chicken", source: "restaurant", tags: ["protein", "meat", "chipotle"], calories: 180, protein: 32, carbs: 0, fat: 7 },
    { name: "Barbacoa", source: "restaurant", tags: ["protein", "meat", "chipotle"], calories: 165, protein: 24, carbs: 2, fat: 7 },
    { name: "Carnitas", source: "restaurant", tags: ["protein", "meat", "chipotle"], calories: 210, protein: 23, carbs: 0, fat: 12 },
    { name: "Steak", source: "restaurant", tags: ["protein", "meat", "chipotle"], calories: 150, protein: 21, carbs: 2, fat: 6 },
    { name: "Sofritas", source: "restaurant", tags: ["protein", "vegetarian", "chipotle"], calories: 150, protein: 8, carbs: 9, fat: 10 },

    // VEGETABLES
    { name: "Fajita Veggies", source: "restaurant", tags: ["vegetable", "chipotle"], calories: 20, protein: 1, carbs: 4, fat: 0 },
    { name: "Fresh Tomato Salsa", source: "restaurant", tags: ["vegetable", "salsa", "chipotle"], calories: 25, protein: 1, carbs: 4, fat: 0 },
    { name: "Roasted Chili Corn Salsa", source: "restaurant", tags: ["vegetable", "salsa", "chipotle"], calories: 80, protein: 3, carbs: 15, fat: 1 },
    { name: "Tomatillo Green Salsa", source: "restaurant", tags: ["vegetable", "salsa", "chipotle"], calories: 15, protein: 0, carbs: 4, fat: 0 },
    { name: "Hot Red Salsa", source: "restaurant", tags: ["vegetable", "salsa", "spicy", "chipotle"], calories: 15, protein: 1, carbs: 4, fat: 0 },

    // SAUCES
    { name: "Sour Cream", source: "restaurant", tags: ["sauce", "dairy", "chipotle"], calories: 110, protein: 2, carbs: 2, fat: 10 },
    { name: "Cheese", source: "restaurant", tags: ["topping", "cheese", "chipotle"], calories: 100, protein: 6, carbs: 1, fat: 8 },
    { name: "Guacamole", source: "restaurant", tags: ["sauce", "fat", "chipotle"], calories: 230, protein: 3, carbs: 8, fat: 22 },
    { name: "Chipotle Honey Vinaigrette", source: "restaurant", tags: ["sauce", "chipotle"], calories: 220, protein: 0, carbs: 13, fat: 20 }
  ],

  subway: [
    // BASES
    { name: "Italian Herbs & Cheese Bread", source: "restaurant", tags: ["base", "bread", "subway"], calories: 200, protein: 8, carbs: 36, fat: 3 },
    { name: "9-Grain Wheat Bread", source: "restaurant", tags: ["base", "bread", "subway"], calories: 190, protein: 8, carbs: 36, fat: 2 },
    { name: "Honey Oat Bread", source: "restaurant", tags: ["base", "bread", "subway"], calories: 190, protein: 8, carbs: 38, fat: 2 },
    { name: "White Bread", source: "restaurant", tags: ["base", "bread", "subway"], calories: 180, protein: 7, carbs: 35, fat: 2 },

    // PROTEINS
    { name: "Oven Roasted Chicken", source: "restaurant", tags: ["protein", "meat", "subway"], calories: 80, protein: 18, carbs: 1, fat: 1 },
    { name: "Rotisserie Chicken", source: "restaurant", tags: ["protein", "meat", "subway"], calories: 90, protein: 19, carbs: 1, fat: 2 },
    { name: "Turkey Breast", source: "restaurant", tags: ["protein", "meat", "subway"], calories: 60, protein: 12, carbs: 1, fat: 1 },
    { name: "Black Forest Ham", source: "restaurant", tags: ["protein", "meat", "subway"], calories: 60, protein: 10, carbs: 2, fat: 2 },
    { name: "Tuna", source: "restaurant", tags: ["protein", "fish", "subway"], calories: 190, protein: 15, carbs: 1, fat: 14 },
    { name: "Veggie Patty", source: "restaurant", tags: ["protein", "vegetarian", "subway"], calories: 170, protein: 9, carbs: 15, fat: 8 },

    // VEGETABLES
    { name: "Lettuce", source: "restaurant", tags: ["vegetable", "subway"], calories: 2, protein: 0, carbs: 1, fat: 0 },
    { name: "Tomatoes", source: "restaurant", tags: ["vegetable", "subway"], calories: 5, protein: 0, carbs: 1, fat: 0 },
    { name: "Cucumbers", source: "restaurant", tags: ["vegetable", "subway"], calories: 2, protein: 0, carbs: 1, fat: 0 },
    { name: "Green Peppers", source: "restaurant", tags: ["vegetable", "subway"], calories: 2, protein: 0, carbs: 1, fat: 0 },
    { name: "Red Onions", source: "restaurant", tags: ["vegetable", "subway"], calories: 5, protein: 0, carbs: 1, fat: 0 },
    { name: "Pickles", source: "restaurant", tags: ["vegetable", "subway"], calories: 1, protein: 0, carbs: 0, fat: 0 },
    { name: "Spinach", source: "restaurant", tags: ["vegetable", "subway"], calories: 3, protein: 0, carbs: 1, fat: 0 },

    // SAUCES
    { name: "Mayo", source: "restaurant", tags: ["sauce", "subway"], calories: 110, protein: 0, carbs: 1, fat: 12 },
    { name: "Mustard", source: "restaurant", tags: ["sauce", "subway"], calories: 5, protein: 0, carbs: 1, fat: 0 },
    { name: "Southwest Sauce", source: "restaurant", tags: ["sauce", "subway"], calories: 100, protein: 0, carbs: 1, fat: 11 },
    { name: "Ranch", source: "restaurant", tags: ["sauce", "subway"], calories: 110, protein: 0, carbs: 2, fat: 12 },
    { name: "Italian Dressing", source: "restaurant", tags: ["sauce", "subway"], calories: 35, protein: 0, carbs: 1, fat: 4 },

    // TOPPINGS
    { name: "American Cheese", source: "restaurant", tags: ["topping", "cheese", "subway"], calories: 40, protein: 3, carbs: 1, fat: 3 },
    { name: "Provolone Cheese", source: "restaurant", tags: ["topping", "cheese", "subway"], calories: 50, protein: 4, carbs: 1, fat: 4 },
    { name: "Avocado", source: "restaurant", tags: ["topping", "fat", "subway"], calories: 80, protein: 1, carbs: 4, fat: 7 }
  ],

  sweetgreen: [
    // BASES
    { name: "Wild Rice", source: "restaurant", tags: ["base", "grain", "sweetgreen"], calories: 180, protein: 4, carbs: 35, fat: 2 },
    { name: "Quinoa", source: "restaurant", tags: ["base", "grain", "sweetgreen"], calories: 160, protein: 6, carbs: 29, fat: 3 },
    { name: "Spring Mix", source: "restaurant", tags: ["base", "vegetable", "sweetgreen"], calories: 15, protein: 1, carbs: 3, fat: 0 },
    { name: "Kale", source: "restaurant", tags: ["base", "vegetable", "sweetgreen"], calories: 20, protein: 2, carbs: 4, fat: 0 },
    { name: "Arugula", source: "restaurant", tags: ["base", "vegetable", "sweetgreen"], calories: 10, protein: 1, carbs: 2, fat: 0 },

    // PROTEINS
    { name: "Grilled Chicken", source: "restaurant", tags: ["protein", "meat", "sweetgreen"], calories: 140, protein: 26, carbs: 0, fat: 4 },
    { name: "Salmon", source: "restaurant", tags: ["protein", "fish", "sweetgreen"], calories: 170, protein: 25, carbs: 0, fat: 8 },
    { name: "Tofu", source: "restaurant", tags: ["protein", "vegetarian", "sweetgreen"], calories: 120, protein: 12, carbs: 5, fat: 7 },
    { name: "Turkey", source: "restaurant", tags: ["protein", "meat", "sweetgreen"], calories: 110, protein: 20, carbs: 1, fat: 3 },

    // VEGETABLES
    { name: "Roasted Sweet Potato", source: "restaurant", tags: ["vegetable", "sweetgreen"], calories: 80, protein: 2, carbs: 18, fat: 0 },
    { name: "Broccoli", source: "restaurant", tags: ["vegetable", "sweetgreen"], calories: 25, protein: 3, carbs: 5, fat: 0 },
    { name: "Carrots", source: "restaurant", tags: ["vegetable", "sweetgreen"], calories: 25, protein: 1, carbs: 6, fat: 0 },
    { name: "Cherry Tomatoes", source: "restaurant", tags: ["vegetable", "sweetgreen"], calories: 15, protein: 1, carbs: 3, fat: 0 },
    { name: "Cucumber", source: "restaurant", tags: ["vegetable", "sweetgreen"], calories: 10, protein: 0, carbs: 2, fat: 0 },
    { name: "Red Cabbage", source: "restaurant", tags: ["vegetable", "sweetgreen"], calories: 15, protein: 1, carbs: 3, fat: 0 },

    // SAUCES
    { name: "Lemon Squeeze", source: "restaurant", tags: ["sauce", "sweetgreen"], calories: 5, protein: 0, carbs: 1, fat: 0 },
    { name: "Balsamic Vinaigrette", source: "restaurant", tags: ["sauce", "sweetgreen"], calories: 90, protein: 0, carbs: 3, fat: 9 },
    { name: "Caesar Dressing", source: "restaurant", tags: ["sauce", "sweetgreen"], calories: 140, protein: 1, carbs: 2, fat: 15 },
    { name: "Goddess Dressing", source: "restaurant", tags: ["sauce", "sweetgreen"], calories: 120, protein: 1, carbs: 3, fat: 12 },
    { name: "Lime Squeeze", source: "restaurant", tags: ["sauce", "sweetgreen"], calories: 5, protein: 0, carbs: 1, fat: 0 },

    // TOPPINGS
    { name: "Almonds", source: "restaurant", tags: ["topping", "nuts", "sweetgreen"], calories: 80, protein: 3, carbs: 3, fat: 7 },
    { name: "Parmesan", source: "restaurant", tags: ["topping", "cheese", "sweetgreen"], calories: 110, protein: 10, carbs: 1, fat: 8 },
    { name: "Avocado", source: "restaurant", tags: ["topping", "fat", "sweetgreen"], calories: 120, protein: 2, carbs: 6, fat: 11 },
    { name: "Seeds", source: "restaurant", tags: ["topping", "nuts", "sweetgreen"], calories: 60, protein: 2, carbs: 2, fat: 5 }
  ]
};

async function main() {
  console.log('Start seeding restaurant ingredients...');

  // Clear existing restaurant ingredients to avoid duplicates
  await prisma.foodCatalogItem.deleteMany({
    where: {
      source: 'restaurant'
    }
  });

  console.log('Cleared existing restaurant ingredients');

  let totalInserted = 0;

  // Insert ingredients for each restaurant
  for (const [restaurant, ingredients] of Object.entries(restaurantIngredients)) {
    console.log(`Adding ${ingredients.length} ingredients for ${restaurant.toUpperCase()}...`);

    for (const ingredient of ingredients) {
      await prisma.foodCatalogItem.create({
        data: {
          name: ingredient.name,
          source: ingredient.source,
          tags: JSON.stringify(ingredient.tags),
          calories: ingredient.calories,
          protein: ingredient.protein,
          carbs: ingredient.carbs,
          fat: ingredient.fat,
          ingredientsText: `${restaurant.charAt(0).toUpperCase() + restaurant.slice(1)} ingredient`
        }
      });
    }

    totalInserted += ingredients.length;
    console.log(`✅ Added ${ingredients.length} ingredients for ${restaurant}`);
  }

  console.log(`🎉 Successfully seeded ${totalInserted} restaurant ingredients!`);
  console.log('Breakdown:');
  Object.entries(restaurantIngredients).forEach(([restaurant, ingredients]) => {
    console.log(`- ${restaurant}: ${ingredients.length} ingredients`);
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });