import { createDatabase } from './db'
import { type CheckInAnswers, checkInSkipped, dailyChoiceId, dailyStateId, dailyStates, followDayState, normalizeCheckIn, readDailyChoice, readDailyState, readinessOfState, saveDailyState, setFollowDayState, setReadinessChoice, skipCheckIn } from './daily-state'
import { createLocalStore } from './store'

// Gjendja e ditës (V50, V2-E3-03; SPEC §0.3d): një rresht për ditë ushqimi, me id nga (përdoruesi, data), kufijtë e
// migrimit 20261110080000_daily_states.sql para shkrimit, dhe vendimi i sugjerimit që mbetet kur check-in-i ndryshon.
const USER = '11111111-1111-4111-8111-111111111111'
const DAY = '2026-11-19'
const CHECK_IN: CheckInAnswers = { mood: 3, energy: 2, sleepMinutes: 360, sleepQuality: 3, soreness: 2, soreGroups: ['chest'] }

const storeFor = (name = `daily-${crypto.randomUUID()}`, userId: string | null = USER) =>
  createLocalStore(createDatabase(name), { userId: () => userId, now: () => new Date(`${DAY}T07:40:00`) })

describe('gjendja e ditës', () => {
  it('ruhet një herë për ditë, me id nga përdoruesi dhe data', async () => {
    const store = storeFor()
    await saveDailyState(store, DAY, CHECK_IN)
    await saveDailyState(store, DAY, { ...CHECK_IN, energy: 4 })
    const rows = await store.where('daily_states', 'date', DAY)
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe(await dailyStateId(USER, DAY))
    expect(await readDailyState(store, DAY)).toEqual({ date: DAY, ...CHECK_IN, soreGroups: ['chest'], energy: 4, readiness: expect.any(Number), recovery: null, soreTrained: false })
  })

  it('dy telefona shkruajnë të njëjtin rresht', async () => {
    const first = storeFor()
    const second = storeFor()
    const [a, b] = await Promise.all([saveDailyState(first, DAY, CHECK_IN), saveDailyState(second, DAY, CHECK_IN)])
    expect((await first.where('daily_states', 'date', DAY))[0].id).toBe((await second.where('daily_states', 'date', DAY))[0].id)
    expect(a).toEqual(b)
  })

  it('vendimi është rresht më vete, me id nga përdoruesi dhe data, dhe mbetet kur check-in-i ndryshon', async () => {
    const store = storeFor()
    await saveDailyState(store, DAY, CHECK_IN)
    await setReadinessChoice(store, DAY, 'lighter', { workout: 'b|1|d' })
    await saveDailyState(store, DAY, { ...CHECK_IN, mood: 4 })
    expect(await readDailyChoice(store, DAY)).toEqual({ date: DAY, choice: 'lighter', workout: 'b|1|d', prevToday: null, prevTomorrow: null })
    expect((await store.where('daily_choices', 'date', DAY))[0].id).toBe(await dailyChoiceId(USER, DAY))
  })

  it('fshirja e vendimit e heq rreshtin, dhe një vendim i ri e kthen me të njëjtin id', async () => {
    const store = storeFor()
    await setReadinessChoice(store, DAY, 'tomorrow', { workout: 'b|1|d', prevToday: 'training', prevTomorrow: null })
    const id = (await store.where('daily_choices', 'date', DAY))[0].id
    await setReadinessChoice(store, DAY, null)
    expect(await readDailyChoice(store, DAY)).toBeNull()
    expect((await store.get('daily_choices', id, { deleted: true }))?.deleted_at).not.toBeNull()
    await setReadinessChoice(store, DAY, 'normal')
    expect((await store.where('daily_choices', 'date', DAY))[0].id).toBe(id)
    expect(await readDailyChoice(store, DAY)).toMatchObject({ choice: 'normal', prevToday: null })
  })

  it('gatishmëria ruhet e llogaritur nga rreshti, brenda 0–100', async () => {
    const store = storeFor()
    const base = await saveDailyState(store, DAY, CHECK_IN)
    const trained = await saveDailyState(store, DAY, CHECK_IN, { recovery: 'i_lodhur', soreTrained: true })
    expect(base.readiness).toBeGreaterThanOrEqual(0)
    expect(trained).toMatchObject({ recovery: 'i_lodhur', soreTrained: true })
    expect(trained.readiness).toBeLessThan(100)
    expect(trained.readiness).toBe(readinessOfState(trained).percent)
  })

  it('vendimi mund të ruhet pa check-in', async () => {
    const store = storeFor()
    await setReadinessChoice(store, DAY, 'normal')
    expect(await readDailyState(store, DAY)).toBeNull()
    expect((await readDailyChoice(store, DAY))?.choice).toBe('normal')
  })

  it('një rresht i fshirë kthehet me check-in-in e ri', async () => {
    const store = storeFor()
    await saveDailyState(store, DAY, CHECK_IN)
    const id = await dailyStateId(USER, DAY)
    await store.remove('daily_states', id)
    expect(await readDailyState(store, DAY)).toBeNull()
    await saveDailyState(store, DAY, CHECK_IN)
    expect((await readDailyState(store, DAY))?.mood).toBe(3)
  })

  it('vlerat jashtë kufijve të serverit përshtaten para shkrimit', () => {
    expect(normalizeCheckIn({ mood: 9, energy: 0, sleepMinutes: 1000, sleepQuality: 2.6, soreness: 7, soreGroups: ['chest', 'chest', 'Back!', ...Array.from({ length: 20 }, (_, i) => `g${i}`)] } as never)).toEqual({
      mood: 5,
      energy: 1,
      sleepMinutes: 840,
      sleepQuality: 3,
      soreness: 4,
      soreGroups: ['chest', ...Array.from({ length: 14 }, (_, i) => `g${i}`)],
    })
    // Gjumi me hap 0,5 orë (SPEC §0.3d); pa dhimbje, pa grupe.
    expect(normalizeCheckIn({ ...CHECK_IN, sleepMinutes: 410, soreness: 0 })).toMatchObject({ sleepMinutes: 420, soreGroups: [] })
    expect(normalizeCheckIn({ ...CHECK_IN, sleepMinutes: -5 })).toMatchObject({ sleepMinutes: 0 })
  })

  it('ditët e kërkuara lexohen bashkë', async () => {
    const store = storeFor()
    await saveDailyState(store, DAY, CHECK_IN)
    await saveDailyState(store, '2026-11-17', { ...CHECK_IN, mood: 5 })
    const states = await dailyStates(store, ['2026-11-17', '2026-11-18', DAY])
    expect([...states.keys()].sort()).toEqual(['2026-11-17', DAY])
    expect(states.get('2026-11-17')?.mood).toBe(5)
  })

  it('"Jo sot" te karta dhe "Pamja ndjek gjendjen" mbeten vetëm në telefon', async () => {
    const store = storeFor()
    expect(await checkInSkipped(store, DAY)).toBe(false)
    await skipCheckIn(store, DAY)
    expect(await checkInSkipped(store, DAY)).toBe(true)
    expect(await checkInSkipped(store, '2026-11-20')).toBe(false)
    expect(await followDayState(store)).toBe(true)
    await setFollowDayState(store, false)
    expect(await followDayState(store)).toBe(false)
    expect(await store.all('daily_states')).toHaveLength(0)
  })
})
