import { bodyView, layersView, shapeView } from './body'
import { saveMeasurement } from './progress'
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

describe('shtresat dhe trupi sipas matjeve', () => {
  async function started() {
    let clock = Date.parse('2026-10-25T17:00:00')
    const store = createLocalStore(createDatabase(`body-${crypto.randomUUID()}`), { userId: () => USER, now: () => new Date((clock += 60_000)) })
    await completeOnboarding(store, { weightKg: 80, trainingDays: [0, 1, 2, 4], trainingTime: '17:00', wakeTime: '07:00', sleepTime: '23:00' }, () => new Date('2026-10-25T08:00:00'))
    return store
  }

  it('Shtresat: ku punon muskuli i thellë te java e programit dhe setet e tij këtë javë', async () => {
    const store = await started()
    const before = await layersView(store, new Date('2026-10-25T16:00:00'))
    // Java 0 · Stërvitja 1 (gjoks, triceps, pulpa): pectoralis minor ndihmës te Cable Crossover.
    expect(before.find((entry) => entry.id === 'pectoralis_minor')).toMatchObject({ load: 0, roles: { primary: [], secondary: ['Cable Crossover'] } })
    expect(before.find((entry) => entry.id === 'soleus')!.roles.primary).toContain('Seated Calf Raise')
    expect(before.map((entry) => entry.id)).toHaveLength(9)

    const sessionId = await startWorkout(store)
    const snapshot = (await trainingSnapshot(store))!
    const crossover = snapshot.plan.slots.find((slot) => snapshot.exercises[slot.exerciseId]?.name === 'Cable Crossover')!
    for (let number = 1; number <= 3; number++) await saveSet(store, { sessionId, slot: crossover, setNumber: number, weightKg: 15, reps: 10 })
    const after = await layersView(store, new Date('2026-10-25T19:00:00'))
    expect(after.find((entry) => entry.id === 'pectoralis_minor')!.load).toBe(1.5)
  })

  it('sipas matjeve: Java 0 nga nisja e programit; matja e re ndryshon trupin', async () => {
    const store = await started()
    expect(await shapeView(store)).toMatchObject({ comparison: null, start: null, scales: {} })
    await saveMeasurement(store, '2026-10-25', { weight_kg: 80, arm_right_cm: 34, chest_cm: 98, waist_cm: 84.5, thigh_right_cm: 56 })
    await startWorkout(store)
    await saveMeasurement(store, '2026-11-01', { arm_right_cm: 34.4, chest_cm: 98.6, waist_cm: 84, thigh_right_cm: 56.3 })
    const view = await shapeView(store)
    expect(view.start).toBe('2026-10-25')
    expect(view.startLabel).toBe('Java 0')
    expect(view.comparison!.changes.map((change) => [change.id, change.delta])).toEqual([
      ['arm', 0.4],
      ['chest', 0.6],
      ['waist', -0.5],
      ['thigh', 0.3],
    ])
    expect(view.scales.chest).toBeCloseTo(98.6 / 98, 6)

    // Matja e re: krahasimi dhe forma e modelit ndjekin vlerat e fundit.
    await saveMeasurement(store, '2026-11-08', { chest_cm: 99.4 })
    const next = await shapeView(store)
    expect(next.comparison!.to).toBe('2026-11-08')
    expect(next.comparison!.changes.find((change) => change.id === 'chest')!.delta).toBe(1.4)
    expect(next.scales.chest).toBeCloseTo(99.4 / 98, 6)
    expect(next.scales.arm).toBeCloseTo(34.4 / 34, 6)
  })
})

