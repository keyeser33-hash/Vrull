// Emri shqip i porcionit të një rreshti të Listës së Vrullit ("1 cup, chopped" → "1 filxhan, grirë").
// Burimet e japin porcionin vetëm anglisht. Kur një pjesë e etiketës nuk njihet, ose njësia është
// amerikane pa kuptim te ne (oz, lb, fl oz, inç), kthehet null: ekrani bie te gramët, që të mos
// tregojë një njësi gjysmë të përkthyer.

type Gender = 'm' | 'f'

const NOUNS: Record<string, [string, Gender]> = {
  cup: ['filxhan', 'm'],
  tbsp: ['lugë gjelle', 'f'],
  tablespoon: ['lugë gjelle', 'f'],
  tsp: ['lugë çaji', 'f'],
  teaspoon: ['lugë çaji', 'f'],
  serving: ['porcion', 'm'],
  order: ['porcion', 'm'],
  piece: ['copë', 'f'],
  item: ['copë', 'f'],
  link: ['copë', 'f'],
  slice: ['fetë', 'f'],
  steak: ['biftek', 'm'],
  fillet: ['fileto', 'f'],
  chop: ['bërxollë', 'f'],
  patty: ['qofte', 'f'],
  meatball: ['qofte', 'f'],
  sandwich: ['sanduiç', 'm'],
  hamburger: ['hamburger', 'm'],
  cheeseburger: ['çizburger', 'm'],
  bar: ['shufër', 'f'],
  can: ['kanaçe', 'f'],
  bottle: ['shishe', 'f'],
  glass: ['gotë', 'f'],
  bowl: ['tas', 'm'],
  plate: ['pjatë', 'f'],
  jar: ['kavanoz', 'm'],
  container: ['kuti', 'f'],
  tub: ['kuti', 'f'],
  box: ['kuti', 'f'],
  package: ['paketë', 'f'],
  packet: ['bustinë', 'f'],
  envelope: ['bustinë', 'f'],
  pouch: ['qese', 'f'],
  bag: ['qese', 'f'],
  scoop: ['lugë matëse', 'f'],
  drink: ['pije', 'f'],
  meal: ['vakt', 'm'],
  egg: ['vezë', 'f'],
  'egg white': ['e bardhë veze', 'f'],
  'egg yolk': ['e verdhë veze', 'f'],
  thigh: ['kofshë', 'f'],
  drumstick: ['kopan', 'm'],
  wing: ['krah', 'm'],
  breast: ['gjoks', 'm'],
  sausage: ['salsiçe', 'f'],
  cracker: ['kraker', 'm'],
  cookie: ['biskotë', 'f'],
  muffin: ['mafin', 'm'],
  cone: ['kon', 'm'],
  tortilla: ['tortilla', 'f'],
  pizza: ['picë', 'f'],
  kernel: ['kokërr', 'f'],
  nut: ['kokërr', 'f'],
  berry: ['kokërr', 'f'],
  fruit: ['frut', 'm'],
  leaf: ['gjethe', 'f'],
  strip: ['rrip', 'm'],
  wedge: ['thelë', 'f'],
  cube: ['kub', 'm'],
  half: ['gjysmë', 'f'],
  clove: ['thelb', 'm'],
  head: ['kokë', 'f'],
  stalk: ['kërcell', 'm'],
  bunch: ['tufë', 'f'],
  ear: ['kalli', 'm'],
  pepper: ['spec', 'm'],
  olive: ['ulli', 'm'],
  cherry: ['qershi', 'f'],
  fig: ['fik', 'm'],
  apple: ['mollë', 'f'],
  banana: ['banane', 'f'],
  orange: ['portokall', 'm'],
  tomato: ['domate', 'f'],
  potato: ['patate', 'f'],
  onion: ['qepë', 'f'],
  carrot: ['karotë', 'f'],
  cucumber: ['kastravec', 'm'],
  pear: ['dardhë', 'f'],
  peach: ['pjeshkë', 'f'],
  plum: ['kumbull', 'f'],
  apricot: ['kajsi', 'f'],
  lemon: ['limon', 'm'],
  mushroom: ['kërpudhë', 'f'],
  shrimp: ['karkalec', 'm'],
  sheet: ['fletë', 'f'],
  square: ['katror', 'm'],
}

// Madhësia para emrit ("large fillet") ose e vetme ("1 large" = një copë e madhe).
const SIZES: Record<string, Record<Gender, string>> = {
  large: { m: 'i madh', f: 'e madhe' },
  medium: { m: 'mesatar', f: 'mesatare' },
  small: { m: 'i vogël', f: 'e vogël' },
  whole: { m: 'i plotë', f: 'e plotë' },
  thin: { m: 'i hollë', f: 'e hollë' },
  thick: { m: 'i trashë', f: 'e trashë' },
  miniature: { m: 'shumë i vogël', f: 'shumë e vogël' },
  'extra large': { m: 'shumë i madh', f: 'shumë e madhe' },
}

// Si është ushqimi brenda njësisë ("cup, chopped"). Vargu bosh: fjala hiqet pa humbur kuptim.
const QUALIFIERS: Record<string, string> = {
  cooked: 'gatuar',
  raw: 'pa gatuar',
  chopped: 'grirë',
  diced: 'prerë kubikë',
  cubed: 'prerë kubikë',
  cubes: 'kubikë',
  sliced: 'prerë feta',
  slices: 'feta',
  mashed: 'shtypur',
  crushed: 'shtypur',
  shredded: 'grirë hollë',
  grated: 'grirë',
  ground: 'bluar',
  crumbled: 'thërrmuar',
  halves: 'gjysma',
  pieces: 'copa',
  whole: 'të plota',
  pitted: 'pa bërthamë',
  dry: 'thatë',
  drained: 'kulluar',
  melted: 'shkrirë',
  packed: 'ngjeshur',
  boneless: 'pa kocka',
  'without skin': 'pa lëkurë',
  'with skin': 'me lëkurë',
  kernels: 'kokrra',
  large: 'madhësi e madhe',
  medium: 'madhësi mesatare',
  small: 'madhësi e vogël',
  'snack-size': 'madhësi e vogël',
  nfs: '',
  'any size': '',
}

const IMPERIAL = /(^|[^a-z])(oz|lb|lbs|pound|pounds|fl|pint|quart|gallon|inch|inches|in)([^a-z]|$)|"/

function phrase(text: string): string | null {
  const words = text.split(' ')
  // Madhësia para emrit, pastaj emri më i gjatë i njohur; ç'mbetet lexohet si cilësim.
  const two = words.slice(0, 2).join(' ')
  const size = SIZES[two] ? two : SIZES[words[0]] ? words[0] : null
  const rest = size ? words.slice(size.split(' ').length) : words
  let noun: [string, Gender] | null = null
  let used = 0
  for (const length of [2, 1]) {
    const candidate = NOUNS[rest.slice(0, length).join(' ')]
    if (candidate && rest.length >= length) {
      noun = candidate
      used = length
      break
    }
  }
  // "1 large": një copë e madhe.
  if (!noun && size && rest.length === 0) noun = ['copë', 'f']
  if (!noun) return null
  const head = size ? `${noun[0]} ${SIZES[size][noun[1]]}` : noun[0]
  const tail = rest.slice(used).join(' ')
  if (tail === '') return head
  const qualifier = QUALIFIERS[tail]
  return qualifier === undefined ? null : qualifier === '' ? head : `${head}, ${qualifier}`
}

/** "1 cup, cooked, diced" → "1 filxhan, gatuar, prerë kubikë"; null kur etiketa nuk përkthehet e plotë. */
export function portionSq(label: string): string | null {
  const match = /^1 (.+)$/.exec(label.trim())
  if (!match) return null
  // Kllapat mbajnë vetëm masën amerikane të së njëjtës njësi ("cup (8 fl oz)"): hiqen.
  const bare = match[1].toLowerCase().replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim()
  // "serving 1/2 cup", "serving 100 ml": mbetet porcioni; gramët i ka rreshti.
  const text = /^serving \d/.test(bare) ? 'serving' : bare
  if (IMPERIAL.test(text)) return null
  const [first, ...others] = text.split(/,\s*/)
  const head = phrase(first)
  if (head === null) return null
  const parts = [head]
  for (const other of others) {
    const qualifier = QUALIFIERS[other]
    if (qualifier === undefined) return null
    if (qualifier !== '') parts.push(qualifier)
  }
  return `1 ${parts.join(', ')}`
}
