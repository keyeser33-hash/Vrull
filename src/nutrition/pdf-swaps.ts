import type { FoodDef, JimFoodKey } from './jim'

// Zëvendësimet e PDF-së (Shortcut to Size, "Meal replacements"; SPEC §9, V34): për çdo ushqim të
// shabllonit, lista e Jimit me ushqimet që e zëvendësojnë. Makrot për 100 g nga USDA FoodData Central
// (SR Legacy), si te shablloni: mishrat dhe peshku të papërpunuar, perimet dhe frutat të freskëta;
// orizi, makaronat, kinoa dhe patatja e ëmbël të gatuara; perimet e përziera të ngrira, të ziera.
// Mbetën jashtë markat pa një vlerë të përgjithshme te USDA (drithërat e ftohta si Cheerios, buka
// Ezekiel, waffle-t, Pixy Stix, Bottle Caps) dhe sorbeti; salmoni është tashmë te shablloni.

export const PDF_FOODS = {
  // Mishrat (zëvendësojnë salmonin dhe tonin).
  chicken_breast: { name: 'Gjoks pule', kcal: 120, proteinG: 22.5, carbsG: 0, fatG: 2.62 },
  chicken_thigh: { name: 'Kofshë pule pa lëkurë', kcal: 119, proteinG: 19.65, carbsG: 0, fatG: 3.91 },
  turkey_breast: { name: 'Gjoks gjeldeti', kcal: 114, proteinG: 23.66, carbsG: 0.14, fatG: 1.48 },
  ground_turkey: { name: 'Gjeldeti i grirë (93% pa yndyrë)', kcal: 150, proteinG: 18.73, carbsG: 0, fatG: 8.34 },
  ground_beef: { name: 'Viçi i grirë (90% pa yndyrë)', kcal: 176, proteinG: 20, carbsG: 0, fatG: 10 },
  tri_tip: { name: 'Biftek tri-tip', kcal: 142, proteinG: 21.26, carbsG: 0, fatG: 5.63 },
  flank_steak: { name: 'Biftek flank', kcal: 149, proteinG: 21.7, carbsG: 0, fatG: 6.29 },
  pork_tenderloin: { name: 'Fileto derri', kcal: 109, proteinG: 20.95, carbsG: 0, fatG: 2.17 },
  bison: { name: 'Bizon pa yndyrë', kcal: 109, proteinG: 21.62, carbsG: 0, fatG: 1.84 },
  trout: { name: 'Troftë', kcal: 141, proteinG: 20.77, carbsG: 0, fatG: 6.18 },
  tilapia: { name: 'Tilapia', kcal: 96, proteinG: 20.08, carbsG: 0, fatG: 1.7 },
  shrimp: { name: 'Karkaleca', kcal: 85, proteinG: 20.1, carbsG: 0, fatG: 0.51 },
  crab: { name: 'Gaforre', kcal: 84, proteinG: 18.29, carbsG: 0, fatG: 0.6 },
  deli_turkey: { name: 'Gjeldeti në feta', kcal: 106, proteinG: 14.8, carbsG: 2.2, fatG: 3.77 },
  deli_ham: { name: 'Proshutë e gatuar në feta', kcal: 107, proteinG: 16.85, carbsG: 0.7, fatG: 4.04 },
  deli_roast_beef: { name: 'Rosto viçi në feta', kcal: 115, proteinG: 18.6, carbsG: 0.64, fatG: 3.69 },
  // Bulmetrat (zëvendësojnë gjizën).
  greek_yogurt: { name: 'Jogurt grek pa yndyrë', kcal: 59, proteinG: 10.19, carbsG: 3.6, fatG: 0.39 },
  light_cheese: { name: 'Mocarelë me pak yndyrë', kcal: 254, proteinG: 24.26, carbsG: 2.77, fatG: 15.92 },
  plain_yogurt: { name: 'Kos me pak yndyrë', kcal: 63, proteinG: 5.25, carbsG: 7.04, fatG: 1.55 },
  light_milk: { name: 'Qumësht 1%', kcal: 42, proteinG: 3.37, carbsG: 4.99, fatG: 0.97 },
  // Drithërat e plota (zëvendësojnë tërshërën dhe bukën integrale).
  wheat_crackers: { name: 'Kraker integral', kcal: 427, proteinG: 10.58, carbsG: 69.55, fatG: 14.13 },
  brown_rice: { name: 'Oriz kaf i gatuar', kcal: 123, proteinG: 2.74, carbsG: 25.58, fatG: 0.97 },
  rye_bread: { name: 'Bukë thekre', kcal: 259, proteinG: 8.5, carbsG: 48.3, fatG: 3.3 },
  sourdough: { name: 'Bukë me maja natyrale', kcal: 272, proteinG: 10.75, carbsG: 51.88, fatG: 2.42 },
  wheat_muffin: { name: 'English muffin integral', kcal: 203, proteinG: 8.8, carbsG: 40.4, fatG: 2.1 },
  wheat_pita: { name: 'Pita integrale', kcal: 262, proteinG: 9.8, carbsG: 55, fatG: 2.6 },
  wheat_bagel: { name: 'Bagel integral', kcal: 250, proteinG: 10.2, carbsG: 48.9, fatG: 1.53 },
  wheat_tortilla: { name: 'Tortilla integrale', kcal: 310, proteinG: 9.76, carbsG: 45.89, fatG: 9.76 },
  wheat_pasta: { name: 'Makarona integrale të gatuara', kcal: 149, proteinG: 5.99, carbsG: 30.1, fatG: 1.71 },
  quinoa: { name: 'Kinoa e gatuar', kcal: 120, proteinG: 4.4, carbsG: 21.3, fatG: 1.92 },
  sweet_potato: { name: 'Patate e ëmbël e pjekur', kcal: 90, proteinG: 2.01, carbsG: 20.71, fatG: 0.15 },
  // Perimet (zëvendësojnë brokolin dhe sallatën).
  asparagus: { name: 'Shparg', kcal: 20, proteinG: 2.2, carbsG: 3.88, fatG: 0.12 },
  green_beans: { name: 'Bishtaja', kcal: 31, proteinG: 1.83, carbsG: 6.97, fatG: 0.22 },
  cauliflower: { name: 'Lulelakër', kcal: 25, proteinG: 1.92, carbsG: 4.97, fatG: 0.28 },
  bell_pepper: { name: 'Spec i ëmbël', kcal: 31, proteinG: 0.99, carbsG: 6.03, fatG: 0.3 },
  brussels_sprouts: { name: 'Lakër Brukseli', kcal: 43, proteinG: 3.38, carbsG: 8.95, fatG: 0.3 },
  mixed_vegetables: { name: 'Perime të përziera', kcal: 65, proteinG: 2.86, carbsG: 13.09, fatG: 0.15 },
  zucchini: { name: 'Kungulleshkë', kcal: 17, proteinG: 1.21, carbsG: 3.11, fatG: 0.32 },
  eggplant: { name: 'Patëllxhan', kcal: 25, proteinG: 0.98, carbsG: 5.88, fatG: 0.18 },
  bok_choy: { name: 'Bok choy', kcal: 13, proteinG: 1.5, carbsG: 2.18, fatG: 0.2 },
  // Frutat (zëvendësojnë pjeprin, ananasin dhe mollën).
  orange: { name: 'Portokall', kcal: 47, proteinG: 0.94, carbsG: 11.75, fatG: 0.12 },
  peach: { name: 'Pjeshkë', kcal: 39, proteinG: 0.91, carbsG: 9.54, fatG: 0.25 },
  banana: { name: 'Banane', kcal: 89, proteinG: 1.09, carbsG: 22.84, fatG: 0.33 },
  pear: { name: 'Dardhë', kcal: 57, proteinG: 0.36, carbsG: 15.23, fatG: 0.14 },
  strawberries: { name: 'Luleshtrydhe', kcal: 32, proteinG: 0.67, carbsG: 7.68, fatG: 0.3 },
  blueberries: { name: 'Boronica', kcal: 57, proteinG: 0.74, carbsG: 14.49, fatG: 0.33 },
  raspberries: { name: 'Mjedra', kcal: 52, proteinG: 1.2, carbsG: 11.94, fatG: 0.65 },
  blackberries: { name: 'Manaferra', kcal: 43, proteinG: 1.39, carbsG: 9.61, fatG: 0.49 },
  cherries: { name: 'Qershi', kcal: 63, proteinG: 1.06, carbsG: 16.01, fatG: 0.2 },
  grapes: { name: 'Rrush', kcal: 69, proteinG: 0.72, carbsG: 18.1, fatG: 0.16 },
  kiwi: { name: 'Kivi', kcal: 61, proteinG: 1.14, carbsG: 14.66, fatG: 0.52 },
  // Karbohidratet e shpejta pas stërvitjes (zëvendësojnë karamelet gummy).
  white_bread: { name: 'Bukë e bardhë', kcal: 266, proteinG: 7.64, carbsG: 50.61, fatG: 3.29 },
  angel_food_cake: { name: 'Kek angel food', kcal: 258, proteinG: 5.9, carbsG: 57.8, fatG: 0.8 },
} satisfies Record<string, FoodDef>

export type PdfFoodKey = keyof typeof PDF_FOODS

export type SwapList = 'meat' | 'dairy' | 'grain' | 'vegetable' | 'fruit' | 'fastCarb'

/** Listat e PDF-së, me radhën e tyre atje. */
export const SWAP_LISTS: Record<SwapList, readonly PdfFoodKey[]> = {
  meat: [
    'chicken_breast',
    'chicken_thigh',
    'turkey_breast',
    'ground_turkey',
    'ground_beef',
    'tri_tip',
    'flank_steak',
    'pork_tenderloin',
    'bison',
    'trout',
    'tilapia',
    'shrimp',
    'crab',
    'deli_turkey',
    'deli_ham',
    'deli_roast_beef',
  ],
  dairy: ['greek_yogurt', 'light_cheese', 'plain_yogurt', 'light_milk'],
  grain: ['wheat_crackers', 'brown_rice', 'rye_bread', 'sourdough', 'wheat_muffin', 'wheat_pita', 'wheat_bagel', 'wheat_tortilla', 'wheat_pasta', 'quinoa', 'sweet_potato'],
  vegetable: ['asparagus', 'green_beans', 'cauliflower', 'bell_pepper', 'brussels_sprouts', 'mixed_vegetables', 'zucchini', 'eggplant', 'bok_choy'],
  fruit: ['orange', 'peach', 'banana', 'pear', 'strawberries', 'blueberries', 'raspberries', 'blackberries', 'cherries', 'grapes', 'kiwi'],
  fastCarb: ['white_bread', 'angel_food_cake'],
}

/** Ushqimet e shabllonit që PDF-ja i zëvendëson, sipas listës. */
const JIM_SWAP_LIST: Partial<Record<JimFoodKey, SwapList>> = {
  salmon: 'meat',
  tuna: 'meat',
  cottage_cheese: 'dairy',
  oatmeal: 'grain',
  wheat_bread: 'grain',
  broccoli: 'vegetable',
  greens: 'vegetable',
  cantaloupe: 'fruit',
  pineapple: 'fruit',
  apple: 'fruit',
  gummies: 'fastCarb',
}

/** Lloji i ushqimit për ndërrimin, si te `JIM_GROUPS`. */
export const SWAP_LIST_GROUP: Record<SwapList, 'protein' | 'carbs' | 'produce'> = {
  meat: 'protein',
  dairy: 'protein',
  grain: 'carbs',
  vegetable: 'produce',
  fruit: 'produce',
  fastCarb: 'carbs',
}

/** Artikujt e PDF-së në planin: `pdf:<çelësi>`. */
export const PDF_PREFIX = 'pdf:'

export const isPdfFood = (food: string): boolean => food.startsWith(PDF_PREFIX) && Object.hasOwn(PDF_FOODS, food.slice(PDF_PREFIX.length))
export const pdfKey = (food: string): PdfFoodKey | null => (isPdfFood(food) ? (food.slice(PDF_PREFIX.length) as PdfFoodKey) : null)

/** Lista e PDF-së për një artikull: ajo që zëvendëson ushqimin e shabllonit, ose ajo ku bën pjesë. */
export function swapListFor(food: string): SwapList | null {
  if (Object.hasOwn(JIM_SWAP_LIST, food)) return JIM_SWAP_LIST[food as JimFoodKey] ?? null
  const key = pdfKey(food)
  if (!key) return null
  return (Object.keys(SWAP_LISTS) as SwapList[]).find((list) => SWAP_LISTS[list].includes(key)) ?? null
}
