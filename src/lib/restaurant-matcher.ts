// Restaurant name normalization and matching utilities

interface BrandMatch {
  canonical: string
  patterns: string[]
}

// Map various restaurant name formats to canonical database names
const BRAND_MAPPINGS: BrandMatch[] = [
  {
    canonical: 'chipotle',
    patterns: ['chipotle', 'chipotle mexican grill']
  },
  {
    canonical: 'cava',
    patterns: ['cava', 'cava grill']
  },
  {
    canonical: 'sweetgreen',
    patterns: ['sweetgreen', 'sweet green']
  },
  {
    canonical: 'in-n-out',
    patterns: ['in-n-out', 'in n out', 'in-n-out burger']
  },
  {
    canonical: 'shake shack',
    patterns: ['shake shack']
  },
  {
    canonical: 'the habit burger',
    patterns: ['the habit', 'habit burger', 'the habit burger grill']
  },
  {
    canonical: 'tender greens',
    patterns: ['tender greens', 'tendergreens']
  },
  {
    canonical: 'flame broiler',
    patterns: ['flame broiler', 'the flame broiler']
  },
  {
    canonical: 'just salad',
    patterns: ['just salad', 'justsalad']
  },
  {
    canonical: 'chopt',
    patterns: ['chopt', 'chop\'t', 'chop t']
  },
  {
    canonical: 'dig',
    patterns: ['dig', 'dig inn']
  },
  {
    canonical: 'pret a manger',
    patterns: ['pret a manger', 'pret', 'pret à manger']
  },
  {
    canonical: 'joe\'s pizza',
    patterns: ['joe\'s pizza', 'joes pizza', 'joe pizza']
  },
  {
    canonical: 'el pollo loco',
    patterns: ['el pollo loco']
  },
  {
    canonical: 'panda express',
    patterns: ['panda express', 'panda']
  },
  {
    canonical: 'jersey mike\'s',
    patterns: ['jersey mike\'s', 'jersey mikes', 'jersey mike']
  },
  {
    canonical: 'subway',
    patterns: ['subway', 'subway sandwiches']
  },
  {
    canonical: 'panera',
    patterns: ['panera', 'panera bread']
  },
  {
    canonical: 'starbucks',
    patterns: ['starbucks', 'starbucks coffee']
  },
  {
    canonical: 'chick-fil-a',
    patterns: ['chick-fil-a', 'chick fil a', 'chickfila']
  },
  {
    canonical: 'dick\'s drive-in',
    patterns: ['dick\'s drive-in', 'dicks drive-in', 'dick\'s', 'dicks']
  },
  {
    canonical: 'ivar\'s',
    patterns: ['ivar\'s', 'ivars', 'ivar\'s seafood']
  },
  {
    canonical: 'teriyaki madness',
    patterns: ['teriyaki madness']
  },
  {
    canonical: 'mod pizza',
    patterns: ['mod pizza', 'mod']
  },
  {
    canonical: 'ezell\'s famous chicken',
    patterns: ['ezell\'s', 'ezells', 'ezell\'s famous chicken', 'ezells famous chicken']
  },
  {
    canonical: 'pagliacci pizza',
    patterns: ['pagliacci', 'pagliacci pizza']
  },
  {
    canonical: 'katsu burger',
    patterns: ['katsu burger', 'katsuburger']
  },
  {
    canonical: 'marination',
    patterns: ['marination', 'marination mobile']
  },
  {
    canonical: 'paseo',
    patterns: ['paseo', 'paseo caribbean']
  },
  {
    canonical: 'serious pie',
    patterns: ['serious pie']
  }
]

/**
 * Normalize a restaurant name to its canonical brand name in the database
 * @param restaurantName - The restaurant name from OpenStreetMap or user input
 * @returns The canonical brand name if found, otherwise the lowercased input
 */
export function normalizeRestaurantName(restaurantName: string): string {
  const normalized = restaurantName.toLowerCase().trim()
  
  // Try to find an exact or partial match
  for (const brand of BRAND_MAPPINGS) {
    for (const pattern of brand.patterns) {
      if (normalized === pattern || normalized.includes(pattern)) {
        return brand.canonical
      }
    }
  }
  
  // If no match found, return the normalized version
  return normalized
}

/**
 * Check if a restaurant has meal data in our database
 * @param restaurantName - The restaurant name to check
 * @returns True if the restaurant is in our database
 */
export function hasKnownMealData(restaurantName: string): boolean {
  const canonical = normalizeRestaurantName(restaurantName)
  return BRAND_MAPPINGS.some(brand => brand.canonical === canonical)
}

/**
 * Get display name for a restaurant brand
 * @param canonicalName - The canonical brand name from database
 * @returns A user-friendly display name
 */
export function getDisplayName(canonicalName: string): string {
  const brand = BRAND_MAPPINGS.find(b => b.canonical === canonicalName)
  if (brand && brand.patterns.length > 0) {
    // Return the first pattern, capitalized
    return brand.patterns[0]
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }
  
  // Fallback: capitalize each word
  return canonicalName
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Get all canonical brand names in the database
 * @returns Array of canonical brand names
 */
export function getAllBrands(): string[] {
  return BRAND_MAPPINGS.map(b => b.canonical)
}
