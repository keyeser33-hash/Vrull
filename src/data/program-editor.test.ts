import { planSession } from '@/program/engine'
import { suggestionFor } from '@/program/loads'
import { SHORTCUT_TO_SIZE } from '@/program/shortcut-to-size'
import { createDatabase } from './db'
import {
  addBlock,
  addDay,
  addSlot,
  addSlotFromLibrary,
  copyBlock,
  copyWeek,
  createProgram,
  deleteProgram,
  duplicateProgram,
  editSlot,
  moveDay,
  programEditor,
  programList,
  removeBlock,
  removeDay,
  removeSlot,
  renameProgram,
  setRule,
  setSlotExercise,
  startProgram,
  updateBlock,
} from './program-editor'
import { createLocalStore } from './store'
import { programModel, switchProgram, trainingSnapshot } from './training'

const USER = '11111111-1111-4111-8111-111111111111'

function setup() {
  const store = createLocalStore(createDatabase(`editor-${crypto.randomUUID()}`), { userId: () => USER })
  return store
}

/** Plani i çdo stërvitjeje, me emrat e ushtrimeve në vend të id-ve, për krahasim. */
function plans(program: Parameters<typeof planSession>[0], exerciseName: (id: string) => string | undefined) {
  const blocks = [...program.blocks].sort((a, b) => a.position - b.position)
  const days = [...program.days].sort((a, b) => a.position - b.position)
  return blocks.flatMap((block) =>
    Array.from({ length: block.weeks }, (_, index) =>
      days.map((day) => {
        const plan = planSession(program, { run: 1, blockId: block.id, week: index + 1, dayId: day.id, completed: false })
        return {
          at: `${block.name} · ${index + 1} · ${day.name}`,
          slots: plan.slots.map((slot) => ({ ...slot, slotId: undefined, position: undefined, exerciseId: exerciseName(slot.exerciseId) })),
        }
      }),
    ).flat(),
  )
}

describe('editori i programeve (TH-11)', () => {
  it('Shortcut to Size i rikrijuar nga zero me editorin del i njëjtë me programin e gatshëm', async () => {
    const store = setup()
    const definition = SHORTCUT_TO_SIZE.program
    const exerciseIds = new Map<string, string>()
    for (const exercise of SHORTCUT_TO_SIZE.exercises) {
      const row = await store.put('exercises', {
        name: exercise.name,
        equipment: exercise.equipment,
        tracking: exercise.tracking,
        primary_muscles: exercise.primary,
        secondary_muscles: exercise.secondary,
      })
      exerciseIds.set(exercise.id, row.id)
    }

    const programId = await createProgram(store, 'Shortcut to Size nga editori')
    const blockIds = new Map<string, string>()
    for (const block of [...definition.blocks].sort((a, b) => a.position - b.position)) {
      blockIds.set(block.id, await addBlock(store, programId, { name: block.name, weeks: block.weeks }))
    }
    const dayIds = new Map<string, string>()
    for (const day of [...definition.days].sort((a, b) => a.position - b.position)) {
      dayIds.set(day.id, await addDay(store, programId, day.name))
    }
    const slotIds = new Map<string, string>()
    for (const slot of [...definition.slots].sort((a, b) => a.position - b.position)) {
      slotIds.set(
        slot.id,
        await addSlot(store, dayIds.get(slot.dayId)!, { exerciseId: exerciseIds.get(slot.exerciseId)!, sets: slot.sets, restSeconds: slot.restSeconds }),
      )
    }
    for (const rule of definition.overrides) {
      await setRule(
        store,
        slotIds.get(rule.slotId)!,
        { blockId: rule.blockId ? blockIds.get(rule.blockId)! : null, week: rule.week },
        {
          ...(rule.exerciseId ? { exerciseId: exerciseIds.get(rule.exerciseId)! } : {}),
          ...(rule.sets ? { sets: rule.sets } : {}),
          ...(rule.restSeconds ? { restSeconds: rule.restSeconds } : {}),
          ...(rule.prescription ? { prescription: rule.prescription } : {}),
          ...(rule.technique ? { technique: rule.technique } : {}),
        },
      )
    }

    const model = (await programModel(store, programId))!
    const nameOf = (id: string) => model.exercises[id]?.name
    const expected = plans(definition, (id) => id)
    expect(plans(model.engine, nameOf)).toEqual(expected)
    expect(expected).toHaveLength(52)
  })

  it('një program 5/3/1 i thjeshtë: %1RM sipas javës dhe seti AMRAP', async () => {
    const store = setup()
    const squat = await store.put('exercises', { name: 'Squat', equipment: 'barbell', tracking: 'weight_reps', primary_muscles: ['rectus_femoris'] })
    const programId = await createProgram(store, '5/3/1')
    const block = await addBlock(store, programId, { name: 'Cikli 1', weeks: 3 })
    const day = await addDay(store, programId, 'Këmbë')
    const slot = await addSlot(store, day, { exerciseId: squat.id, sets: 3, restSeconds: 180 })
    await setRule(store, slot, { blockId: null, week: null }, {
      prescription: {
        type: 'percent_1rm',
        weeks: [
          { percent: 85, reps: 5, amrap: true },
          { percent: 90, reps: 3, amrap: true },
          { percent: 95, reps: 1, amrap: true },
        ],
      },
    })
    await switchProgram(store, programId)
    const snapshot = (await trainingSnapshot(store))!
    expect(snapshot).toMatchObject({ programName: '5/3/1', label: 'Cikli 1 · Java 1' })
    const [planned] = snapshot.plan.slots
    expect(planned.target).toEqual({ kind: 'percent_1rm', percent: 85, reps: 5, amrap: true })
    const suggestion = suggestionFor(planned, { equipment: 'barbell', tracking: 'weight_reps' }, [], new Date(), { oneRmKg: 140, setAt: '2026-01-01T00:00:00.000Z' }, {})
    expect(suggestion.weightKg).toBe(117.5)
    const model = (await programModel(store, programId))!
    expect(planSession(model.engine, { run: 1, blockId: block, week: 3, dayId: day, completed: false }).slots[0].target).toMatchObject({ percent: 95, reps: 1 })
  })

  it('kopjo bllokun: rregullat e bllokut kalojnë te blloku i ri, që del menjëherë pas tij', async () => {
    const store = setup()
    const bench = await store.put('exercises', { name: 'Bench Press', equipment: 'barbell' })
    const incline = await store.put('exercises', { name: 'Incline Bench Press', equipment: 'barbell' })
    const programId = await createProgram(store, 'Prova')
    const first = await addBlock(store, programId, { name: 'Faza 1', weeks: 4 })
    const last = await addBlock(store, programId, { name: 'Faza 3', weeks: 4 })
    const day = await addDay(store, programId, 'A')
    const slot = await addSlot(store, day, { exerciseId: bench.id, sets: 3, restSeconds: 90 })
    await setRule(store, slot, { blockId: first, week: null }, { exerciseId: incline.id })
    await setRule(store, slot, { blockId: first, week: 2 }, { sets: 5 })

    const copy = await copyBlock(store, first)
    await updateBlock(store, copy, { name: 'Faza 2' })
    const model = (await programModel(store, programId))!
    expect([...model.engine.blocks].sort((a, b) => a.position - b.position).map((block) => block.name)).toEqual(['Faza 1', 'Faza 2', 'Faza 3'])
    const plan = (week: number) => planSession(model.engine, { run: 1, blockId: copy, week, dayId: day, completed: false }).slots[0]
    expect(plan(1).exerciseId).toBe(incline.id)
    expect(plan(2).sets).toBe(5)
    expect(planSession(model.engine, { run: 1, blockId: last, week: 1, dayId: day, completed: false }).slots[0].exerciseId).toBe(bench.id)
  })

  it('kopjo javën: rregullat e një jave kalojnë te një javë tjetër, edhe në një bllok tjetër', async () => {
    const store = setup()
    const bench = await store.put('exercises', { name: 'Bench Press', equipment: 'barbell' })
    const programId = await createProgram(store, 'Prova')
    const one = await addBlock(store, programId, { name: 'Faza 1', weeks: 4 })
    const two = await addBlock(store, programId, { name: 'Faza 2', weeks: 4 })
    const day = await addDay(store, programId, 'A')
    const slot = await addSlot(store, day, { exerciseId: bench.id, sets: 3, restSeconds: 90 })
    await setRule(store, slot, { blockId: one, week: 3 }, { technique: { type: 'drop_set' }, sets: 4 })
    await copyWeek(store, programId, { blockId: one, week: 3 }, { blockId: two, week: 1 })
    const model = (await programModel(store, programId))!
    expect(planSession(model.engine, { run: 1, blockId: two, week: 1, dayId: day, completed: false }).slots[0]).toMatchObject({
      sets: 4,
      technique: { type: 'drop_set' },
    })
  })

  it('heqja e një blloku heq rregullat e tij; treguesi kalon te një bllok që ekziston', async () => {
    const store = setup()
    const bench = await store.put('exercises', { name: 'Bench Press', equipment: 'barbell' })
    const programId = await createProgram(store, 'Prova')
    const one = await addBlock(store, programId, { name: 'Faza 1', weeks: 2 })
    const two = await addBlock(store, programId, { name: 'Faza 2', weeks: 2 })
    const day = await addDay(store, programId, 'A')
    const slot = await addSlot(store, day, { exerciseId: bench.id, sets: 3, restSeconds: 90 })
    await setRule(store, slot, { blockId: one, week: null }, { sets: 6 })
    await switchProgram(store, programId)
    await removeBlock(store, one)
    expect(await store.where('slot_prescriptions', 'slot_id', slot)).toHaveLength(0)
    expect(await trainingSnapshot(store)).toMatchObject({ plan: { blockId: two, week: 1 } })
  })

  it('ditët ndërrojnë radhën; një slot i hequr del nga plani', async () => {
    const store = setup()
    const bench = await store.put('exercises', { name: 'Bench Press', equipment: 'barbell' })
    const programId = await createProgram(store, 'Prova')
    await addBlock(store, programId, { name: 'Blloku 1', weeks: 1 })
    const a = await addDay(store, programId, 'A')
    await addDay(store, programId, 'B')
    await moveDay(store, a, 1)
    const slot = await addSlot(store, a, { exerciseId: bench.id, sets: 3, restSeconds: 90 })
    await removeSlot(store, slot)
    const model = (await programModel(store, programId))!
    expect([...model.engine.days].sort((x, y) => x.position - y.position).map((day) => day.name)).toEqual(['B', 'A'])
    expect(model.engine.slots).toHaveLength(0)
  })

  it('rregullat e të njëjtit fushëveprim bashkohen; null heq një fushë, dhe rregulli bosh fshihet', async () => {
    const store = setup()
    const bench = await store.put('exercises', { name: 'Bench Press', equipment: 'barbell' })
    const programId = await createProgram(store, 'Prova')
    const block = await addBlock(store, programId, { name: 'Blloku 1', weeks: 2 })
    const day = await addDay(store, programId, 'A')
    const slot = await addSlot(store, day, { exerciseId: bench.id, sets: 3, restSeconds: 90 })
    const planned = async () => {
      const model = (await programModel(store, programId))!
      return planSession(model.engine, { run: 1, blockId: block, week: 2, dayId: day, completed: false }).slots[0]
    }
    await setRule(store, slot, { blockId: null, week: 2 }, { sets: 5 })
    await setRule(store, slot, { blockId: null, week: 2 }, { restSeconds: 60 })
    expect(await planned()).toMatchObject({ sets: 5, restSeconds: 60 })
    await setRule(store, slot, { blockId: null, week: 2 }, { sets: null })
    expect(await planned()).toMatchObject({ sets: 3, restSeconds: 60 })
    await setRule(store, slot, { blockId: null, week: 2 }, { restSeconds: null })
    expect(await store.where('slot_prescriptions', 'slot_id', slot)).toHaveLength(0)
  })

  it('kopjo javën zëvendëson rregullat që kishte java e synuar', async () => {
    const store = setup()
    const bench = await store.put('exercises', { name: 'Bench Press', equipment: 'barbell' })
    const programId = await createProgram(store, 'Prova')
    const block = await addBlock(store, programId, { name: 'Blloku 1', weeks: 2 })
    const day = await addDay(store, programId, 'A')
    const slot = await addSlot(store, day, { exerciseId: bench.id, sets: 3, restSeconds: 90 })
    await setRule(store, slot, { blockId: block, week: 1 }, { technique: { type: 'drop_set' } })
    await setRule(store, slot, { blockId: block, week: 2 }, { sets: 6 })
    await copyWeek(store, programId, { blockId: block, week: 1 }, { blockId: block, week: 2 })
    const model = (await programModel(store, programId))!
    expect(planSession(model.engine, { run: 1, blockId: block, week: 2, dayId: day, completed: false }).slots[0]).toMatchObject({
      sets: 3,
      technique: { type: 'drop_set' },
    })
  })

  it('treguesi te një javë e mëvonshme e bllokut të hequr kthehet te java 1 e bllokut tjetër', async () => {
    const store = setup()
    const bench = await store.put('exercises', { name: 'Bench Press', equipment: 'barbell' })
    const programId = await createProgram(store, 'Prova')
    const one = await addBlock(store, programId, { name: 'Faza 1', weeks: 3 })
    const two = await addBlock(store, programId, { name: 'Faza 2', weeks: 3 })
    const day = await addDay(store, programId, 'A')
    await addSlot(store, day, { exerciseId: bench.id, sets: 3, restSeconds: 90 })
    await switchProgram(store, programId)
    const [state] = await store.where('program_state', 'program_id', programId)
    await store.put('program_state', { id: state.id, week: 3 })
    await removeBlock(store, one)
    expect(await trainingSnapshot(store)).toMatchObject({ plan: { blockId: two, week: 1 } })
  })

  it('pas heqjes së një sloti, sloti i ri shtohet në fund dhe radha mbetet e qartë', async () => {
    const store = setup()
    const names = ['A1', 'A2', 'A3', 'A4']
    const ids = await Promise.all(names.map(async (name) => (await store.put('exercises', { name, equipment: 'barbell' })).id))
    const programId = await createProgram(store, 'Prova')
    const block = await addBlock(store, programId, { name: 'Blloku 1', weeks: 1 })
    const day = await addDay(store, programId, 'A')
    const slots = []
    for (const id of ids.slice(0, 3)) slots.push(await addSlot(store, day, { exerciseId: id, sets: 3, restSeconds: 90 }))
    await removeSlot(store, slots[1])
    await addSlot(store, day, { exerciseId: ids[3], sets: 3, restSeconds: 90 })
    const rows = await store.where('program_slots', 'day_id', day)
    expect(new Set(rows.map((row) => row.position)).size).toBe(3)
    const model = (await programModel(store, programId))!
    const order = planSession(model.engine, { run: 1, blockId: block, week: 1, dayId: day, completed: false }).slots.map((slot) => model.exercises[slot.exerciseId]?.name)
    expect(order).toEqual(['A1', 'A3', 'A4'])
  })

  it('ndryshimi për gjithë programin shkon te sloti vetë; në një nivel tjetër bëhet rregull', async () => {
    const store = setup()
    const bench = await store.put('exercises', { name: 'Bench Press', equipment: 'barbell' })
    const programId = await createProgram(store, 'Prova')
    const block = await addBlock(store, programId, { name: 'Blloku 1', weeks: 2 })
    const day = await addDay(store, programId, 'A')
    const slot = await addSlot(store, day, { exerciseId: bench.id, sets: 3, restSeconds: 90 })
    await setRule(store, slot, { blockId: null, week: null }, { sets: 4, prescription: { type: 'timed', seconds: 30 } })
    await editSlot(store, slot, { blockId: null, week: null }, { sets: 5 })
    expect(await store.get('program_slots', slot)).toMatchObject({ sets: 5 })
    const [base] = await store.where('slot_prescriptions', 'slot_id', slot)
    expect(base).toMatchObject({ sets: null, prescription: { type: 'timed', seconds: 30 } })
    await editSlot(store, slot, { blockId: block, week: 2 }, { sets: 6 })
    const view = (await programEditor(store, programId))!
    expect(view.rules(slot, { blockId: block, week: 2 }).sets).toEqual({ value: 6, from: { blockId: block, week: 2 } })
    expect(view.rules(slot, { blockId: block, week: 1 }).sets).toEqual({ value: 5, from: null })
  })

  it('rregulli i progresit (V9) ruhet në nivelin e zgjedhur dhe e lexon motori', async () => {
    const store = setup()
    const press = await store.put('exercises', { name: 'Dumbbell Shoulder Press', equipment: 'dumbbell' })
    const programId = await createProgram(store, 'Sipër/poshtë')
    const one = await addBlock(store, programId, { name: 'Blloku 1', weeks: 2 })
    const two = await addBlock(store, programId, { name: 'Blloku 2', weeks: 2 })
    const day = await addDay(store, programId, 'Sipër')
    const slot = await addSlot(store, day, { exerciseId: press.id, sets: 3, restSeconds: 90 })
    await editSlot(store, slot, { blockId: null, week: null }, { progression: { minRir: 2, incrementKg: 2.5 } })
    await editSlot(store, slot, { blockId: two, week: null }, { progression: { minRir: 1, incrementKg: 2 } })
    const view = (await programEditor(store, programId))!
    expect(view.plan(one, 2, day).slots[0].progression).toEqual({ minRir: 2, incrementKg: 2.5 })
    expect(view.plan(two, 1, day).slots[0].progression).toEqual({ minRir: 1, incrementKg: 2 })
    expect(view.rules(slot, { blockId: two, week: 1 }).progression.from).toEqual({ blockId: two, week: null })
  })

  it('kopja e programit dhe një ndryshim tjetër në të njëjtin nivel e mbajnë rregullin e progresit', async () => {
    const store = setup()
    const press = await store.put('exercises', { name: 'Dumbbell Shoulder Press', equipment: 'dumbbell' })
    const programId = await createProgram(store, 'Sipër/poshtë')
    const block = await addBlock(store, programId, { name: 'Blloku 1', weeks: 2 })
    const day = await addDay(store, programId, 'Sipër')
    const slot = await addSlot(store, day, { exerciseId: press.id, sets: 3, restSeconds: 90 })
    await setRule(store, slot, { blockId: block, week: null }, { progression: { minRir: 2, incrementKg: 2.5 } })
    await setRule(store, slot, { blockId: block, week: null }, { sets: 4 })
    const copy = await duplicateProgram(store, programId, 'Kopje')
    const view = (await programEditor(store, copy))!
    expect(view.plan(view.blocks[0].id, 1, view.days[0].id).slots[0]).toMatchObject({ sets: 4, progression: { minRir: 2, incrementKg: 2.5 } })
  })

  it('programi i ri ka një bllok dhe një ditë; lista tregon cili është aktiv', async () => {
    const store = setup()
    const first = await startProgram(store, '  Upper lower ')
    const second = await startProgram(store, 'PPL')
    const third = await startProgram(store, 'Arnold split')
    await switchProgram(store, first)
    const view = (await programEditor(store, second))!
    expect(view).toMatchObject({ name: 'PPL', active: false })
    expect(view.blocks.map((block) => [block.name, block.weeks])).toEqual([['Blloku 1', 4]])
    expect(view.days.map((day) => [day.name, day.number])).toEqual([['Dita 1', 1]])
    expect(await programList(store)).toEqual([
      { id: first, name: 'Upper lower', active: true, blocks: 1, days: 1 },
      { id: third, name: 'Arnold split', active: false, blocks: 1, days: 1 },
      { id: second, name: 'PPL', active: false, blocks: 1, days: 1 },
    ])
  })

  it('ushtrimi nga biblioteka: pushim 60 s për barkun dhe pulpat, pa dyfishuar një ushtrim me të njëjtin emër', async () => {
    const store = setup()
    const programId = await startProgram(store, 'Prova')
    const existing = await store.put('exercises', { name: 'Barbell Squat', equipment: 'barbell' })
    const view = (await programEditor(store, programId))!
    const day = view.days[0].id
    const squat = await addSlotFromLibrary(store, day, { id: 'Barbell_Squat', name: 'Barbell Squat', equipment: 'barbell', primary: ['quadriceps'], secondary: [] })
    const crunch = await addSlotFromLibrary(store, day, { id: 'Crunches', name: 'Crunches', equipment: 'bodyweight', primary: ['abdominals'], secondary: [] })
    const after = (await programEditor(store, programId))!
    expect(after.days[0].slots.map((slot) => [slot.id, slot.name, slot.sets, slot.restSeconds])).toEqual([
      [squat, 'Barbell Squat', 3, 90],
      [crunch, 'Crunches', 3, 60],
    ])
    expect(after.days[0].slots[0].exerciseId).toBe(existing.id)
    expect(await store.all('exercises')).toHaveLength(2)
  })

  it('programi mban të paktën një bllok dhe një ditë', async () => {
    const store = setup()
    const programId = await startProgram(store, 'Prova')
    const view = (await programEditor(store, programId))!
    await expect(removeBlock(store, view.blocks[0].id)).rejects.toThrow('të paktën një bllok')
    await expect(removeDay(store, view.days[0].id)).rejects.toThrow('të paktën një ditë')
    const day = await addDay(store, programId, 'B')
    await removeDay(store, day)
    expect((await programEditor(store, programId))!.days.map((entry) => entry.name)).toEqual(['Dita 1'])
  })

  it('kur blloku shkurtohet, treguesi kalon te java e tij e fundit', async () => {
    const store = setup()
    const programId = await startProgram(store, 'Prova')
    await switchProgram(store, programId)
    const [state] = await store.where('program_state', 'program_id', programId)
    await store.put('program_state', { id: state.id, week: 4 })
    await updateBlock(store, String(state.block_id), { weeks: 2 })
    expect(await trainingSnapshot(store)).toMatchObject({ plan: { week: 2, blockWeeks: 2 } })
  })

  it('ushtrimi i ri për një nivel vjen nga biblioteka', async () => {
    const store = setup()
    const programId = await startProgram(store, 'Prova')
    const view = (await programEditor(store, programId))!
    const slot = await addSlotFromLibrary(store, view.days[0].id, { id: 'Barbell_Squat', name: 'Barbell Squat', equipment: 'barbell', primary: ['quadriceps'], secondary: [] })
    await setSlotExercise(store, slot, { blockId: view.blocks[0].id, week: 2 }, { id: 'Front_Squat', name: 'Front Squat', equipment: 'barbell', primary: ['quadriceps'], secondary: [] })
    const after = (await programEditor(store, programId))!
    const exercise = after.rules(slot, { blockId: view.blocks[0].id, week: 2 }).exerciseId.value
    expect(after.exercises[exercise]?.name).toBe('Front Squat')
    expect(after.days[0].slots[0].name).toBe('Barbell Squat')
  })

  it('kopjo programin, riemërtoje dhe fshije; programi aktiv nuk fshihet', async () => {
    const store = setup()
    const bench = await store.put('exercises', { name: 'Bench Press', equipment: 'barbell' })
    const programId = await createProgram(store, 'Origjinali')
    const block = await addBlock(store, programId, { name: 'Blloku 1', weeks: 2 })
    const day = await addDay(store, programId, 'A')
    const slot = await addSlot(store, day, { exerciseId: bench.id, sets: 3, restSeconds: 90 })
    await setRule(store, slot, { blockId: block, week: 2 }, { sets: 5 })

    const copyId = await duplicateProgram(store, programId, 'Kopja')
    await renameProgram(store, copyId, 'Kopja ime')
    const copy = (await programModel(store, copyId))!
    expect(copy.row.name).toBe('Kopja ime')
    const [copyBlockRow] = copy.engine.blocks
    expect(planSession(copy.engine, { run: 1, blockId: copyBlockRow.id, week: 2, dayId: copy.engine.days[0].id, completed: false }).slots[0].sets).toBe(5)
    expect(copyBlockRow.id).not.toBe(block)

    await switchProgram(store, programId)
    await expect(deleteProgram(store, programId)).rejects.toThrow('Programi aktiv nuk fshihet')
    await deleteProgram(store, copyId)
    expect(await programModel(store, copyId)).toBeNull()
    expect((await store.all('program_slots')).map((row) => row.program_id)).toEqual([programId])
  })
})
