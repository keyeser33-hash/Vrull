import type { Draft } from '../../supabase/functions/log-parse/shared'
import { boxContext, chooseOption, logBoxDraft, mergeAnswer, nearestMeal, removeRow, resolveDraft, setGrams, setMeal } from './ai-box'
import { createDatabase } from './db'
import { nutritionDay } from './nutrition'
import { completeOnboarding } from './profile'
import { logQuickMacros } from './quick-food'
import { createLocalStore } from './store'
import { ensureSupplements, saveSupplement } from './supplements'
import { i18nFor } from '@/i18n'

// Kutia e AI-së në telefon (V40, V2-E2-13): konteksti që dërgohet, drafti me vaktet e zgjidhura dhe regjistrimi.
const USER = '11111111-1111-4111-8111-111111111111'
const WEDNESDAY = '2026-12-09'
const EVENING = new Date('2026-12-09T22:40:00')
const sq = i18nFor('sq')

async function setup() {
  const store = createLocalStore(createDatabase(`ai-box-${crypto.randomUUID()}`), { userId: () => USER, now: () => EVENING })
  await completeOnboarding(
    store,
    {
      weightKg: 88,
      trainingDays: [1, 2, 4, 5],
      trainingTime: '21:00',
      wakeTime: '08:20',
      sleepTime: '01:00',
    },
    () => new Date('2026-12-01T08:00:00'),
  )
  await ensureSupplements(store)
  const wheyId = await saveSupplement(store, {
    name: 'Gold Standard 100% Whey',
    kind: 'protein',
    doseAmount: 1,
    doseUnit: 'scoop',
    scoopG: 30,
    timing: ['breakfast_1'],
    macros: { kcal: 120, proteinG: 24, carbsG: 3, fatG: 1.5 },
    countsAsFood: true,
  })
  return { store, wheyId }
}

const empty: Draft = {
  foods: [],
  water: [],
  supplements: [],
  sets: [],
  answer: null,
  notUnderstood: [],
}
const food = (fields: Partial<Draft['foods'][number]>): Draft['foods'][number] => ({
  said: 'x',
  ref: null,
  name: 'x',
  grams: 100,
  portion: '',
  estimated: false,
  per100: { kcal: 100, proteinG: 10, carbsG: 10, fatG: 1 },
  options: [],
  meal: null,
  time: null,
  day: 0,
  ...fields,
})

describe('konteksti', () => {
  it('vaktet e sotme me emrat, ushqimet e planit me porcionin, suplementet me dozën', async () => {
    const { store } = await setup()
    const box = await boxContext(store, EVENING, sq)
    expect(box.request.date).toBe(WEDNESDAY)
    expect(box.request.time).toBe('22:40')
    expect(box.request.context.language).toBe('sq')
    const day = await nutritionDay(store, WEDNESDAY, EVENING)
    expect(box.request.context.meals).toEqual(
      day.meals.map((slot) => ({
        key: slot.meal,
        name: sq.t(`food.meal.${slot.meal}`),
        time: slot.time,
      })),
    )
    const bread = box.request.context.foods.find((item) => item.name === 'Bukë integrale')
    expect(bread).toBeDefined()
    expect(bread!.portion).toMatch(/^1 fetë = \d+\u00a0g$/)
    // Çdo referencë e kontekstit kthehet te ushqimi i vet.
    expect(box.request.context.foods.every((item) => box.refs.foods.has(item.ref))).toBe(true)
    const whey = box.request.context.supplements.find((item) => item.name === 'Gold Standard 100% Whey')
    expect(whey?.dose).toBe('1 lugë = 30\u00a0g')
    expect(new Set(box.request.context.foods.map((item) => item.ref)).size).toBe(box.request.context.foods.length)
  })

  it('një vakt me makrot e shpejta shkon si një porcion, që AI-ja të mos e shumëzojë me gramë', async () => {
    const { store } = await setup()
    await logQuickMacros(store, { date: WEDNESDAY, meal: 'lunch', name: 'Drekë jashtë', kcal: 650, proteinG: 40, carbsG: 60, fatG: 25, favorite: false })
    const box = await boxContext(store, EVENING, sq)
    expect(box.request.context.foods.find((item) => item.name === 'Drekë jashtë')?.portion).toBe('1 porcion = 100 g')
  })

  it('pas mesnate, para ndërrimit të ditës së ushqimit: dita e djeshme', async () => {
    const { store } = await setup()
    const box = await boxContext(store, new Date('2026-12-10T00:40:00'), sq)
    expect(box.request.date).toBe(WEDNESDAY)
    expect(box.request.time).toBe('00:40')
  })
})

describe('vakti', () => {
  const slots = [
    { meal: 'breakfast_1' as const, time: '08:20' },
    { meal: 'snack_am' as const, time: '11:50' },
    { meal: 'lunch' as const, time: '14:20' },
    { meal: 'dinner' as const, time: '19:50' },
    { meal: 'bedtime' as const, time: '00:30' },
  ]
  it('ora shkon te vakti më i afërt, edhe përtej mesnatës', () => {
    expect(nearestMeal(slots, '12:00')).toBe('snack_am')
    expect(nearestMeal(slots, '07:00')).toBe('breakfast_1')
    expect(nearestMeal(slots, '23:55')).toBe('bedtime')
    expect(nearestMeal([], '12:00')).toBeNull()
  })
})

describe('drafti', () => {
  it('vakti: i thënë, nga ora, ose i radhës; dita e djeshme; makrot e ushqimit të njohur nga plani', async () => {
    const { store } = await setup()
    const box = await boxContext(store, new Date('2026-12-09T13:00:00'), sq)
    const breadRef = box.request.context.foods.find((item) => item.name === 'Bukë integrale')!.ref
    const draft = await resolveDraft(
      store,
      {
        ...empty,
        foods: [
          food({
            ref: breadRef,
            name: 'Bukë integrale',
            grams: 64,
            per100: null,
            time: '12:00',
          }),
          food({
            name: 'Pulë e pjekur me lëkurë',
            grams: 300,
            estimated: true,
            per100: { kcal: 239, proteinG: 27.3, carbsG: 0, fatG: 13.6 },
            meal: 'dinner',
          }),
          food({ name: 'Kos', grams: 200 }),
          food({ name: 'Gjizë', grams: 250, meal: 'bedtime', day: -1 }),
        ],
      },
      box,
      new Date('2026-12-09T13:00:00'),
    )
    const [bread, chicken, yoghurt, cheese] = draft.foods
    expect(bread).toMatchObject({
      name: 'Bukë integrale',
      meal: 'snack_am',
      date: WEDNESDAY,
      grams: 64,
    })
    expect(bread.macros.kcal).toBeGreaterThan(100)
    expect(chicken).toMatchObject({
      meal: 'dinner',
      estimated: true,
      isNew: true,
    })
    expect(chicken.macros.kcal).toBeCloseTo(717, 0)
    const next = (await nutritionDay(store, WEDNESDAY, new Date('2026-12-09T13:00:00'))).next!.meal
    expect(yoghurt.meal).toBe(next)
    expect(cheese).toMatchObject({ meal: 'bedtime', date: '2026-12-08' })
  })

  it('suplementi: vakti nga ora, ose vakti i tij në plan', async () => {
    const { store, wheyId } = await setup()
    const box = await boxContext(store, EVENING, sq)
    const ref = (name: string) => box.request.context.supplements.find((item) => item.name === name)!.ref
    const draft = await resolveDraft(
      store,
      {
        ...empty,
        supplements: [
          {
            ref: ref('Gold Standard 100% Whey'),
            amount: 1,
            meal: null,
            time: '07:00',
            day: 0,
          },
          {
            ref: ref('Multivitaminë'),
            amount: 1,
            meal: null,
            time: null,
            day: 0,
          },
        ],
      },
      box,
      EVENING,
    )
    expect(draft.supplements).toEqual([
      expect.objectContaining({
        supplementId: wheyId,
        meal: 'breakfast_1',
        date: WEDNESDAY,
      }),
      expect.objectContaining({ name: 'Multivitaminë', meal: 'lunch' }),
    ])
  })

  it('zgjedhja e sasisë, gramët, vakti dhe heqja e një rreshti', async () => {
    const { store } = await setup()
    const box = await boxContext(store, EVENING, sq)
    let draft = await resolveDraft(
      store,
      {
        ...empty,
        foods: [
          food({
            name: 'Panetone',
            grams: null,
            per100: { kcal: 362, proteinG: 6.5, carbsG: 55, fatG: 13 },
            options: [{ label: '1 fetë', grams: 80 }],
          }),
        ],
        water: [{ ml: 500, time: null, day: 0 }],
      },
      box,
      EVENING,
    )
    expect(draft.foods[0].grams).toBeNull()
    expect(draft.foods[0].macros.kcal).toBe(0)
    draft = chooseOption(draft, draft.foods[0].key, {
      label: '1 fetë',
      grams: 80,
    })
    expect(draft.foods[0]).toMatchObject({ grams: 80, portion: '1 fetë' })
    expect(draft.foods[0].macros.kcal).toBeCloseTo(289.6, 1)
    draft = setGrams(draft, draft.foods[0].key, 160)
    expect(draft.foods[0]).toMatchObject({ grams: 160, portion: '' })
    draft = setMeal(draft, draft.foods[0].key, 'bedtime')
    expect(draft.foods[0].meal).toBe('bedtime')
    draft = removeRow(draft, draft.water[0].key)
    expect(draft.water).toEqual([])
  })

  it('përgjigja e lirë plotëson rreshtin që priste sipas emrit; të tjerat shtohen', async () => {
    const { store } = await setup()
    const box = await boxContext(store, EVENING, sq)
    const first = await resolveDraft(
      store,
      {
        ...empty,
        foods: [
          food({
            name: 'Panetone',
            grams: null,
            per100: { kcal: 362, proteinG: 6.5, carbsG: 55, fatG: 13 },
            options: [{ label: '1 fetë', grams: 80 }],
          }),
          food({ name: 'Kos', grams: 200 }),
        ],
      },
      box,
      EVENING,
    )
    const answer = await resolveDraft(
      store,
      {
        ...empty,
        foods: [
          food({
            name: 'panetone',
            grams: 120,
            portion: 'një fetë e gjysmë',
            per100: { kcal: 360, proteinG: 6, carbsG: 55, fatG: 13 },
          }),
          food({ name: 'Mollë', grams: 180 }),
        ],
      },
      box,
      EVENING,
    )
    const merged = mergeAnswer(first, answer)
    expect(merged.foods.map((row) => [row.name, row.grams])).toEqual([
      ['Panetone', 120],
      ['Kos', 200],
      ['Mollë', 180],
    ])
    // Vlerat e para mbeten: përgjigja ndryshon vetëm sasinë.
    expect(merged.foods[0].per100.kcal).toBe(362)
  })
})

describe('regjistrimi', () => {
  it('ushqimet, suplementet dhe uji; ushqimi i ri ruhet një herë; rreshti pa sasi nuk regjistrohet', async () => {
    const { store, wheyId } = await setup()
    const box = await boxContext(store, EVENING, sq)
    const ref = (name: string) => box.request.context.foods.find((item) => item.name === name)!.ref
    const supplement = box.request.context.supplements.find((item) => item.name === 'Gold Standard 100% Whey')!.ref
    const parsed: Draft = {
      foods: [
        food({
          ref: ref('Bukë integrale'),
          name: 'Bukë integrale',
          grams: 64,
          per100: null,
          time: '12:00',
        }),
        food({
          name: 'Pulë e pjekur me lëkurë',
          grams: 300,
          per100: { kcal: 239, proteinG: 27.3, carbsG: 0, fatG: 13.6 },
          meal: 'dinner',
        }),
        food({
          name: 'Panetone',
          grams: null,
          per100: { kcal: 362, proteinG: 6.5, carbsG: 55, fatG: 13 },
          options: [{ label: '1 fetë', grams: 80 }],
        }),
      ],
      water: [{ ml: 500, time: '15:00', day: 0 }],
      supplements: [{ ref: supplement, amount: 1, meal: null, time: '07:00', day: 0 }],
      sets: [],
      answer: null,
      notUnderstood: [],
    }
    const draft = await resolveDraft(store, parsed, box, EVENING)
    const counts = await logBoxDraft(store, draft)
    expect(counts).toEqual({
      foods: 2,
      water: 1,
      supplements: 1,
      sets: 0,
      skipped: 1,
    })

    const entries = await store.where('diary_entries', 'date', WEDNESDAY)
    const dinner = entries.filter((row) => row.meal === 'dinner')
    expect(dinner).toHaveLength(1)
    expect(Number(dinner[0].kcal)).toBeCloseTo(717, 0)
    expect(entries.some((row) => row.meal === 'snack_am' && Number(row.grams) === 64)).toBe(true)
    // Proteina e përdoruesit numërohet te ushqimi i mëngjesit (V39).
    expect(entries.some((row) => row.meal === 'breakfast_1' && Number(row.protein_g) === 24)).toBe(true)
    expect(await store.where('supplement_logs', 'date', WEDNESDAY)).toEqual([expect.objectContaining({ supplement_id: wheyId, timing: 'breakfast_1' })])
    expect((await store.where('water_logs', 'date', WEDNESDAY)).map((row) => Number(row.ml))).toEqual([500])

    // I njëjti ushqim i ri herën tjetër: i njëjti rresht te foods.
    await logBoxDraft(store, await resolveDraft(store, { ...empty, foods: [parsed.foods[1]] }, box, EVENING))
    const chickens = (await store.all('foods')).filter((row) => row.name === 'Pulë e pjekur me lëkurë')
    expect(chickens).toHaveLength(1)
    expect(chickens[0]).toMatchObject({ source: 'custom', source_id: expect.stringMatching(/^ai:/) })
  })

  // Baza lokale nuk i ka kontrollet e serverit (MESIMET): rreshtat provohen kundrejt migrimeve.
  it('rreshtat që serveri pranon: ushqimet e reja me source_id të veçantë, uji deri në 2 000 ml, doza e suplementit', async () => {
    const { store, wheyId } = await setup()
    const box = await boxContext(store, EVENING, sq)
    const supplement = box.request.context.supplements.find((item) => item.name === 'Gold Standard 100% Whey')!.ref
    const parsed: Draft = {
      ...empty,
      foods: [food({ name: 'Panetone', grams: 80, meal: 'dinner' }), food({ name: 'Byrek me spinaq', grams: 150, meal: 'dinner' })],
      water: [
        { ml: 3000, time: null, day: 0 },
        { ml: 333.3, time: null, day: 0 },
        { ml: 2010, time: null, day: 0 },
      ],
      supplements: [{ ref: supplement, amount: 2, meal: 'snack_pm', time: null, day: 0 }],
    }
    await logBoxDraft(store, await resolveDraft(store, parsed, box, EVENING))

    // foods_source_unique: (user_id, source, source_id) një herë për rreshtat e gjallë.
    const foods = (await store.all('foods')).filter((row) => row.source_id !== null && row.source_id !== undefined)
    const keys = foods.map((row) => `${row.source}|${row.source_id}`)
    expect(new Set(keys).size).toBe(keys.length)
    expect(foods.filter((row) => String(row.source_id).startsWith('ai:'))).toHaveLength(2)

    // water_logs.ml: smallint, 50–2 000.
    const water = (await store.where('water_logs', 'date', WEDNESDAY)).map((row) => Number(row.ml))
    expect(water.every((ml) => Number.isInteger(ml) && ml >= 50 && ml <= 2000)).toBe(true)
    expect(water.reduce((sum, ml) => sum + ml, 0)).toBe(3000 + 333 + 2010)

    // Dy lugë: supplement_logs.amount 2 dhe proteina e dy lugëve te vakti.
    expect(await store.where('supplement_logs', 'date', WEDNESDAY)).toEqual([expect.objectContaining({ supplement_id: wheyId, timing: 'snack_pm', amount: 2 })])
    const scoops = (await store.where('diary_entries', 'date', WEDNESDAY)).filter((row) => row.meal === 'snack_pm')
    expect(scoops.map((row) => [Number(row.grams), Number(row.protein_g)])).toEqual([[60, 48]])
  })
})

describe('përgjigja e funksionit', () => {
  const month = { month: '2026-12-01', spentEur: 0.12, limitEur: 10 }
  it('drafti me koston; gabimet me kodin e tyre; pa lidhje', async () => {
    const { boxResultFrom } = await import('./ai-box')
    expect(boxResultFrom(200, { draft: empty, usage: { costEur: 0.001 }, month })).toEqual({ ok: true, draft: empty, costEur: 0.001, month })
    expect(boxResultFrom(200, { draft: { foods: [] }, month })).toEqual({
      ok: false,
      error: 'ai_failed',
    })
    // Drafti i 0.22 pa setet dhe përgjigjen (funksioni i vjetër) nuk pranohet.
    expect(
      boxResultFrom(200, {
        draft: { foods: [], water: [], supplements: [], notUnderstood: [] },
        month,
      }),
    ).toEqual({ ok: false, error: 'ai_failed' })
    expect(boxResultFrom(429, { error: 'limit', month })).toEqual({
      ok: false,
      error: 'limit',
      month,
    })
    expect(boxResultFrom(401, null)).toEqual({
      ok: false,
      error: 'unauthorized',
    })
    expect(boxResultFrom(500, { error: 'tjetër' })).toEqual({
      ok: false,
      error: 'ai_failed',
    })
    expect(boxResultFrom(null, null)).toEqual({ ok: false, error: 'offline' })
  })
})
