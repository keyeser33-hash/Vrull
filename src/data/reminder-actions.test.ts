import { appliedLog, applyReminderActions } from './reminder-actions'
import { createDatabase } from './db'
import { nutritionDay } from './nutrition'
import { completeOnboarding } from './profile'
import { createLocalStore } from './store'
import { ensureSupplements, saveSupplement, supplementList } from './supplements'

// Butonat te rikujtuesit (V37, V2-E2-08) të zbatuar nga radha: e mërkurë 9 dhjetor 2026.
const USER = '11111111-1111-4111-8111-111111111111'
const DATE = '2026-12-09'

async function setup() {
  const store = createLocalStore(createDatabase(`reminder-actions-${crypto.randomUUID()}`), { userId: () => USER, now: () => new Date(`${DATE}T13:05:00`) })
  await completeOnboarding(store, { weightKg: 88, trainingDays: [1, 2, 4, 5], trainingTime: '21:00', wakeTime: '08:20', sleepTime: '01:00' }, () => new Date('2026-12-01T08:00:00'))
  await ensureSupplements(store)
  return store
}

describe('veprimet nga njoftimi', () => {
  it('"Hëngra si në plan" regjistron drekën dhe suplementet e saj, një herë; "Kthe mbrapsht" i heq', async () => {
    const store = await setup()
    const lunchSupplements = (await supplementList(store)).filter((item) => item.enabled && item.timing.includes('lunch')).map((item) => item.id)
    const applied = appliedLog()
    const ate = { id: 'a1', action: 'ate' as const, key: `meal|${DATE}|lunch`, data: { date: DATE, meal: 'lunch' as const, supplementIds: lunchSupplements } }
    expect(await applyReminderActions(store, [ate, ate], applied)).toEqual(['a1', 'a1'])
    const lunch = (await nutritionDay(store, DATE, store.now())).meals.find((meal) => meal.meal === 'lunch')!
    expect(lunch.entries.length).toBe(lunch.template.length)
    expect(lunch.supplements.every((item) => item.taken)).toBe(true)

    await applyReminderActions(store, [{ id: 'u1', action: 'undo', key: ate.key, data: null, target: 'a1' }], applied)
    const after = (await nutritionDay(store, DATE, store.now())).meals.find((meal) => meal.meal === 'lunch')!
    expect(after.entries).toEqual([])
    expect(after.supplements.some((item) => item.taken)).toBe(false)
  })

  it('"Piva një gotë" shton 250 ml; "Po, sot" e bën ditën stërvitje', async () => {
    const store = await setup()
    await applyReminderActions(
      store,
      [
        { id: 'w1', action: 'drank', key: `water|${DATE}|`, data: { date: DATE, ml: 250 } },
        { id: 'y1', action: 'yes', key: `missed|${DATE}|`, data: { date: DATE } },
      ],
      appliedLog(),
    )
    expect((await store.where('water_logs', 'date', DATE)).map((row) => row.ml)).toEqual([250])
    expect((await nutritionDay(store, DATE, store.now())).dayType).toBe('training')
  })

  it('"Hëngra si në plan" me proteinën që numërohet te ushqimi: pluhuri një herë, me makrot e saj', async () => {
    const store = await setup()
    const id = await saveSupplement(store, {
      name: 'Whey',
      kind: 'protein',
      doseAmount: 1,
      doseUnit: 'scoop',
      scoopG: 30,
      timing: ['bedtime'],
      macros: { kcal: 120, proteinG: 24, carbsG: 3, fatG: 1.5 },
      countsAsFood: true,
    })
    const ate = { id: 'b1', action: 'ate' as const, key: `meal|${DATE}|bedtime`, data: { date: DATE, meal: 'bedtime' as const, supplementIds: [id] } }
    await applyReminderActions(store, [ate], appliedLog())
    const bedtime = (await nutritionDay(store, DATE, store.now())).meals.find((meal) => meal.meal === 'bedtime')!
    expect(bedtime.entries.filter((entry) => /proteine|whey/i.test(entry.name ?? ''))).toEqual([expect.objectContaining({ name: 'Whey', proteinG: 24 })])
    expect(bedtime.entries).toHaveLength(bedtime.template.length)
  })

  it('"E mora" te app-i nuk e bën vaktin të regjistruar: "Hëngra si në plan" regjistron pjesën tjetër', async () => {
    const store = await setup()
    const id = await saveSupplement(store, { name: 'Whey', kind: 'protein', doseAmount: 1, doseUnit: 'scoop', scoopG: 30, timing: ['bedtime'], macros: { kcal: 120, proteinG: 24, carbsG: 3, fatG: 1.5 }, countsAsFood: true })
    const { toggleSupplement } = await import('./supplements')
    await toggleSupplement(store, { date: DATE, supplementId: id, meal: 'bedtime' })
    await applyReminderActions(store, [{ id: 'b2', action: 'ate', key: `meal|${DATE}|bedtime`, data: { date: DATE, meal: 'bedtime', supplementIds: [id] } }], appliedLog())
    const bedtime = (await nutritionDay(store, DATE, store.now())).meals.find((meal) => meal.meal === 'bedtime')!
    expect(bedtime.entries).toHaveLength(bedtime.template.length)
    expect(bedtime.entries.filter((entry) => /proteine|whey/i.test(entry.name ?? ''))).toHaveLength(1)
  })

  it('dy zbatime njëkohësisht (dëgjuesi dhe plani) nuk e zbatojnë një prekje dy herë', async () => {
    const store = await setup()
    const applied = appliedLog()
    const water = { id: 'w1', action: 'drank' as const, key: `water|${DATE}|`, data: { date: DATE, ml: 250 } }
    const second = { ...water, id: 'w2' }
    await Promise.all([applyReminderActions(store, [water], applied), applyReminderActions(store, [water, second], applied)])
    expect((await store.where('water_logs', 'date', DATE)).map((row) => row.ml)).toEqual([250, 250])
  })

  it('vakti i regjistruar ndërkohë te app-i nuk regjistrohet dy herë', async () => {
    const store = await setup()
    await store.put('diary_entries', { date: DATE, meal: 'lunch', kcal: 500, protein_g: 30, carbs_g: 50, fat_g: 10, logged_at: `${DATE}T12:00:00.000Z` })
    await applyReminderActions(store, [{ id: 'a2', action: 'ate', key: `meal|${DATE}|lunch`, data: { date: DATE, meal: 'lunch' } }], appliedLog())
    expect((await store.where('diary_entries', 'date', DATE)).filter((row) => row.meal === 'lunch')).toHaveLength(1)
  })

  it('regjistri i veprimeve mbetet pas rinisjes (ruajtja e telefonit)', () => {
    const data = new Map<string, string>()
    const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value) }
    appliedLog(storage).set('a1', { diary: ['d1'], supplements: [], water: [] })
    expect(appliedLog(storage).get('a1')).toEqual({ diary: ['d1'], supplements: [], water: [] })
  })
})
