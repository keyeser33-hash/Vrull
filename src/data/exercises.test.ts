import { bodyView } from './body'
import { createDatabase } from './db'
import { createExercise, exerciseCatalog, exerciseChoices, exerciseDetail, exerciseRowFor } from './exercises'
import { completeOnboarding } from './profile'
import { addSlotFromLibrary, programEditor, startProgram } from './program-editor'
import { createLocalStore } from './store'
import { finishWorkout, saveSet, startWorkout, switchProgram, trainingSnapshot } from './training'

// Biblioteka dhe "Krijo ushtrim" mbi bazën lokale (V2-E1-09). Pranimi: ushtrimi i krijuar përdoret në
// një program dhe numërohet te volumi javor (kryesori 1, ndihmësi 0,5; SPEC §11).

const USER = '11111111-1111-4111-8111-111111111111'
const profile = { weightKg: 80, trainingDays: [1, 2, 4, 5], trainingTime: '18:00', wakeTime: '07:00', sleepTime: '23:00' }

async function setup() {
  const clock = new Date(2026, 10, 9, 18, 0)
  const store = createLocalStore(createDatabase(`exercises-${crypto.randomUUID()}`), { userId: () => USER, now: () => clock })
  await completeOnboarding(store, profile, () => clock)
  return { store, clock }
}

const landmine = {
  name: '  Landmine Press ',
  equipment: 'barbell' as const,
  tracking: 'weight_reps' as const,
  primaryGroups: ['shpatullat'],
  secondaryGroups: ['gjoksi', 'tricepsi'],
  videoUrl: null,
}

describe('biblioteka në telefon', () => {
  it('free-exercise-db bashkë me ushtrimet e Shortcut to Size, pa dyfishim', async () => {
    const { store } = await setup()
    const { items, libraryCount } = await exerciseCatalog(store)
    expect(libraryCount).toBeGreaterThan(700)
    const bench = items.filter((item) => item.libraryId === 'Barbell_Bench_Press_-_Medium_Grip')
    expect(bench).toHaveLength(1)
    expect(bench[0]).toMatchObject({ name: 'Bench Press', own: false })
    expect(bench[0].exerciseId).toEqual(expect.any(String))
    // Ushtrim i PDF-së që mungon te biblioteka: në listë, jo "i yti".
    expect(items.find((item) => item.name === 'Standing Pulldown')).toMatchObject({ libraryId: null, own: false })
  })

  it('detajet e ushtrimit: me ID-në në telefon ose me ID-në e bibliotekës, me setet te programi aktiv', async () => {
    const { store } = await setup()
    const { items } = await exerciseCatalog(store)
    const bench = items.find((item) => item.name === 'Bench Press')!
    const detail = await exerciseDetail(store, bench.exerciseId!)
    expect(detail).toMatchObject({ name: 'Bench Press', tracking: 'weight_reps', videoUrl: null, programSets: { programName: 'Shortcut to Size', sets: 4 } })
    expect(await exerciseDetail(store, 'Barbell_Bench_Press_-_Medium_Grip')).toMatchObject({ exerciseId: bench.exerciseId })
    expect(await exerciseDetail(store, 'Arnold_Dumbbell_Press')).toMatchObject({ exerciseId: null, programSets: null, tracking: 'weight_reps' })
    expect(await exerciseDetail(store, 'nuk-ekziston')).toBeNull()
  })

  it('ushtrimi i bibliotekës merr një rresht në telefon vetëm kur duhet (p.sh. për videon), një herë', async () => {
    const { store } = await setup()
    const { items } = await exerciseCatalog(store)
    const arnold = items.find((item) => item.libraryId === 'Arnold_Dumbbell_Press')!
    const id = await exerciseRowFor(store, arnold)
    expect(await exerciseRowFor(store, arnold)).toBe(id)
    expect(await exerciseRowFor(store, (await exerciseCatalog(store)).items.find((item) => item.key === id)!)).toBe(id)
  })
})

describe('Krijo ushtrim', () => {
  it('ruhet me emrin, pajisjen, muskujt sipas grupeve dhe videon; del si "i yti"', async () => {
    const { store } = await setup()
    const id = await createExercise(store, { ...landmine, videoUrl: 'https://youtu.be/dQw4w9WgXcQ' })
    const row = await store.get('exercises', id)
    expect(row).toMatchObject({
      name: 'Landmine Press',
      library_id: null,
      equipment: 'barbell',
      tracking: 'weight_reps',
      primary_muscles: ['deltoid_anterior', 'deltoid_lateral', 'deltoid_posterior'],
      secondary_muscles: ['pectoralis_major_clavicular', 'pectoralis_major_sternocostal', 'pectoralis_minor', 'triceps_brachii'],
      video_url: 'https://youtu.be/dQw4w9WgXcQ',
    })
    const { items } = await exerciseCatalog(store)
    expect(items.find((item) => item.key === id)).toMatchObject({ name: 'Landmine Press', own: true })
  })

  it('refuzon emrin e zënë, emrin bosh dhe ushtrimin pa muskul kryesor', async () => {
    const { store } = await setup()
    await expect(createExercise(store, { ...landmine, name: 'bench press' })).rejects.toThrow('taken')
    await expect(createExercise(store, { ...landmine, name: 'Barbell Squat' })).rejects.toThrow('taken')
    await expect(createExercise(store, { ...landmine, name: ' ' })).rejects.toThrow('empty')
    await expect(createExercise(store, { ...landmine, primaryGroups: [] })).rejects.toThrow('primary')
    await createExercise(store, landmine)
    await expect(createExercise(store, { ...landmine, name: 'LANDMINE PRESS' })).rejects.toThrow('taken')
  })

  it('pranimi: përdoret në një program nga zgjedhja e editorit dhe numërohet te volumi javor', async () => {
    const { store, clock } = await setup()
    const id = await createExercise(store, landmine)
    // Zgjedhja e ushtrimit te editori (LibraryPicker) e ka edhe ushtrimin e përdoruesit.
    const choice = (await exerciseChoices(store)).find((item) => item.name === 'Landmine Press')!
    expect(choice).toMatchObject({ equipment: 'barbell', primary: ['shoulders'], secondary: ['chest', 'triceps'] })

    const programId = await startProgram(store, 'Sipër/poshtë')
    const [day] = (await programEditor(store, programId))!.days
    await addSlotFromLibrary(store, day.id, choice)
    const editor = (await programEditor(store, programId))!
    expect(editor.days[0].slots.map((slot) => slot.exerciseId)).toEqual([id])

    await switchProgram(store, programId)
    const sessionId = await startWorkout(store)
    const [slot] = (await trainingSnapshot(store))!.plan.slots
    expect(slot.exerciseId).toBe(id)
    await saveSet(store, { sessionId, slot, setNumber: 1, weightKg: 40, reps: 12 })
    await saveSet(store, { sessionId, slot, setNumber: 2, weightKg: 40, reps: 10 })
    await finishWorkout(store, sessionId)

    const load = Object.fromEntries((await bodyView(store, clock)).map((group) => [group.group.id, group.load]))
    expect(load).toMatchObject({ shpatullat: 2, gjoksi: 1, tricepsi: 1, shpina: 0 })
  })
})
