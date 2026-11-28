import { createDatabase } from './db'
import { logFood } from './nutrition'
import { completeOnboarding } from './profile'
import { createLocalStore } from './store'
import { weekNow } from './week-now'

// "Kjo javë" te Progresi (V83). E mërkurë 09.12.2026: java nis të hënën 07.12.
const USER = '11111111-1111-4111-8111-111111111111'
const NOW = new Date(2026, 11, 9, 20, 0)

describe('kjo javë', () => {
  it('pa asgjë: asnjë ditë proteine, dhe mungon gjithçka për Javën e plotë', async () => {
    const store = createLocalStore(createDatabase(`week-now-${crypto.randomUUID()}`), { userId: () => USER, now: () => NOW })
    await completeOnboarding(store, { weightKg: 80, trainingDays: [1, 2, 4, 5], trainingTime: '18:00', wakeTime: '07:00', sleepTime: '23:00' }, () => new Date(2026, 11, 1, 8, 0))
    const week = await weekNow(store)
    expect(week).toMatchObject({ monday: '2026-12-07', training: { done: 0, target: 4 }, proteinDays: 0, complete: false })
    expect(week.left).toEqual({ training: 4, food: 5, water: 5 })
  })

  it('një ditë me 90% të proteinës numërohet; një ditë me pak jo', async () => {
    const store = createLocalStore(createDatabase(`week-now-${crypto.randomUUID()}`), { userId: () => USER, now: () => NOW })
    await completeOnboarding(store, { weightKg: 80, trainingDays: [1, 2, 4, 5], trainingTime: '18:00', wakeTime: '07:00', sleepTime: '23:00' }, () => new Date(2026, 11, 1, 8, 0))
    const { nutritionDay } = await import('./nutrition')
    // Ushqim me 100 g proteinë për 100 g: gramët janë proteina. Objektivat e ditës ruhen me regjistrimin e parë.
    const food = await store.put('foods', { source: 'custom', source_id: null, name: 'Proteinë e pastër', kcal: 400, protein_g: 100, carbs_g: 0, fat_g: 0 })
    await logFood(store, { date: '2026-12-08', meal: 'lunch', foodId: food.id, grams: 1 })
    const target = (await nutritionDay(store, '2026-12-08', NOW)).targets!.proteinG
    await logFood(store, { date: '2026-12-08', meal: 'dinner', foodId: food.id, grams: Math.ceil(target * 0.9) })
    await logFood(store, { date: '2026-12-09', meal: 'lunch', foodId: food.id, grams: Math.floor(target * 0.5) })
    expect((await weekNow(store)).proteinDays).toBe(1)
  })
})
