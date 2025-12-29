// Flagged ingredient categories and detection patterns for health analysis

export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low'

export interface IngredientFlag {
  severity: SeverityLevel
  category: string
  displayName: string
  description: string
  patterns: string[]
}

export const INGREDIENT_FLAGS: Record<string, IngredientFlag> = {
  seedOils: {
    severity: 'high',
    category: 'Seed Oils',
    displayName: 'Seed Oils',
    description: 'Industrial seed oils high in omega-6 fatty acids',
    patterns: [
      'soybean oil',
      'canola oil',
      'vegetable oil',
      'corn oil',
      'sunflower oil',
      'safflower oil',
      'cottonseed oil',
      'rapeseed oil',
      'rice bran oil',
      'grapeseed oil',
      'peanut oil',
      'vegetable shortening'
    ]
  },
  highFructoseCornSyrup: {
    severity: 'high',
    category: 'Added Sugars',
    displayName: 'High Fructose Corn Syrup',
    description: 'Highly processed sweetener linked to metabolic issues',
    patterns: [
      'high fructose corn syrup',
      'hfcs',
      'corn syrup',
      'glucose-fructose syrup',
      'isoglucose'
    ]
  },
  transFats: {
    severity: 'critical',
    category: 'Trans Fats',
    displayName: 'Trans Fats',
    description: 'Artificial trans fats linked to heart disease',
    patterns: [
      'partially hydrogenated',
      'hydrogenated oil',
      'hydrogenated vegetable oil',
      'shortening',
      'margarine'
    ]
  },
  artificialSweeteners: {
    severity: 'medium',
    category: 'Artificial Sweeteners',
    displayName: 'Artificial Sweeteners',
    description: 'Synthetic sugar substitutes',
    patterns: [
      'aspartame',
      'sucralose',
      'saccharin',
      'acesulfame potassium',
      'acesulfame k',
      'neotame',
      'advantame'
    ]
  },
  artificialColors: {
    severity: 'medium',
    category: 'Artificial Colors',
    displayName: 'Artificial Colors',
    description: 'Synthetic food dyes',
    patterns: [
      'red 40',
      'red 3',
      'yellow 5',
      'yellow 6',
      'blue 1',
      'blue 2',
      'green 3',
      'fd&c',
      'caramel color',
      'artificial color',
      'color added'
    ]
  },
  preservatives: {
    severity: 'medium',
    category: 'Preservatives',
    displayName: 'Chemical Preservatives',
    description: 'Synthetic preservation agents',
    patterns: [
      'sodium nitrite',
      'sodium nitrate',
      'tbhq',
      'bht',
      'bha',
      'potassium sorbate',
      'sodium benzoate',
      'calcium propionate',
      'sodium metabisulfite',
      'sulfites'
    ]
  },
  flavorEnhancers: {
    severity: 'low',
    category: 'Flavor Enhancers',
    displayName: 'MSG & Flavor Enhancers',
    description: 'Artificial flavor enhancement',
    patterns: [
      'monosodium glutamate',
      'msg',
      'autolyzed yeast',
      'hydrolyzed protein',
      'natural flavors',
      'artificial flavors',
      'disodium inosinate',
      'disodium guanylate'
    ]
  },
  emulsifiersThickeners: {
    severity: 'low',
    category: 'Emulsifiers',
    displayName: 'Emulsifiers & Thickeners',
    description: 'Food texture modifiers that may affect gut health',
    patterns: [
      'carrageenan',
      'polysorbate 80',
      'polysorbate 60',
      'xanthan gum',
      'guar gum',
      'cellulose gum',
      'sodium carboxymethyl cellulose',
      'lecithin'
    ]
  }
}

// Helper to get severity weight for scoring
export function getSeverityWeight(severity: SeverityLevel): number {
  switch (severity) {
    case 'critical': return 25
    case 'high': return 15
    case 'medium': return 8
    case 'low': return 3
    default: return 0
  }
}

// Get all patterns as a flat list for quick matching
export function getAllFlagPatterns(): { pattern: string; flagKey: string; flag: IngredientFlag }[] {
  const allPatterns: { pattern: string; flagKey: string; flag: IngredientFlag }[] = []

  for (const [key, flag] of Object.entries(INGREDIENT_FLAGS)) {
    for (const pattern of flag.patterns) {
      allPatterns.push({ pattern: pattern.toLowerCase(), flagKey: key, flag })
    }
  }

  return allPatterns
}
