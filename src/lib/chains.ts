// Only include chains that have verified menu items in our database
// This ensures "Known Menu" label is accurate
export const KNOWN_CHAINS = [
  // National chains with verified menu data
  'chipotle',
  'cava',
  'sweetgreen',
  'subway',
  'panera',
  'starbucks',
  'panda express',
  'chick-fil-a',
  'shake shack',
  'jersey mike\'s',

  // California-specific (Irvine/SF)
  'in-n-out',
  'the habit burger',
  'el pollo loco',
  'flame broiler',
  'tender greens',

  // NYC-specific
  'joe\'s pizza',
  'dig',
  'chop\'t',
  'just salad',
  'pret a manger',

  // Seattle-specific
  'dick\'s drive-in',
  'ivar\'s',
  'teriyaki madness',
  'mod pizza',
  'ezell\'s famous chicken',
  'pagliacci pizza',
  'paseo',
  'katsu burger',
  'marination',
  'serious pie'
]

export function isKnownChain(restaurantName: string): boolean {
  const name = restaurantName.toLowerCase()
  return KNOWN_CHAINS.some(chain => name.includes(chain))
}