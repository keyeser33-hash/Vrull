import { bodyView } from './body'
import { createDatabase } from './db'
import { completeOnboarding } from './profile'
import { createLocalStore } from './store'
import { loadLibrary } from '@/program/library'
import { exerciseFromLibrary, finishWorkout, saveSet, startWorkout, trainingSnapshot } from './training'

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
    // Bench Press: kryesor te gjoksi i mesëm, ndihmës te gjoksi i sipërm; pectoralis minor pa sete.
    expect(chest.parts).toEqual([
      { key: 'pectoralis_major_clavicular', load: 1.5 },
      { key: 'pectoralis_major_sternocostal', load: 3 },
      { key: 'pectoralis_minor', load: 0 },
    ])
    expect(after.find((entry) => entry.group.id === 'tricepsi')!.parts).toEqual([{ key: 'triceps_brachii', load: 1.5 }])
    expect(after.find((entry) => entry.group.id === 'pulpat')).toMatchObject({ load: 0, recovery: 'gati' })
    expect(chest.unsplit).toBe(0)
  })

  it('një ushtrim nga biblioteka di vetëm grupin: setet hyjnë te grupi, jo te pjesët', async () => {
    let clock = Date.parse('2026-12-07T18:00:00')
    const store = createLocalStore(createDatabase(`body-${crypto.randomUUID()}`), { userId: () => USER, now: () => new Date((clock += 60_000)) })
    await completeOnboarding(store, { weightKg: 80, trainingDays: [1, 2, 4, 5], trainingTime: '18:00', wakeTime: '07:00', sleepTime: '23:00' }, () => new Date('2026-12-01T08:00:00'))
    const library = await loadLibrary()
    const arnold = await exerciseFromLibrary(store, library.find((exercise) => exercise.name === 'Arnold Dumbbell Press')!)
    const sessionId = await startWorkout(store)
    const [bench] = (await trainingSnapshot(store))!.plan.slots
    for (let number = 1; number <= 4; number++) await saveSet(store, { sessionId, slot: { ...bench, exerciseId: arnold }, setNumber: number, weightKg: 8, reps: 15 })
    await finishWorkout(store, sessionId)

    const shoulders = (await bodyView(store, new Date('2026-12-08T12:00:00'))).find((entry) => entry.group.id === 'shpatullat')!
    expect(shoulders).toMatchObject({ load: 4, unsplit: 4 })
    // Biblioteka thotë "shoulders": nuk dihet cila kokë e deltoidit, ndaj asnjë pjesë nuk merr 4 sete.
    expect(shoulders.parts.map((part) => part.load)).toEqual([0, 0, 0])
  })
})
