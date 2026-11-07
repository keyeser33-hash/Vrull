import { createDatabase } from './db'
import { completeOnboarding } from './profile'
import { reminderInput, reminderSettings, setMeasurementDay, setReminderToggle } from './reminders'
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
    expect(await reminderSettings(store)).toEqual({ toggles: { meals: true, supplements: true, training: true, measurements: true }, measurementDay: 7 })
    await setReminderToggle(store, 'meals', false)
    await setMeasurementDay(store, 1)
    expect(await reminderSettings(store)).toEqual({ toggles: { meals: false, supplements: true, training: true, measurements: true }, measurementDay: 1 })
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
      nextWorkoutLabel: 'Java 0 · Stërvitja 1',
      dayTypes: { '2026-12-09': 'training' },
    })
    expect(input.supplements).toHaveLength(10)
  })
})
