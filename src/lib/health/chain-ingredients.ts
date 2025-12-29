// Curated ingredient data for known restaurant chains
// Sources: Official restaurant allergen/ingredient disclosures

export interface ChainMenuItem {
  ingredients: string[]
  knownFlags: string[] // Pre-identified concerning ingredients
}

export interface ChainData {
  [menuItem: string]: ChainMenuItem
}

// Chain ingredient database - keyed by normalized restaurant brand
export const CHAIN_INGREDIENT_DATA: Record<string, ChainData> = {
  chipotle: {
    'chicken': {
      ingredients: ['chicken', 'water', 'salt', 'oregano', 'cumin', 'black pepper', 'chipotle pepper', 'garlic', 'sunflower oil'],
      knownFlags: ['sunflower oil']
    },
    'steak': {
      ingredients: ['beef', 'water', 'salt', 'cumin', 'garlic', 'oregano', 'black pepper', 'chipotle pepper', 'sunflower oil', 'rice bran oil'],
      knownFlags: ['sunflower oil', 'rice bran oil']
    },
    'carnitas': {
      ingredients: ['pork', 'water', 'salt', 'juniper berries', 'thyme', 'bay leaves', 'soybean oil'],
      knownFlags: ['soybean oil']
    },
    'barbacoa': {
      ingredients: ['beef', 'water', 'chipotle chiles', 'salt', 'cumin', 'cloves', 'garlic', 'oregano', 'black pepper', 'soybean oil'],
      knownFlags: ['soybean oil']
    },
    'sofritas': {
      ingredients: ['tofu', 'water', 'chipotle chiles', 'tomatoes', 'roasted poblano peppers', 'cumin', 'salt', 'sunflower oil'],
      knownFlags: ['sunflower oil']
    },
    'white rice': {
      ingredients: ['rice', 'water', 'rice bran oil', 'salt', 'lime juice', 'cilantro'],
      knownFlags: ['rice bran oil']
    },
    'brown rice': {
      ingredients: ['rice', 'water', 'rice bran oil', 'salt', 'lime juice', 'cilantro'],
      knownFlags: ['rice bran oil']
    },
    'black beans': {
      ingredients: ['black beans', 'water', 'salt', 'soybean oil', 'garlic', 'cumin', 'oregano'],
      knownFlags: ['soybean oil']
    },
    'pinto beans': {
      ingredients: ['pinto beans', 'water', 'salt', 'soybean oil', 'garlic', 'cumin', 'oregano'],
      knownFlags: ['soybean oil']
    },
    'flour tortilla': {
      ingredients: ['flour', 'water', 'vegetable shortening', 'salt', 'baking powder'],
      knownFlags: ['vegetable shortening']
    },
    'corn tortilla': {
      ingredients: ['corn', 'water', 'lime'],
      knownFlags: []
    },
    'chips': {
      ingredients: ['corn', 'sunflower oil', 'salt'],
      knownFlags: ['sunflower oil']
    },
    'guacamole': {
      ingredients: ['avocado', 'lime juice', 'cilantro', 'jalapeno', 'red onion', 'salt'],
      knownFlags: []
    },
    'sour cream': {
      ingredients: ['cream', 'milk', 'nonfat milk', 'cultures'],
      knownFlags: []
    },
    'cheese': {
      ingredients: ['cheddar cheese', 'monterey jack cheese', 'potato starch', 'natamycin'],
      knownFlags: []
    }
  },

  cava: {
    'grilled chicken': {
      ingredients: ['chicken breast', 'olive oil', 'salt', 'oregano', 'garlic', 'lemon juice'],
      knownFlags: []
    },
    'braised lamb': {
      ingredients: ['lamb', 'olive oil', 'harissa', 'tomato', 'onion', 'garlic', 'cumin'],
      knownFlags: []
    },
    'falafel': {
      ingredients: ['chickpeas', 'onion', 'parsley', 'garlic', 'cumin', 'coriander', 'canola oil'],
      knownFlags: ['canola oil']
    },
    'supergreens': {
      ingredients: ['arugula', 'spinach', 'kale', 'olive oil', 'lemon juice'],
      knownFlags: []
    },
    'splendid greens': {
      ingredients: ['romaine', 'arugula', 'olive oil', 'salt'],
      knownFlags: []
    },
    'basmati rice': {
      ingredients: ['basmati rice', 'water', 'olive oil', 'salt', 'lemon juice'],
      knownFlags: []
    },
    'superrice': {
      ingredients: ['rice', 'spinach', 'olive oil', 'salt', 'lemon juice'],
      knownFlags: []
    },
    'hummus': {
      ingredients: ['chickpeas', 'tahini', 'lemon juice', 'garlic', 'olive oil', 'salt', 'cumin'],
      knownFlags: []
    },
    'tzatziki': {
      ingredients: ['greek yogurt', 'cucumber', 'garlic', 'olive oil', 'dill', 'salt'],
      knownFlags: []
    },
    'harissa': {
      ingredients: ['roasted red peppers', 'olive oil', 'garlic', 'caraway', 'coriander', 'cumin'],
      knownFlags: []
    },
    'pita chips': {
      ingredients: ['pita bread', 'sunflower oil', 'salt'],
      knownFlags: ['sunflower oil']
    }
  },

  sweetgreen: {
    'warm wild rice': {
      ingredients: ['wild rice', 'olive oil', 'salt'],
      knownFlags: []
    },
    'shredded kale': {
      ingredients: ['kale', 'olive oil', 'lemon juice', 'salt'],
      knownFlags: []
    },
    'chopped romaine': {
      ingredients: ['romaine lettuce'],
      knownFlags: []
    },
    'blackened chicken': {
      ingredients: ['chicken breast', 'olive oil', 'paprika', 'garlic powder', 'oregano', 'thyme', 'cayenne', 'salt', 'black pepper'],
      knownFlags: []
    },
    'hot honey chicken': {
      ingredients: ['chicken breast', 'honey', 'hot sauce', 'olive oil', 'salt', 'garlic'],
      knownFlags: []
    },
    'roasted salmon': {
      ingredients: ['salmon', 'olive oil', 'salt', 'black pepper'],
      knownFlags: []
    },
    'crispy rice': {
      ingredients: ['rice', 'rice flour', 'canola oil', 'salt'],
      knownFlags: ['canola oil']
    },
    'green goddess dressing': {
      ingredients: ['avocado', 'greek yogurt', 'basil', 'tarragon', 'chives', 'lemon juice', 'olive oil', 'salt'],
      knownFlags: []
    },
    'caesar dressing': {
      ingredients: ['olive oil', 'lemon juice', 'parmesan', 'anchovy', 'garlic', 'dijon mustard', 'egg yolk'],
      knownFlags: []
    }
  },

  'chick-fil-a': {
    'chicken sandwich': {
      ingredients: ['chicken breast', 'coating flour', 'milk', 'egg', 'peanut oil', 'monosodium glutamate', 'sugar', 'salt', 'spices'],
      knownFlags: ['monosodium glutamate']
    },
    'grilled chicken': {
      ingredients: ['chicken breast', 'water', 'salt', 'sugar', 'yeast extract', 'garlic', 'onion', 'spices', 'soybean oil'],
      knownFlags: ['soybean oil']
    },
    'chicken nuggets': {
      ingredients: ['chicken', 'water', 'flour', 'salt', 'monosodium glutamate', 'sugar', 'peanut oil'],
      knownFlags: ['monosodium glutamate']
    },
    'waffle fries': {
      ingredients: ['potatoes', 'canola oil', 'dextrose', 'sodium acid pyrophosphate'],
      knownFlags: ['canola oil']
    },
    'mac and cheese': {
      ingredients: ['pasta', 'cheddar cheese', 'butter', 'milk', 'sodium phosphate', 'salt', 'annatto color'],
      knownFlags: []
    },
    'chick-fil-a sauce': {
      ingredients: ['soybean oil', 'sugar', 'mustard', 'egg yolk', 'distilled vinegar', 'salt', 'natural smoke flavor'],
      knownFlags: ['soybean oil']
    },
    'polynesian sauce': {
      ingredients: ['sugar', 'corn syrup', 'soybean oil', 'tomato paste', 'vinegar', 'natural flavors'],
      knownFlags: ['corn syrup', 'soybean oil']
    }
  },

  panera: {
    'chicken breast': {
      ingredients: ['chicken breast', 'water', 'salt', 'rosemary extract', 'garlic'],
      knownFlags: []
    },
    'steak': {
      ingredients: ['beef', 'salt', 'black pepper', 'garlic', 'soybean oil'],
      knownFlags: ['soybean oil']
    },
    'sourdough bread': {
      ingredients: ['flour', 'water', 'salt', 'yeast', 'malt'],
      knownFlags: []
    },
    'baguette': {
      ingredients: ['flour', 'water', 'salt', 'yeast', 'malt', 'soybean oil'],
      knownFlags: ['soybean oil']
    },
    'caesar dressing': {
      ingredients: ['soybean oil', 'parmesan', 'egg yolk', 'garlic', 'anchovy paste', 'lemon juice', 'dijon mustard'],
      knownFlags: ['soybean oil']
    },
    'green goddess dressing': {
      ingredients: ['soybean oil', 'avocado', 'buttermilk', 'basil', 'parsley', 'chives', 'garlic'],
      knownFlags: ['soybean oil']
    },
    'mac and cheese': {
      ingredients: ['pasta', 'cheddar cheese', 'cream', 'butter', 'sodium phosphate', 'salt'],
      knownFlags: []
    },
    'broccoli cheddar soup': {
      ingredients: ['broccoli', 'cream', 'cheddar cheese', 'carrots', 'onion', 'butter', 'flour', 'salt'],
      knownFlags: []
    }
  },

  'in-n-out': {
    'hamburger patty': {
      ingredients: ['beef', 'salt'],
      knownFlags: []
    },
    'bun': {
      ingredients: ['flour', 'water', 'sugar', 'yeast', 'soybean oil', 'salt', 'calcium propionate'],
      knownFlags: ['soybean oil', 'calcium propionate']
    },
    'spread': {
      ingredients: ['soybean oil', 'eggs', 'pickle relish', 'vinegar', 'sugar', 'mustard', 'natural flavors'],
      knownFlags: ['soybean oil']
    },
    'fries': {
      ingredients: ['potatoes', 'sunflower oil', 'salt'],
      knownFlags: ['sunflower oil']
    },
    'cheese': {
      ingredients: ['american cheese', 'milk', 'cream', 'sodium phosphate', 'salt', 'annatto color'],
      knownFlags: []
    }
  },

  'shake shack': {
    'shackburger patty': {
      ingredients: ['beef', 'salt', 'pepper'],
      knownFlags: []
    },
    'potato bun': {
      ingredients: ['flour', 'potato flakes', 'sugar', 'yeast', 'butter', 'canola oil', 'salt', 'calcium propionate'],
      knownFlags: ['canola oil', 'calcium propionate']
    },
    'shack sauce': {
      ingredients: ['mayonnaise', 'soybean oil', 'ketchup', 'mustard', 'cayenne', 'pickle brine', 'sugar'],
      knownFlags: ['soybean oil']
    },
    'crinkle cut fries': {
      ingredients: ['potatoes', 'vegetable oil', 'salt', 'dextrose'],
      knownFlags: ['vegetable oil']
    },
    'cheese sauce': {
      ingredients: ['cheddar cheese', 'cream', 'butter', 'sodium phosphate', 'salt'],
      knownFlags: []
    }
  },

  starbucks: {
    'cold brew': {
      ingredients: ['coffee', 'water'],
      knownFlags: []
    },
    'oat milk': {
      ingredients: ['water', 'oats', 'rapeseed oil', 'salt', 'calcium', 'vitamin d'],
      knownFlags: ['rapeseed oil']
    },
    'vanilla syrup': {
      ingredients: ['sugar', 'water', 'natural flavors', 'potassium sorbate', 'citric acid'],
      knownFlags: ['potassium sorbate']
    },
    'caramel syrup': {
      ingredients: ['sugar', 'water', 'natural flavors', 'caramel color', 'potassium sorbate'],
      knownFlags: ['caramel color', 'potassium sorbate']
    },
    'whipped cream': {
      ingredients: ['cream', 'milk', 'mono and diglycerides', 'carrageenan'],
      knownFlags: ['carrageenan']
    },
    'bacon gouda sandwich': {
      ingredients: ['egg', 'bacon', 'gouda cheese', 'english muffin', 'butter', 'soybean oil', 'sodium nitrite'],
      knownFlags: ['soybean oil', 'sodium nitrite']
    },
    'egg bites': {
      ingredients: ['eggs', 'cheese', 'cream', 'bacon', 'potato starch', 'salt'],
      knownFlags: []
    },
    'croissant': {
      ingredients: ['flour', 'butter', 'milk', 'yeast', 'sugar', 'salt', 'egg'],
      knownFlags: []
    }
  },

  subway: {
    'italian bread': {
      ingredients: ['flour', 'water', 'yeast', 'sugar', 'soybean oil', 'salt', 'calcium propionate'],
      knownFlags: ['soybean oil', 'calcium propionate']
    },
    'wheat bread': {
      ingredients: ['flour', 'whole wheat flour', 'water', 'yeast', 'sugar', 'soybean oil', 'salt', 'caramel color'],
      knownFlags: ['soybean oil', 'caramel color']
    },
    'rotisserie chicken': {
      ingredients: ['chicken', 'water', 'salt', 'sugar', 'sodium phosphate', 'natural flavors'],
      knownFlags: []
    },
    'turkey breast': {
      ingredients: ['turkey', 'water', 'salt', 'sugar', 'sodium phosphate', 'natural flavors'],
      knownFlags: []
    },
    'ham': {
      ingredients: ['pork', 'water', 'salt', 'sugar', 'sodium nitrite', 'sodium phosphate'],
      knownFlags: ['sodium nitrite']
    },
    'mayonnaise': {
      ingredients: ['soybean oil', 'eggs', 'vinegar', 'salt', 'sugar', 'lemon juice'],
      knownFlags: ['soybean oil']
    },
    'ranch dressing': {
      ingredients: ['soybean oil', 'buttermilk', 'egg yolk', 'garlic', 'onion', 'msg'],
      knownFlags: ['soybean oil', 'msg']
    },
    'sweet onion sauce': {
      ingredients: ['high fructose corn syrup', 'water', 'vinegar', 'soybean oil', 'onion', 'salt'],
      knownFlags: ['high fructose corn syrup', 'soybean oil']
    }
  },

  'panda express': {
    'orange chicken': {
      ingredients: ['chicken', 'flour', 'cornstarch', 'soybean oil', 'sugar', 'vinegar', 'soy sauce', 'orange peel', 'garlic', 'ginger', 'msg'],
      knownFlags: ['soybean oil', 'msg']
    },
    'beijing beef': {
      ingredients: ['beef', 'flour', 'soybean oil', 'bell peppers', 'onion', 'sugar', 'soy sauce', 'chili flakes'],
      knownFlags: ['soybean oil']
    },
    'kung pao chicken': {
      ingredients: ['chicken', 'peanuts', 'soybean oil', 'bell peppers', 'zucchini', 'soy sauce', 'vinegar', 'sugar', 'chili paste', 'msg'],
      knownFlags: ['soybean oil', 'msg']
    },
    'broccoli beef': {
      ingredients: ['beef', 'broccoli', 'soybean oil', 'soy sauce', 'oyster sauce', 'garlic', 'ginger'],
      knownFlags: ['soybean oil']
    },
    'fried rice': {
      ingredients: ['rice', 'eggs', 'peas', 'carrots', 'green onion', 'soybean oil', 'soy sauce', 'salt'],
      knownFlags: ['soybean oil']
    },
    'chow mein': {
      ingredients: ['noodles', 'cabbage', 'celery', 'onion', 'soybean oil', 'soy sauce', 'sesame oil'],
      knownFlags: ['soybean oil']
    },
    'steamed rice': {
      ingredients: ['rice', 'water'],
      knownFlags: []
    },
    'super greens': {
      ingredients: ['broccoli', 'cabbage', 'kale', 'garlic', 'soybean oil'],
      knownFlags: ['soybean oil']
    }
  },

  'jersey mike\'s': {
    'white sub roll': {
      ingredients: ['flour', 'water', 'yeast', 'sugar', 'soybean oil', 'salt', 'calcium propionate'],
      knownFlags: ['soybean oil', 'calcium propionate']
    },
    'wheat sub roll': {
      ingredients: ['flour', 'whole wheat flour', 'water', 'yeast', 'sugar', 'soybean oil', 'salt'],
      knownFlags: ['soybean oil']
    },
    'roast beef': {
      ingredients: ['beef', 'water', 'salt', 'sugar', 'sodium phosphate'],
      knownFlags: []
    },
    'turkey': {
      ingredients: ['turkey', 'water', 'salt', 'sugar', 'sodium phosphate'],
      knownFlags: []
    },
    'provolone cheese': {
      ingredients: ['milk', 'cheese cultures', 'salt', 'enzymes'],
      knownFlags: []
    },
    'oil blend': {
      ingredients: ['olive oil', 'canola oil'],
      knownFlags: ['canola oil']
    },
    'chipotle mayo': {
      ingredients: ['soybean oil', 'eggs', 'vinegar', 'chipotle peppers', 'sugar', 'salt'],
      knownFlags: ['soybean oil']
    }
  },

  'the habit burger': {
    'charburger patty': {
      ingredients: ['beef', 'salt', 'pepper'],
      knownFlags: []
    },
    'bun': {
      ingredients: ['flour', 'water', 'sugar', 'yeast', 'soybean oil', 'salt'],
      knownFlags: ['soybean oil']
    },
    'grilled chicken': {
      ingredients: ['chicken', 'olive oil', 'salt', 'garlic', 'herbs'],
      knownFlags: []
    },
    'tempura green beans': {
      ingredients: ['green beans', 'tempura batter', 'soybean oil', 'salt'],
      knownFlags: ['soybean oil']
    },
    'sweet potato fries': {
      ingredients: ['sweet potatoes', 'soybean oil', 'salt', 'dextrose'],
      knownFlags: ['soybean oil']
    }
  },

  'el pollo loco': {
    'fire-grilled chicken': {
      ingredients: ['chicken', 'water', 'salt', 'citrus juice', 'garlic', 'spices', 'soybean oil'],
      knownFlags: ['soybean oil']
    },
    'cilantro rice': {
      ingredients: ['rice', 'water', 'cilantro', 'lime juice', 'soybean oil', 'salt'],
      knownFlags: ['soybean oil']
    },
    'pinto beans': {
      ingredients: ['pinto beans', 'water', 'lard', 'salt', 'spices'],
      knownFlags: []
    },
    'flour tortilla': {
      ingredients: ['flour', 'water', 'vegetable shortening', 'salt', 'baking powder'],
      knownFlags: ['vegetable shortening']
    },
    'avocado salsa': {
      ingredients: ['avocado', 'tomatillo', 'jalapeno', 'cilantro', 'onion', 'salt'],
      knownFlags: []
    }
  },

  'flame broiler': {
    'chicken': {
      ingredients: ['chicken', 'soybean oil', 'garlic', 'salt', 'sesame seeds'],
      knownFlags: ['soybean oil']
    },
    'beef': {
      ingredients: ['beef', 'soybean oil', 'garlic', 'salt', 'sesame seeds'],
      knownFlags: ['soybean oil']
    },
    'brown rice': {
      ingredients: ['brown rice', 'water'],
      knownFlags: []
    },
    'white rice': {
      ingredients: ['white rice', 'water'],
      knownFlags: []
    },
    'magic sauce': {
      ingredients: ['soy sauce', 'sugar', 'sesame oil', 'ginger', 'garlic'],
      knownFlags: []
    },
    'hot sauce': {
      ingredients: ['red pepper', 'vinegar', 'salt', 'garlic'],
      knownFlags: []
    }
  },

  'tender greens': {
    'grilled chicken': {
      ingredients: ['chicken breast', 'olive oil', 'salt', 'herbs'],
      knownFlags: []
    },
    'grilled salmon': {
      ingredients: ['salmon', 'olive oil', 'salt', 'black pepper'],
      knownFlags: []
    },
    'steak': {
      ingredients: ['beef', 'olive oil', 'salt', 'black pepper', 'garlic'],
      knownFlags: []
    },
    'happy vegan salad': {
      ingredients: ['kale', 'quinoa', 'avocado', 'corn', 'tomato', 'olive oil', 'lemon juice'],
      knownFlags: []
    },
    'miso sesame dressing': {
      ingredients: ['miso', 'sesame oil', 'rice vinegar', 'ginger', 'garlic', 'honey'],
      knownFlags: []
    }
  },

  'dig': {
    'grilled chicken': {
      ingredients: ['chicken', 'olive oil', 'salt', 'herbs'],
      knownFlags: []
    },
    'roasted salmon': {
      ingredients: ['salmon', 'olive oil', 'salt', 'black pepper'],
      knownFlags: []
    },
    'charred broccoli': {
      ingredients: ['broccoli', 'olive oil', 'garlic', 'salt', 'lemon'],
      knownFlags: []
    },
    'brown rice': {
      ingredients: ['brown rice', 'water', 'olive oil', 'salt'],
      knownFlags: []
    },
    'farro': {
      ingredients: ['farro', 'water', 'olive oil', 'salt'],
      knownFlags: []
    }
  },

  'chop\'t': {
    'grilled chicken': {
      ingredients: ['chicken breast', 'olive oil', 'salt', 'garlic', 'herbs'],
      knownFlags: []
    },
    'mexican caesar dressing': {
      ingredients: ['soybean oil', 'lime juice', 'parmesan', 'chipotle', 'garlic', 'anchovies'],
      knownFlags: ['soybean oil']
    },
    'buttermilk ranch': {
      ingredients: ['buttermilk', 'soybean oil', 'mayonnaise', 'garlic', 'herbs', 'salt'],
      knownFlags: ['soybean oil']
    },
    'warm ancient grains': {
      ingredients: ['quinoa', 'farro', 'bulgur', 'olive oil', 'salt'],
      knownFlags: []
    }
  },

  'just salad': {
    'grilled chicken': {
      ingredients: ['chicken', 'olive oil', 'salt', 'black pepper'],
      knownFlags: []
    },
    'wild salmon': {
      ingredients: ['salmon', 'olive oil', 'salt', 'herbs'],
      knownFlags: []
    },
    'quinoa': {
      ingredients: ['quinoa', 'water', 'olive oil', 'salt'],
      knownFlags: []
    },
    'caesar dressing': {
      ingredients: ['olive oil', 'parmesan', 'lemon juice', 'garlic', 'anchovy paste', 'egg yolk'],
      knownFlags: []
    },
    'balsamic vinaigrette': {
      ingredients: ['olive oil', 'balsamic vinegar', 'dijon mustard', 'garlic', 'salt'],
      knownFlags: []
    }
  },

  'pret a manger': {
    'chicken avocado sandwich': {
      ingredients: ['chicken', 'avocado', 'bread', 'mayonnaise', 'lettuce', 'sunflower oil'],
      knownFlags: ['sunflower oil']
    },
    'tuna baguette': {
      ingredients: ['tuna', 'mayonnaise', 'cucumber', 'baguette', 'sunflower oil', 'salt'],
      knownFlags: ['sunflower oil']
    },
    'croissant': {
      ingredients: ['flour', 'butter', 'milk', 'yeast', 'sugar', 'salt', 'egg'],
      knownFlags: []
    },
    'protein box': {
      ingredients: ['hard boiled eggs', 'cheese', 'grapes', 'peanut butter', 'bread'],
      knownFlags: []
    }
  },

  'mod pizza': {
    'pizza dough': {
      ingredients: ['flour', 'water', 'yeast', 'salt', 'olive oil', 'sugar'],
      knownFlags: []
    },
    'gluten free crust': {
      ingredients: ['rice flour', 'tapioca flour', 'water', 'olive oil', 'yeast', 'salt'],
      knownFlags: []
    },
    'marinara sauce': {
      ingredients: ['tomatoes', 'olive oil', 'garlic', 'basil', 'oregano', 'salt'],
      knownFlags: []
    },
    'mozzarella': {
      ingredients: ['milk', 'cheese cultures', 'salt', 'enzymes'],
      knownFlags: []
    },
    'pepperoni': {
      ingredients: ['pork', 'beef', 'salt', 'spices', 'sodium nitrite', 'lactic acid'],
      knownFlags: ['sodium nitrite']
    }
  },

  'teriyaki madness': {
    'chicken teriyaki': {
      ingredients: ['chicken', 'teriyaki sauce', 'soybean oil', 'soy sauce', 'sugar', 'ginger', 'garlic'],
      knownFlags: ['soybean oil']
    },
    'beef teriyaki': {
      ingredients: ['beef', 'teriyaki sauce', 'soybean oil', 'soy sauce', 'sugar', 'ginger', 'garlic'],
      knownFlags: ['soybean oil']
    },
    'tofu teriyaki': {
      ingredients: ['tofu', 'teriyaki sauce', 'soybean oil', 'soy sauce', 'sugar', 'ginger'],
      knownFlags: ['soybean oil']
    },
    'white rice': {
      ingredients: ['rice', 'water'],
      knownFlags: []
    },
    'yakisoba noodles': {
      ingredients: ['noodles', 'cabbage', 'carrots', 'soybean oil', 'teriyaki sauce'],
      knownFlags: ['soybean oil']
    },
    'spicy mayo': {
      ingredients: ['mayonnaise', 'soybean oil', 'sriracha', 'lime juice'],
      knownFlags: ['soybean oil']
    }
  }
}

// Helper function to find ingredients for a menu item
export function findChainIngredients(restaurantBrand: string, menuItemName: string): ChainMenuItem | null {
  const brand = restaurantBrand.toLowerCase().trim()
  const chainData = CHAIN_INGREDIENT_DATA[brand]

  if (!chainData) return null

  // Try exact match first
  const normalizedItem = menuItemName.toLowerCase().trim()
  if (chainData[normalizedItem]) {
    return chainData[normalizedItem]
  }

  // Try partial match
  for (const [key, value] of Object.entries(chainData)) {
    if (normalizedItem.includes(key) || key.includes(normalizedItem)) {
      return value
    }
  }

  return null
}

// Get all known flags for a restaurant
export function getRestaurantKnownFlags(restaurantBrand: string): string[] {
  const brand = restaurantBrand.toLowerCase().trim()
  const chainData = CHAIN_INGREDIENT_DATA[brand]

  if (!chainData) return []

  const allFlags = new Set<string>()
  for (const item of Object.values(chainData)) {
    item.knownFlags.forEach(flag => allFlags.add(flag))
  }

  return Array.from(allFlags)
}

// Check if a restaurant tends to use cleaner ingredients
export function isCleanerRestaurant(restaurantBrand: string): boolean {
  const cleanerBrands = ['sweetgreen', 'tender greens', 'dig', 'just salad', 'cava']
  return cleanerBrands.includes(restaurantBrand.toLowerCase().trim())
}
