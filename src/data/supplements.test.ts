import { createDatabase } from './db'
import { nutritionDay } from './nutrition'
import { completeOnboarding } from './profile'
import { createLocalStore } from './store'
import { ensureSupplements, removeSupplement, saveSupplement, setSupplementEnabled, supplementList, toggleSupplement } from './supplements'

const USER = '11111111-1111-4111-8111-111111111111'
const WEDNESDAY = '2026-12-09'
const NOON = new Date('2026-12-09T12:00:00')

async function setup() {
  const store = createLocalStore(createDatabase(`supplements-${crypto.randomUUID()}`), { userId: () => USER })
  await completeOnboarding(store, { weightKg: 80, trainingDays: [1, 2, 4, 5], trainingTime: '18:00', wakeTime: '07:00', sleepTime: '23:00' }, () => new Date('2026-12-01T08:00:00'))
  await ensureSupplements(store)
  return store
}

const names = (day: Awaited<ReturnType<typeof nutritionDay>>, meal: string) =>
  day.meals.find((slot) => slot.meal === meal)!.supplements.map((item) => `${item.name}${item.taken ? ' ✓' : ''}`)

describe('suplementet e ditës', () => {
  it('lista e §10 shtohet një herë, me dozën dhe evidencën', async () => {
    const store = await setup()
    await ensureSupplements(store)
    const list = await supplementList(store)
    expect(list).toHaveLength(10)
    expect(list.find((item) => item.name === 'Kreatinë')).toMatchObject({ doseText: '1,5–5 g', evidence: 'strong', enabled: true })
  })

  it('suplementet dalin te vakti i tyre; një prekje i shënon të marra dhe një tjetër e heq', async () => {
    const store = await setup()
    let day = await nutritionDay(store, WEDNESDAY, NOON)
    expect(names(day, 'lunch')).toEqual(['Multivitaminë'])
    expect(names(day, 'bedtime')).toEqual(['Pluhur proteine', 'ZMA'])
    const multivitamin = day.meals.find((slot) => slot.meal === 'lunch')!.supplements[0]
    await toggleSupplement(store, { date: WEDNESDAY, supplementId: multivitamin.id, meal: 'lunch' })
    day = await nutritionDay(store, WEDNESDAY, NOON)
    expect(names(day, 'lunch')).toEqual(['Multivitaminë ✓'])
    expect(await store.where('supplement_logs', 'date', WEDNESDAY)).toEqual([expect.objectContaining({ timing: 'lunch', supplement_id: multivitamin.id })])
    await toggleSupplement(store, { date: WEDNESDAY, supplementId: multivitamin.id, meal: 'lunch' })
    expect(names(await nutritionDay(store, WEDNESDAY, NOON), 'lunch')).toEqual(['Multivitaminë'])
  })

  it('ditë stërvitjeje: shake-u me kreatinën para dhe pas; i çaktivizuari nuk del', async () => {
    const store = await setup()
    const zma = (await supplementList(store)).find((item) => item.name === 'ZMA')!
    await setSupplementEnabled(store, zma.id, false)
    const day = await nutritionDay(store, '2026-12-07', NOON)
    expect(names(day, 'pre_workout')).toEqual(['Pluhur proteine', 'Kreatinë', 'Beta-alaninë', 'Betainë', 'BCAA'])
    expect(names(day, 'post_workout')).toContain('Glutaminë')
    expect(names(day, 'bedtime')).toEqual(['Pluhur proteine'])
  })
})

describe('suplementet e mia (V39)', () => {
  const WHEY = {
    name: 'Gold Standard 100% Whey',
    kind: 'protein' as const,
    doseAmount: 1,
    doseUnit: 'scoop' as const,
    scoopG: 30.4,
    timing: ['breakfast_1' as const, 'bedtime' as const],
    macros: { kcal: 120, proteinG: 24, carbsG: 3, fatG: 1.5 },
    countsAsFood: true,
  }

  it('shtohet me evidencën "E panjohur" dhe del te vaktet e tij', async () => {
    const store = await setup()
    const id = await saveSupplement(store, WHEY)
    const added = (await supplementList(store)).find((item) => item.id === id)
    expect(added).toMatchObject({ custom: true, evidence: 'unknown', kind: 'protein', scoopG: 30.4, macros: WHEY.macros, countsAsFood: true, doseText: '' })
    const day = await nutritionDay(store, WEDNESDAY, NOON)
    expect(names(day, 'bedtime')).toContain('Gold Standard 100% Whey')
  })

  it('"E mora" te proteina shton makrot te vakti një herë; heqja e shenjës i heq', async () => {
    const store = await setup()
    const id = await saveSupplement(store, WHEY)
    const take = () => toggleSupplement(store, { date: WEDNESDAY, supplementId: id, meal: 'breakfast_1' })
    await take()
    let breakfast = (await nutritionDay(store, WEDNESDAY, NOON)).meals.find((meal) => meal.meal === 'breakfast_1')!
    expect(breakfast.entries).toMatchObject([{ name: 'Gold Standard 100% Whey', grams: 30.4, kcal: 120, proteinG: 24, carbsG: 3, fatG: 1.5 }])
    await take()
    breakfast = (await nutritionDay(store, WEDNESDAY, NOON)).meals.find((meal) => meal.meal === 'breakfast_1')!
    expect(breakfast.entries).toEqual([])
    expect(breakfast.supplements.find((item) => item.id === id)?.taken).toBe(false)
  })

  it('pa "Numëroje te ushqimi": vetëm shenja; ndryshimi dhe heqja', async () => {
    const store = await setup()
    const id = await saveSupplement(store, { ...WHEY, countsAsFood: false })
    await toggleSupplement(store, { date: WEDNESDAY, supplementId: id, meal: 'bedtime' })
    expect((await nutritionDay(store, WEDNESDAY, NOON)).totals.kcal).toBe(0)
    await saveSupplement(store, { ...WHEY, name: 'Whey izolat', kind: 'protein', countsAsFood: true }, id)
    expect((await supplementList(store)).find((item) => item.id === id)).toMatchObject({ name: 'Whey izolat', countsAsFood: true })
    await removeSupplement(store, id)
    expect((await supplementList(store)).some((item) => item.id === id)).toBe(false)
  })
})
