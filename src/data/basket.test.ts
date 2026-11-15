import {
  addItem,
  type BasketItem,
  basketItemFromFood,
  basketItemFromPortion,
  basketTotals,
  clearBasket,
  itemMacros,
  loadBasket,
  logBasket,
  portionCount,
  removeItem,
  saveBasket,
  setAmount,
  stepItem,
} from './basket'
import { createDatabase } from './db'
import { createCustomFood, foodById } from './foods'
import { nutritionDay } from './nutrition'
import { completeOnboarding } from './profile'
import { logQuickMacros, type Portion } from './quick-food'
import { createLocalStore } from './store'

// Shporta e ushqimit (V59, SPEC §0.3h): logjika pa UI, me provat para kodit. Shtimi bashkon të njëjtin ushqim,
// sasia ndryshon me gramë ose me porcione, totalet vijnë nga makrot për 100 g, shporta ruhet në telefon dhe
// regjistrimi e kthen çdo artikull në një regjistrim të vaktit.
const USER = '11111111-1111-4111-8111-111111111111'
const NOW = new Date('2026-11-18T12:30:00')
const TODAY = '2026-11-18'

const EGG: BasketItem = {
  foodId: 'egg',
  name: 'Vezë e zier',
  source: 'usda',
  sourceId: '748967',
  per100: { kcal: 155, proteinG: 12.6, carbsG: 1.1, fatG: 10.6 },
  grams: 50,
  servings: null,
  servingG: 50,
  servingLabel: '1 vezë e madhe',
}
const BREAD: BasketItem = { foodId: 'bread', name: 'Bukë integrale', source: 'template', sourceId: 'jim:bread', per100: { kcal: 252, proteinG: 12, carbsG: 41, fatG: 3.5 }, grams: 32, servings: null, servingG: 32, servingLabel: '1 fetë' }
const QUICK: BasketItem = { foodId: 'quick', name: 'Kek', source: 'custom', sourceId: 'quick:quick', per100: { kcal: 300, proteinG: 5, carbsG: 40, fatG: 12 }, grams: null, servings: 1, servingG: 100, servingLabel: null }

describe('shporta: shtimi, sasia, heqja', () => {
  it('i njëjti ushqim bashkohet: gramët mblidhen, radha e parë mbahet', () => {
    const items = addItem(addItem([EGG], BREAD), { ...EGG, grams: 100 })
    expect(items.map((item) => [item.foodId, item.grams])).toEqual([
      ['egg', 150],
      ['bread', 32],
    ])
  })

  it('porcionet pa gramë (makrot e shpejta) mblidhen si porcione', () => {
    const items = addItem(addItem([], QUICK), QUICK)
    expect(items).toHaveLength(1)
    expect(items[0].servings).toBe(2)
    expect(items[0].grams).toBeNull()
  })

  it('setAmount ndryshon vetëm atë ushqim; sasia jo pozitive e heq', () => {
    const items = setAmount([EGG, BREAD], 'egg', { grams: 100 })
    expect(items.map((item) => item.grams)).toEqual([100, 32])
    expect(setAmount(items, 'egg', { grams: 0 }).map((item) => item.foodId)).toEqual(['bread'])
    expect(setAmount([QUICK], 'quick', { servings: 3 })[0].servings).toBe(3)
  })

  it('removeItem heq një ushqim dhe nuk prek të tjerët; ushqimi që mungon nuk ndryshon asgjë', () => {
    expect(removeItem([EGG, BREAD], 'egg')).toEqual([BREAD])
    expect(removeItem([EGG], 'jo')).toEqual([EGG])
  })

  it('funksionet nuk e ndryshojnë listën që marrin', () => {
    const original = [EGG]
    addItem(original, EGG)
    setAmount(original, 'egg', { grams: 1 })
    removeItem(original, 'egg')
    expect(original).toEqual([EGG])
    expect(original[0].grams).toBe(50)
  })
})

describe('shporta: porcionet e rreshtit "+" / "−"', () => {
  it('stepItem shton një porcion të rreshtit dhe e heq kur mbaron', () => {
    const portion = { ...EGG, grams: 50 }
    let items = stepItem([], portion, 1)
    items = stepItem(items, portion, 1)
    expect(items[0].grams).toBe(100)
    expect(portionCount(items, portion)).toBe(2)
    items = stepItem(items, portion, -1)
    expect(portionCount(items, portion)).toBe(1)
    items = stepItem(items, portion, -1)
    expect(items).toEqual([])
    expect(portionCount(items, portion)).toBe(0)
  })

  it('"−" nuk zbret nën zero kur sasia u ndryshua në fletë (30 g me porcion 50 g)', () => {
    const items = [{ ...EGG, grams: 30 }]
    expect(stepItem(items, EGG, -1)).toEqual([])
  })

  it('numri te rreshti jepet me gjysmë porcioni (75 g me porcion 50 g = 1,5)', () => {
    expect(portionCount([{ ...EGG, grams: 75 }], EGG)).toBe(1.5)
    expect(portionCount([QUICK], QUICK)).toBe(1)
  })
})

describe('shporta: makrot dhe totalet', () => {
  it('makrot e artikullit: gramët nga vlerat për 100 g, porcionet pa gramë nga vlera e porcionit', () => {
    const egg = itemMacros({ ...EGG, grams: 100 })
    expect([egg.kcal, egg.proteinG, egg.carbsG, egg.fatG].map((value) => Math.round(value * 10) / 10)).toEqual([155, 12.6, 1.1, 10.6])
    expect(itemMacros({ ...QUICK, servings: 2 })).toEqual({ kcal: 600, proteinG: 10, carbsG: 80, fatG: 24 })
  })

  it('totali i shportës është shuma e artikujve; shporta bosh ka zero', () => {
    const total = basketTotals([{ ...EGG, grams: 100 }, BREAD])
    expect(total.kcal).toBeCloseTo(155 + 0.32 * 252, 5)
    expect(total.proteinG).toBeCloseTo(12.6 + 0.32 * 12, 5)
    expect(basketTotals([])).toEqual({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 })
  })
})

describe('shporta: ruajtja në telefon', () => {
  const memory = () => {
    const values = new Map<string, string>()
    return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => void values.set(key, value), removeItem: (key: string) => void values.delete(key), values }
  }

  it('ruhet dhe rilexohet me të njëjtat artikuj', () => {
    const storage = memory()
    saveBasket([EGG, QUICK], storage)
    expect(loadBasket(storage)).toEqual([EGG, QUICK])
  })

  it('zbrazja heq çelësin; shporta bosh nuk lë gjurmë', () => {
    const storage = memory()
    saveBasket([EGG], storage)
    clearBasket(storage)
    expect(storage.values.size).toBe(0)
    saveBasket([], storage)
    expect(storage.values.size).toBe(0)
    expect(loadBasket(storage)).toEqual([])
  })

  it('e dëmtuar ose me formë tjetër: bosh, pa gabim; artikujt e prishur hidhen, të tjerët mbeten', () => {
    const storage = memory()
    storage.setItem('vrull.basket', '{jo json')
    expect(loadBasket(storage)).toEqual([])
    storage.setItem('vrull.basket', JSON.stringify({ items: 'jo' }))
    expect(loadBasket(storage)).toEqual([])
    storage.setItem('vrull.basket', JSON.stringify({ items: [EGG, { foodId: 'x' }, { ...BREAD, grams: -5 }, { ...BREAD, grams: null, servings: null }, BREAD] }))
    expect(loadBasket(storage).map((item) => item.foodId)).toEqual(['egg', 'bread'])
  })
})

async function setup() {
  const store = createLocalStore(createDatabase(`basket-${crypto.randomUUID()}`), { userId: () => USER, now: () => NOW })
  await completeOnboarding(store, { weightKg: 88, trainingDays: [1, 2, 4, 5], trainingTime: '21:00', wakeTime: '08:20', sleepTime: '01:00' }, () => NOW)
  return store
}

describe('shporta: nga ushqimet dhe regjistrimi', () => {
  it('nga një ushqim: porcioni i tij ose 100 g; makrot e shpejta bëhen një porcion', async () => {
    const store = await setup()
    const rice = await foodById(store, await createCustomFood(store, { name: 'Oriz', kcal: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3, servingG: 150, servingLabel: '1 filxhan' }))
    expect(basketItemFromFood(rice!)).toMatchObject({ foodId: rice!.id, grams: 150, servings: null, servingG: 150, servingLabel: '1 filxhan', per100: { kcal: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3 } })
    const plain = await foodById(store, await createCustomFood(store, { name: 'Kos', kcal: 60, proteinG: 3.5, carbsG: 4.7, fatG: 3.3 }))
    expect(basketItemFromFood(plain!).grams).toBe(100)
    expect(basketItemFromFood(plain!, 250).grams).toBe(250)
    const quickId = await logQuickMacros(store, { date: TODAY, meal: 'lunch', name: 'Kek', kcal: 300, proteinG: 5, carbsG: 40, fatG: 12, favorite: false })
    const quick = basketItemFromFood((await foodById(store, quickId))!)
    expect(quick).toMatchObject({ grams: null, servings: 1 })
    expect(itemMacros(quick).kcal).toBe(300)
  })

  it('nga një porcion të fundit ose të preferuar: gramët ose porcionet e tij', async () => {
    const store = await setup()
    const foodId = await createCustomFood(store, { name: 'Djathë', kcal: 263, proteinG: 14, carbsG: 4, fatG: 21, servingG: 30, servingLabel: '30 g' })
    const portion: Portion = { foodId, name: 'Djathë', sourceId: null, grams: 60, servings: null, kcal: 158, proteinG: 8.4 }
    expect(await basketItemFromPortion(store, portion)).toMatchObject({ foodId, grams: 60, servings: null, servingG: 30 })
    const quickId = await logQuickMacros(store, { date: TODAY, meal: 'lunch', name: 'Kek', kcal: 300, proteinG: 5, carbsG: 40, fatG: 12, favorite: true })
    const quickPortion: Portion = { foodId: quickId, name: 'Kek', sourceId: `quick:${quickId}`, grams: null, servings: 1, kcal: 300, proteinG: 5 }
    expect(await basketItemFromPortion(store, quickPortion)).toMatchObject({ foodId: quickId, grams: null, servings: 1 })
    expect(await basketItemFromPortion(store, { ...portion, foodId: 'nuk-ekziston' })).toBeNull()
  })

  it('logBasket: çdo artikull një regjistrim te vakti, me makrot e shportës; kthen ushqimet e regjistruara', async () => {
    const store = await setup()
    const egg = await createCustomFood(store, { name: 'Vezë e zier', kcal: 155, proteinG: 12.6, carbsG: 1.1, fatG: 10.6, servingG: 50, servingLabel: '1 vezë e madhe' })
    const quickId = await logQuickMacros(store, { date: '2026-11-17', meal: 'lunch', name: 'Kek', kcal: 300, proteinG: 5, carbsG: 40, fatG: 12, favorite: false })
    const eggItem = { ...basketItemFromFood((await foodById(store, egg))!), grams: 100 }
    const quickItem = basketItemFromFood((await foodById(store, quickId))!)
    const before = (await nutritionDay(store, TODAY, NOW)).totals.kcal
    expect(await logBasket(store, TODAY, 'snack_am', [eggItem, quickItem])).toBe(2)
    const day = await nutritionDay(store, TODAY, NOW)
    const slot = day.meals.find((meal) => meal.meal === 'snack_am')!
    expect(slot.entries.map((entry) => [entry.name, entry.grams, Math.round(entry.kcal)]).sort()).toEqual([
      ['Kek', null, 300],
      ['Vezë e zier', 100, 155],
    ])
    expect(Math.round(day.totals.kcal - before)).toBe(455)
  })

  it('logBasket me shportë bosh nuk regjistron asgjë', async () => {
    const store = await setup()
    expect(await logBasket(store, TODAY, 'lunch', [])).toBe(0)
    expect(await store.all('diary_entries')).toHaveLength(0)
  })
})
