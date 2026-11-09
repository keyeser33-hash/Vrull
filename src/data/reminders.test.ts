import { createDatabase } from './db'
import { completeOnboarding } from './profile'
import { muteIgnored, muteReminders, reminderInput, reminderSettings, setMeasurementDay, setQuietHours, setReminderToggle, unmuteReminders } from './reminders'
import { createLocalStore } from './store'
import { ensureSupplements } from './supplements'

const USER = '11111111-1111-4111-8111-111111111111'

async function setup() {
  const store = createLocalStore(createDatabase(`reminders-${crypto.randomUUID()}`), { userId: () => USER })
  await completeOnboarding(store, { weightKg: 80, trainingDays: [1, 2, 4, 5], trainingTime: '18:00', wakeTime: '07:00', sleepTime: '23:00' }, () => new Date('2026-12-01T08:00:00'))
  await ensureSupplements(store)
  return store
}

describe('cilësimet e rikujtuesve', () => {
  it('parazgjedhja: të gjitha ndezur, matja të dielën; ndryshimet ruhen', async () => {
    const store = await setup()
    const empty = { quiet: null, muted: {}, resumed: {} }
    expect(await reminderSettings(store)).toEqual({ toggles: { meals: true, supplements: true, training: true, measurements: true, water: true }, measurementDay: 7, ...empty })
    await setReminderToggle(store, 'meals', false)
    await setMeasurementDay(store, 1)
    expect(await reminderSettings(store)).toEqual({ toggles: { meals: false, supplements: true, training: true, measurements: true, water: true }, measurementDay: 1, ...empty })
  })

  it('orët e qeta dhe heshtja (V37) ruhen te i njëjti jsonb pa prekur çelësat', async () => {
    const store = await setup()
    await setReminderToggle(store, 'water', false)
    await setQuietHours(store, { from: '12:30', to: '14:00' })
    await muteReminders(store, ['meal'], '2026-12-14')
    expect(await reminderSettings(store)).toMatchObject({ toggles: { water: false, meals: true }, quiet: { from: '12:30', to: '14:00' }, muted: { meal: '2026-12-14' } })
    await unmuteReminders(store, 'meal', '2026-12-15')
    await setQuietHours(store, null)
    expect(await reminderSettings(store)).toMatchObject({ toggles: { water: false }, quiet: null, muted: {}, resumed: { meal: '2026-12-15' } })
  })

  it('të dhënat e planit: oraret, stërvitja e radhës, suplementet dhe ditët e ndryshuara me dorë', async () => {
    const store = await setup()
    await store.put('nutrition_targets', { date: '2026-12-09', day_type: 'training', kcal: 3625, protein_g: 328, carbs_g: 333, fat_g: 108, is_manual: true })
    const input = await reminderInput(store, new Date('2026-12-09T06:00:00'))
    expect(input).toMatchObject({
      days: 7,
      wakeTime: '07:00',
      sleepTime: '23:00',
      trainingTime: '18:00',
      trainingDays: [1, 2, 4, 5],
      measurementDay: 7,
      nextWorkout: { blockName: 'Java 0', blockWeeks: 1, week: 1, run: 1, dayNumber: 1 },
      dayTypes: { '2026-12-09': 'training' },
    })
    expect(input.supplements).toHaveLength(10)
  })
})

describe('rikujtuesit e zgjuar: të dhënat', () => {
  it('të regjistruarat, objektivi i ujit sipas ditës dhe Plani im', async () => {
    const store = await setup()
    await store.put('diary_entries', { date: '2026-12-07', meal: 'lunch', kcal: 500, protein_g: 30, carbs_g: 50, fat_g: 10, logged_at: '2026-12-07T12:00:00.000Z' })
    await store.put('water_logs', { date: '2026-12-07', ml: 250, logged_at: '2026-12-07T09:00:00.000Z' })
    await store.put('water_logs', { date: '2026-12-07', ml: 250, logged_at: '2026-12-07T10:00:00.000Z' })
    const { smart } = await reminderInput(store, new Date('2026-12-07T13:00:00'))
    expect(smart).toMatchObject({ maxDaily: 4, quiet: null, muted: {} })
    expect(smart!.logged.meals).toEqual(['2026-12-07|lunch'])
    expect(smart!.logged.waterMl['2026-12-07']).toBe(500)
    // 80 kg: 2 750 ml, +500 në ditët e stërvitjes (e hëna dhe e marta; e mërkura pushim).
    expect([smart!.waterTargets['2026-12-07'], smart!.waterTargets['2026-12-09']]).toEqual([3250, 2750])
    expect(Object.keys(smart!.plan.training ?? {})).toContain('pre_workout')
    expect(smart!.plan.rest?.lunch?.items.length).toBeGreaterThan(0)
  })

  it('heshtja vetë: vaktet e injoruara 3 ditë rresht heshtin; një vakt i regjistruar e ndërpret', async () => {
    const store = await setup()
    const entry = (date: string, meal = 'lunch') => ({ key: `meal|${date}|${meal}`, kind: 'meal' as const, date, acted: false })
    const log = [entry('2026-12-11'), entry('2026-12-12'), entry('2026-12-13')]
    await store.put('diary_entries', { date: '2026-12-12', meal: 'lunch', kcal: 500, protein_g: 30, carbs_g: 50, fat_g: 10, logged_at: '2026-12-12T12:00:00.000Z' })
    expect(await muteIgnored(store, log, '2026-12-14')).toEqual([])
    expect(await muteIgnored(store, [...log, entry('2026-12-12', 'dinner')].filter((item) => item.key !== 'meal|2026-12-12|lunch'), '2026-12-14')).toEqual(['meal'])
    expect((await reminderSettings(store)).muted).toEqual({ meal: '2026-12-14' })
    // E heshtur një herë: nuk shkruhet sërish.
    expect(await muteIgnored(store, log.map((item) => ({ ...item, key: item.key.replace('lunch', 'dinner') })), '2026-12-14')).toEqual([])
  })
})
