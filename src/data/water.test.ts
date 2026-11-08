import { waterTargetMl } from '@/nutrition/water'
import { createDatabase } from './db'
import { completeOnboarding } from './profile'
import { createLocalStore } from './store'
import { addWater, undoWater, waterDay } from './water'

// Uji (V36, V2-E2-07): një gotë = 250 ml; objektivi 35 ml/kg, i rrumbullakosur në 0,25 L, +0,5 L
// në ditët e stërvitjes.
const USER = '11111111-1111-4111-8111-111111111111'
const at = (date: string, time: string) => new Date(`${date}T${time}:00`)

describe('objektivi i ujit', () => {
  it('35 ml/kg në 0,25 L, +0,5 L në ditët e stërvitjes', () => {
    expect(waterTargetMl(88, 'rest')).toBe(3000)
    expect(waterTargetMl(88, 'training')).toBe(3500)
    expect(waterTargetMl(80, 'rest')).toBe(2750)
    expect(waterTargetMl(60, 'training')).toBe(2500)
  })
})

describe('uji i ditës', () => {
  async function setup() {
    const store = createLocalStore(createDatabase(`water-${crypto.randomUUID()}`), { userId: () => USER, now: () => at('2026-12-07', '10:00') })
    await completeOnboarding(store, { weightKg: 88, trainingDays: [1, 2, 4, 5], trainingTime: '21:00', wakeTime: '08:20', sleepTime: '01:00' }, () =>
      at('2026-12-01', '08:00'),
    )
    return store
  }

  it('gotat mblidhen, objektivi ndjek llojin e ditës', async () => {
    const store = await setup()
    expect(await waterDay(store, '2026-12-07')).toEqual({ date: '2026-12-07', totalMl: 0, targetMl: 3500, lastId: null })
    await addWater(store, '2026-12-07', at('2026-12-07', '09:00'))
    const second = await addWater(store, '2026-12-07', at('2026-12-07', '11:00'))
    expect(await waterDay(store, '2026-12-07')).toEqual({ date: '2026-12-07', totalMl: 500, targetMl: 3500, lastId: second })
    expect((await waterDay(store, '2026-12-09')).targetMl).toBe(3000)
  })

  it('"Kthe mbrapsht" heq gotën e fundit', async () => {
    const store = await setup()
    const first = await addWater(store, '2026-12-07', at('2026-12-07', '09:00'))
    const second = await addWater(store, '2026-12-07', at('2026-12-07', '11:00'))
    await undoWater(store, second)
    expect(await waterDay(store, '2026-12-07')).toMatchObject({ totalMl: 250, lastId: first })
  })

  it('pa peshë, pa objektiv', async () => {
    const store = createLocalStore(createDatabase(`water-${crypto.randomUUID()}`), { userId: () => USER })
    expect((await waterDay(store, '2026-12-07')).targetMl).toBeNull()
  })
})
