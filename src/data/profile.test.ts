import { createDatabase } from './db'
import {
  completeOnboarding,
  DEFAULT_PROFILE,
  isTime,
  localDate,
  nextWorkout,
  parseWeight,
  readProfile,
  updateProfile,
} from './profile'
import { createLocalStore } from './store'

const USER = '11111111-1111-4111-8111-111111111111'

function setup() {
  const db = createDatabase(`profile-${crypto.randomUUID()}`)
  let clock = new Date(2026, 10, 30, 21, 45)
  const store = createLocalStore(db, { userId: () => USER, now: () => clock })
  return { db, store, now: () => clock, setNow: (date: Date) => (clock = date) }
}

const input = {
  weightKg: 80.5,
  trainingDays: [1, 2, 4, 5],
  trainingTime: '18:00',
  wakeTime: '07:00',
  sleepTime: '23:00',
}

describe('vlerat e profilit', () => {
  it('data lokale e telefonit, jo ajo UTC', () => {
    expect(localDate(new Date(2026, 10, 30, 23, 59))).toBe('2026-11-30')
    expect(localDate(new Date(2026, 0, 5, 0, 1))).toBe('2026-01-05')
  })

  it('pesha pranon presje ose pikë dhe kufij të arsyeshëm', () => {
    expect(parseWeight('80')).toBe(80)
    expect(parseWeight(' 80,5 ')).toBe(80.5)
    expect(parseWeight('80.25')).toBe(80.25)
    expect(parseWeight('')).toBeNull()
    expect(parseWeight('abc')).toBeNull()
    expect(parseWeight('29.9')).toBeNull()
    expect(parseWeight('301')).toBeNull()
  })

  it('ora në formatin 24 orësh', () => {
    expect(isTime('07:00')).toBe(true)
    expect(isTime('23:59')).toBe(true)
    expect(isTime('24:00')).toBe(false)
    expect(isTime('7:00')).toBe(false)
  })

  it('parazgjedhjet e SPEC: e hënë, e martë, e enjte, e premte', () => {
    expect(DEFAULT_PROFILE.trainingDays).toEqual([1, 2, 4, 5])
  })
})

describe('hyrja e parë', () => {
  it('ruan profilin, peshën e sotme dhe programin aktiv, me radhën Java 0 · Stërvitja 1', async () => {
    const { store, now } = setup()
    await completeOnboarding(store, input, now)

    const [settings] = await store.all('user_settings')
    expect(settings).toMatchObject({
      training_days: [1, 2, 4, 5],
      training_times: { 1: '18:00', 2: '18:00', 4: '18:00', 5: '18:00' },
      wake_time: '07:00',
      sleep_time: '23:00',
      onboarded_at: now().toISOString(),
    })

    expect(await store.all('body_measurements')).toEqual([
      expect.objectContaining({ date: '2026-11-30', weight_kg: 80.5 }),
    ])

    const [program] = await store.all('programs')
    expect(program).toMatchObject({ name: 'Shortcut to Size', source: 'shortcut_to_size' })
    expect(settings.active_program_id).toBe(program.id)

    const blocks = (await store.where('program_blocks', 'program_id', program.id)).sort((a, b) => Number(a.position) - Number(b.position))
    expect(blocks.map((block) => [block.name, block.weeks])).toEqual([
      ['Java 0', 1],
      ['Faza 1', 4],
      ['Faza 2', 4],
      ['Faza 3', 4],
    ])
    const days = (await store.where('program_days', 'program_id', program.id)).sort((a, b) => Number(a.position) - Number(b.position))
    expect(days.map((day) => day.name)).toEqual([
      'Gjoks, triceps, pulpa',
      'Shpinë, biceps, bark',
      'Shpatulla, trapez, pulpa',
      'Këmbë, bark',
    ])

    expect(await nextWorkout(store)).toEqual({ label: 'Java 0 · Stërvitja 1', dayName: 'Gjoks, triceps, pulpa' })
  })

  it('e përsëritur nuk dyfishon programin, cilësimet as peshën e ditës', async () => {
    const { store, now } = setup()
    await completeOnboarding(store, input, now)
    await completeOnboarding(store, { ...input, weightKg: 81 }, now)

    expect(await store.all('programs')).toHaveLength(1)
    expect(await store.all('program_state')).toHaveLength(1)
    expect(await store.all('user_settings')).toHaveLength(1)
    expect(await store.all('body_measurements')).toEqual([expect.objectContaining({ weight_kg: 81 })])
  })

  it('pa program aktiv, nuk ka stërvitje të radhës', async () => {
    const { store } = setup()
    expect(await nextWorkout(store)).toBeNull()
  })
})

describe('profili te cilësimet', () => {
  it('lexon vlerat e ruajtura dhe peshën e fundit', async () => {
    const { store, now, setNow } = setup()
    await completeOnboarding(store, input, now)
    setNow(new Date(2026, 11, 2, 8, 0))
    await store.put('body_measurements', { date: '2026-12-02', weight_kg: 79.8 })

    expect(await readProfile(store)).toEqual({
      weightKg: 79.8,
      trainingDays: [1, 2, 4, 5],
      trainingTime: '18:00',
      wakeTime: '07:00',
      sleepTime: '23:00',
    })
  })

  it('ndryshimi i ditëve mban orën; ndryshimi i orës vlen për çdo ditë', async () => {
    const { store, now } = setup()
    await completeOnboarding(store, input, now)

    await updateProfile(store, { trainingDays: [1, 3, 5, 6] }, now)
    let [settings] = await store.all('user_settings')
    expect(settings.training_times).toEqual({ 1: '18:00', 3: '18:00', 5: '18:00', 6: '18:00' })

    await updateProfile(store, { trainingTime: '07:30', wakeTime: '06:15' }, now)
    ;[settings] = await store.all('user_settings')
    expect(settings).toMatchObject({
      training_days: [1, 3, 5, 6],
      training_times: { 1: '07:30', 3: '07:30', 5: '07:30', 6: '07:30' },
      wake_time: '06:15',
    })
  })

  it('pesha e ndryshuar te cilësimet shkon te matja e sotme', async () => {
    const { store, now } = setup()
    await completeOnboarding(store, input, now)
    await updateProfile(store, { weightKg: 80 }, now)
    expect(await store.all('body_measurements')).toEqual([expect.objectContaining({ date: '2026-11-30', weight_kg: 80 })])
  })
})
