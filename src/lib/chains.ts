export const KNOWN_CHAINS = [
  // National chains
  'chipotle',
  'cava',
  'sweetgreen',
  'subway',
  'panera',
  'starbucks',
  'panda express',
  'chick-fil-a',
  'five guys',
  'shake shack',
  'taco bell',
  'mcdonald\'s',
  'kfc',
  'popeyes',
  'domino\'s',
  'pizza hut',
  'jersey mike\'s',
  'jimmy john\'s',

  // California-specific (Irvine/SF)
  'in-n-out',
  'the habit burger',
  'california pizza kitchen',
  'el pollo loco',
  'flame broiler',
  'pei wei',
  'pf chang\'s',
  'pick up stix',
  'yoshinoya',
  'pho saigon',
  'lemonade restaurant',
  'tender greens',
  'honeygrow',

  // NYC-specific
  'joe\'s pizza',
  'dig',
  'by chloe',
  'chop\'t',
  'just salad',
  'bluestone lane',
  'pret a manger',
  'le pain quotidien',
  'dos toros',
  'dig inn',
  'fresh&co',
  'maoz',
  'mulberry & vine',

  // Seattle-specific
  'dick\'s drive-in',
  'ivar\'s',
  'teriyaki madness',
  'mod pizza',
  'ezell\'s famous chicken',
  'pagliacci pizza',
  'salumi',
  'paseo',
  'oriental mart',
  'katsu burger',
  'marination',
  'local 360',
  'skillet',
  'delancey pizza',
  'serious pie',

  // Popular in all four areas
  'whole foods',
  'trader joe\'s',
  'blue bottle coffee',
  'philz coffee'
]

export function isKnownChain(restaurantName: string): boolean {
  const name = restaurantName.toLowerCase()
  return KNOWN_CHAINS.some(chain => name.includes(chain))
}