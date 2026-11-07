import { bodyView } from './body'
import { createDatabase } from './db'
import { completeOnboarding } from './profile'
import { createLocalStore } from './store'
import { finishWorkout, saveSet, startWorkout, trainingSnapshot } from './training'

const USER = '11111111-1111-4111-8111-111111111111'

describe('trupi pas një seance', () => {
  it('harta dhe rikuperimi ndryshojnë: gjoksi i lodhur me setet e javës; pulpat gati pa sete', async () => {
    let clock = Date.parse('2026-12-07T18:00:00')
    const store = createLocalStore(createDatabase(`body-${crypto.randomUUID()}`), { userId: () => USER, now: () => new Date((clock += 60_000)) })
    await completeOnboarding(store, { weightKg: 80, trainingDays: [1, 2, 4, 5], trainingTime: '18:00', wakeTime: '07:00', sleepTime: '23:00' }, () => new Date('2026-12-01T08:00:00'))
    const before = await bodyView(store, new Date('2026-12-07T17:00:00'))
    expect(before.find((entry) => entry.group.id === 'gjoksi')).toMatchObject({ load: 0, level: 0, recovery: 'gati' })

    const sessionId = await startWorkout(store)
    const snapshot = (await trainingSnapshot(store))!
    const [bench] = snapshot.plan.slots
    for (let number = 1; number <= 3; number++) await saveSet(store, { sessionId, slot: bench, setNumber: number, weightKg: 60, reps: 12 })
    await finishWorkout(store, sessionId)

    const after = await bodyView(store, new Date('2026-12-08T12:00:00'))
    const chest = after.find((entry) => entry.group.id === 'gjoksi')!
    expect(chest).toMatchObject({ load: 3, level: 1, recovery: 'i_lodhur', latin: 'Pectoralis major et minor' })
    expect(chest.hours).toBeGreaterThan(16)
    expect(after.find((entry) => entry.group.id === 'pulpat')).toMatchObject({ load: 0, recovery: 'gati' })
  })
})
