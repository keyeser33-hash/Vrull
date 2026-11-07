import { createDatabase } from './db'
import { nutritionDay } from './nutrition'
import { completeOnboarding } from './profile'
import { createLocalStore } from './store'
import { ensureSupplements, setSupplementEnabled, supplementList, toggleSupplement } from './supplements'

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
    expect(list.find((item) => item.name === 'Kreatinë')).toMatchObject({ doseText: '1,5–5 g', evidenceText: 'E fortë', enabled: true })
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
