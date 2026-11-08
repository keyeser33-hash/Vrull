import { createDatabase } from './db'
import {
  addDay,
  addSlot,
  copyDay,
  createBlankProgram,
  discardEmptyDrafts,
  createFromTemplate,
  programEditor,
  programList,
  reorderSlots,
  saveDraft,
  setProgramProgression,
  type TemplateNames,
} from './program-editor'
import { completeOnboarding } from './profile'
import { createLocalStore } from './store'
import { finishWorkout, saveSet, skipWorkout, startWorkout, switchProgram, trainingSnapshot } from './training'
import { weekWeightsView } from './week-weights'

// Ndërtuesi i programeve (V2-E1-10): shabllonet si kopje, drafti, progresi i zgjuar i programit,
// radha e ushtrimeve me tërheqje dhe pranimi: Sipër/poshtë 4 ditë ndërtohet, stërvitet dhe progreson.

const USER = '11111111-1111-4111-8111-111111111111'

function setup(start = '2026-11-09T16:00:00.000Z') {
  const clock = { now: new Date(start) }
  const store = createLocalStore(createDatabase(`builder-${crypto.randomUUID()}`), { userId: () => USER, now: () => clock.now })
  const later = (minutes: number) => {
    clock.now = new Date(clock.now.getTime() + minutes * 60_000)
  }
  return { store, later }
}

// Emrat e shablloneve në gjuhën e përdoruesit (në app vijnë nga katalogu, `builder.template.*`).
const NAMES: TemplateNames = {
  program: { full_body_3: 'Full body 3 ditë', upper_lower_4: 'Upper/Lower 4 ditë', shortcut_to_size: 'Shortcut to Size' },
  block: { base: 'Bazat', strength: 'Forca' },
  day: { upperA: 'Sipër A', lowerA: 'Poshtë A', upperB: 'Sipër B', lowerB: 'Poshtë B', fullA: 'Dita A', fullB: 'Dita B', fullC: 'Dita C' },
}
const BLANK = { program: 'Programi im', block: 'Blloku 1', day: 'Dita 1' }
const PROFILE = { weightKg: 80, trainingDays: [1, 2, 4, 5], trainingTime: '18:00', wakeTime: '07:00', sleepTime: '23:00' }

describe('ndërtuesi i programeve (V2-E1-10)', () => {
  it('shablloni Upper/Lower kopjohet si draft: emrat në gjuhën e përdoruesit, recetat dhe progresi i zgjuar', async () => {
    const { store } = setup()
    const programId = await createFromTemplate(store, 'upper_lower_4', NAMES)
    const view = await programEditor(store, programId)
    expect(view).toMatchObject({ name: 'Upper/Lower 4 ditë', draft: true, template: 'upper_lower_4', progression: { minRir: 2, incrementKg: 2.5 } })
    expect(view!.blocks.map((block) => [block.name, block.weeks])).toEqual([
      ['Bazat', 4],
      ['Forca', 4],
    ])
    expect(view!.days.map((day) => [day.name, day.slots.length])).toEqual([
      ['Sipër A', 6],
      ['Poshtë A', 5],
      ['Sipër B', 6],
      ['Poshtë B', 5],
    ])
    const [upperA] = view!.days
    expect(upperA.slots.map((slot) => slot.name)).toEqual([
      'Barbell Bench Press - Medium Grip',
      'Wide-Grip Lat Pulldown',
      'Incline Dumbbell Press',
      'Seated Cable Rows',
      'Side Lateral Raise',
      'Dumbbell Bicep Curl',
    ])
    const [base, strength] = view!.blocks
    const bench = (blockId: string) => view!.plan(blockId, 1, upperA.id).slots[0]
    expect(bench(base.id)).toMatchObject({ sets: 4, restSeconds: 150, target: { min: 6, max: 8, rir: { min: 2, max: 2 } }, progression: { minRir: 2, incrementKg: 2.5 } })
    expect(bench(strength.id).target).toMatchObject({ min: 4, max: 6, rir: { min: 1, max: 1 } })
  })

  it('kopja nuk lidhet me shabllonin: dy kopje janë programe më vete', async () => {
    const { store } = setup()
    const first = await createFromTemplate(store, 'full_body_3', NAMES)
    const second = await createFromTemplate(store, 'full_body_3', NAMES)
    const one = await programEditor(store, first)
    await reorderSlots(store, one!.days[0].id, [...one!.days[0].slots].reverse().map((slot) => slot.id))
    const [a, b] = await Promise.all([programEditor(store, first), programEditor(store, second)])
    expect(a!.days[0].slots[0].name).toBe('Plank')
    expect(b!.days[0].slots[0].name).toBe('Goblet Squat')
    expect(a!.exercises[a!.days[0].slots[0].exerciseId].tracking).toBe('timed')
  })

  it('ushtrimi që ekziston me të njëjtën ID të bibliotekës ripërdoret: historia mbetet bashkë', async () => {
    const { store } = setup()
    await completeOnboarding(store, PROFILE)
    const programId = await createFromTemplate(store, 'upper_lower_4', NAMES)
    const view = await programEditor(store, programId)
    // Bench Press i Shortcut to Size ka library_id Barbell_Bench_Press_-_Medium_Grip.
    expect(view!.days[0].slots[0].name).toBe('Bench Press')
    const benches = (await store.all('exercises')).filter((row) => row.library_id === 'Barbell_Bench_Press_-_Medium_Grip')
    expect(benches).toHaveLength(1)
  })

  it('Shortcut to Size si shabllon: pa program të tij, kopja merr burimin; pastaj kopje të zakonshme', async () => {
    const { store } = setup()
    const first = await createFromTemplate(store, 'shortcut_to_size', NAMES)
    const second = await createFromTemplate(store, 'shortcut_to_size', NAMES)
    const rows = await Promise.all([store.get('programs', first), store.get('programs', second)])
    expect(rows.map((row) => [row?.source, row?.template, row?.draft])).toEqual([
      ['shortcut_to_size', 'shortcut_to_size', true],
      ['custom', 'shortcut_to_size', true],
    ])
    const view = await programEditor(store, second)
    expect(view!.blocks.map((block) => block.name)).toEqual(['Java 0', 'Faza 1', 'Faza 2', 'Faza 3'])
    expect(view!.days[0].slots).toHaveLength(9)
    expect(view!.progression).toBeNull()
  })

  it('nga e para: një bllok me 4 javë, një ditë, progresi i zgjuar i ndezur', async () => {
    const { store } = setup()
    const programId = await createBlankProgram(store, BLANK)
    expect(await programEditor(store, programId)).toMatchObject({
      name: 'Programi im',
      draft: true,
      template: null,
      progression: { minRir: 2, incrementKg: 2.5 },
      blocks: [{ name: 'Blloku 1', weeks: 4 }],
      days: [{ name: 'Dita 1', slots: [] }],
    })
  })

  it('progresi i zgjuar i programit ndryshohet dhe fiket', async () => {
    const { store } = setup()
    const programId = await createBlankProgram(store, BLANK)
    await setProgramProgression(store, programId, { minRir: 3, incrementKg: 5 })
    expect((await programEditor(store, programId))!.engine.progression).toEqual({ minRir: 3, incrementKg: 5 })
    await setProgramProgression(store, programId, null)
    expect((await programEditor(store, programId))!.progression).toBeNull()
  })

  it('"Ruaj programin": drafti bëhet program; lista ndan aktivin, të mitë dhe draftet', async () => {
    const { store } = setup()
    await completeOnboarding(store, PROFILE)
    const draft = await createFromTemplate(store, 'upper_lower_4', NAMES)
    const saved = await createBlankProgram(store, BLANK)
    await saveDraft(store, saved)
    const list = await programList(store)
    expect(list.map((program) => [program.name, program.active, program.draft, program.blocks, program.days, program.weeks])).toEqual([
      ['Shortcut to Size', true, false, 4, 4, 13],
      ['Programi im', false, false, 1, 1, 4],
      ['Upper/Lower 4 ditë', false, true, 2, 4, 8],
    ])
    expect(list.find((program) => program.id === draft)?.template).toBe('upper_lower_4')
  })

  it('draftet bosh fshihen kur përdoruesi del pa shtuar asnjë ushtrim; draftet me ushtrime dhe programet e ruajtura mbeten', async () => {
    const { store } = setup()
    await completeOnboarding(store, PROFILE)
    const empty = await createBlankProgram(store, BLANK)
    const renamed = await createBlankProgram(store, { ...BLANK, program: 'Vetëm ditët' })
    await addDay(store, renamed, 'Dita 2')
    const withExercise = await createBlankProgram(store, { ...BLANK, program: 'Me një ushtrim' })
    const [bench] = await store.all('exercises')
    await addSlot(store, (await programEditor(store, withExercise))!.days[0].id, { exerciseId: bench.id, sets: 3, restSeconds: 90 })
    const savedEmpty = await createBlankProgram(store, { ...BLANK, program: 'I ruajtur' })
    await saveDraft(store, savedEmpty)
    const template = await createFromTemplate(store, 'upper_lower_4', NAMES)

    await discardEmptyDrafts(store)
    const left = (await store.all('programs')).map((row) => row.id)
    expect(left).not.toContain(empty)
    expect(left).not.toContain(renamed)
    expect(left).toEqual(expect.arrayContaining([withExercise, savedEmpty, template]))
    expect(await store.where('program_blocks', 'program_id', empty)).toEqual([])
    expect(await store.where('program_days', 'program_id', renamed)).toEqual([])
    expect((await programList(store)).map((program) => program.name)).toEqual(['Shortcut to Size', 'I ruajtur', 'Me një ushtrim', 'Upper/Lower 4 ditë'])
  })

  it('radha e ushtrimeve me tërheqje: pozicionet ndjekin listën e re', async () => {
    const { store } = setup()
    const programId = await createFromTemplate(store, 'upper_lower_4', NAMES)
    const [day] = (await programEditor(store, programId))!.days
    const ids = day.slots.map((slot) => slot.id)
    await reorderSlots(store, day.id, [ids[2], ids[0], ids[1], ...ids.slice(3)])
    const [after] = (await programEditor(store, programId))!.days
    expect(after.slots.map((slot) => slot.id)).toEqual([ids[2], ids[0], ids[1], ...ids.slice(3)])
    // Një listë që nuk përputhet me ditën (p.sh. një ushtrim u hoq ndërkohë) nuk ndryshon asgjë.
    await expect(reorderSlots(store, day.id, ids.slice(1))).rejects.toThrow()
  })

  it('kopjo ditën: dita e re del e fundit, me ushtrimet dhe rregullat e tyre', async () => {
    const { store } = setup()
    const programId = await createFromTemplate(store, 'upper_lower_4', NAMES)
    const view = (await programEditor(store, programId))!
    const copyId = await copyDay(store, view.days[0].id, 'Sipër A (kopje)')
    const after = (await programEditor(store, programId))!
    expect(after.days.map((day) => day.name)).toEqual(['Sipër A', 'Poshtë A', 'Sipër B', 'Poshtë B', 'Sipër A (kopje)'])
    const strength = after.blocks[1]
    expect(after.plan(strength.id, 1, copyId).slots[0].target).toMatchObject({ min: 4, max: 6 })
    expect(after.days[4].slots.map((slot) => slot.exerciseId)).toEqual(after.days[0].slots.map((slot) => slot.exerciseId))
  })

  it('pranimi: Sipër/poshtë 4 ditë ndërtohet, stërvitet dhe seanca e radhës propozon +2,5 kg', async () => {
    const { store, later } = setup()
    await completeOnboarding(store, PROFILE)
    const programId = await createFromTemplate(store, 'upper_lower_4', NAMES)
    await saveDraft(store, programId)
    await switchProgram(store, programId)

    // Java 1, Sipër A: Bench Press 4 × 60 kg në kufirin e sipërm (8) me RIR 2.
    const sessionId = await startWorkout(store)
    const first = (await trainingSnapshot(store))!
    expect(first.plan).toMatchObject({ blockName: 'Bazat', week: 1, dayName: 'Sipër A' })
    const bench = first.plan.slots[0]
    for (let setNumber = 1; setNumber <= bench.sets; setNumber++) {
      later(3)
      await saveSet(store, { sessionId, slot: bench, setNumber, weightKg: 60, reps: 8, rir: 2 })
    }
    later(5)
    await finishWorkout(store, sessionId)
    for (let day = 0; day < 3; day++) await skipWorkout(store)

    // Java 2, Sipër A: pesha e setit të parë vjen nga peshat e javës (§7, V23), si te seanca.
    later(60 * 24 * 4)
    await startWorkout(store)
    const next = (await trainingSnapshot(store))!
    expect(next.plan).toMatchObject({ week: 2, dayName: 'Sipër A' })
    const weights = await weekWeightsView(store, { blockId: next.plan.blockId, week: next.plan.week })
    const row = weights!.rows.find((candidate) => candidate.slotId === bench.slotId)
    expect(row).toMatchObject({
      weightKg: 62.5,
      proposal: { basis: { kind: 'progression', lastKg: 60, incrementKg: 2.5, minRir: 2, topReps: 8, earned: true } },
    })
  })

  it('pranimi: pa kufirin e sipërm në çdo set, pesha mbetet', async () => {
    const { store, later } = setup()
    await completeOnboarding(store, PROFILE)
    const programId = await createFromTemplate(store, 'upper_lower_4', NAMES)
    await switchProgram(store, programId)
    const sessionId = await startWorkout(store)
    const bench = (await trainingSnapshot(store))!.plan.slots[0]
    for (const [setNumber, reps] of [
      [1, 8],
      [2, 8],
      [3, 7],
      [4, 6],
    ]) {
      later(3)
      await saveSet(store, { sessionId, slot: bench, setNumber, weightKg: 60, reps, rir: 2 })
    }
    await finishWorkout(store, sessionId)
    for (let day = 0; day < 3; day++) await skipWorkout(store)
    const next = (await trainingSnapshot(store))!
    const weights = await weekWeightsView(store, { blockId: next.plan.blockId, week: next.plan.week })
    expect(weights!.rows.find((candidate) => candidate.slotId === bench.slotId)).toMatchObject({ weightKg: 60, proposal: { basis: { earned: false } } })
  })

  it('hapat e parë me programin e ndërtuar: aktiv, pa Shortcut to Size', async () => {
    const { store } = setup()
    const programId = await createFromTemplate(store, 'upper_lower_4', NAMES)
    await completeOnboarding(store, PROFILE, undefined, programId)
    const [settings] = await store.all('user_settings')
    expect(settings.active_program_id).toBe(programId)
    expect(settings.onboarded_at).toBeTruthy()
    expect((await store.all('programs')).map((row) => [row.name, row.draft])).toEqual([['Upper/Lower 4 ditë', false]])
    expect((await trainingSnapshot(store))!.plan).toMatchObject({ blockName: 'Bazat', week: 1, dayName: 'Sipër A' })
  })
})
