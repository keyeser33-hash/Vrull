import { muscleLoad } from '@/body/body-map'
import { advance, blockWeekLabel, planSession, restart } from '@/program/engine'
import { MUSCLE_GROUPS } from '@/program/muscles'
import { programOverview, type ProgramOverview, type SessionMark } from '@/program/overview'
import { type LibraryExercise, muscleKeys } from '@/program/library'
import type { HistorySet } from '@/program/loads'
import type { WorkedSession } from '@/program/recovery'
import { sessionVolume } from '@/progress/history'
import { sessionBests } from '@/progress/records'
import { SHORTCUT_RENAMES, SHORTCUT_TO_SIZE } from '@/program/shortcut-to-size'
import { workoutMinutes } from '@/program/week-plan'
import type {
  Block,
  Equipment,
  Pointer,
  PlannedSlot,
  Prescription,
  Program,
  ProgressionRule,
  SessionPlan,
  SlotOverride,
  Technique,
  Tracking,
} from '@/program/types'
import { localDate } from '@/lib/calendar'
import type { LocalStore } from './store'
import type { LocalRow } from './tables'
import { numberOrNull } from '@/lib/number'
import { lightenPlan } from '@/readiness/lighter-session'
import { lighterDay, workoutKey } from './lighter-day'

// Programi aktiv, treguesi i radhës dhe stërvitjet, mbi bazën lokale (SPEC §4, §6). Motori i
// programit (src/program) llogarit; ky modul lexon dhe shkruan rreshtat përmes store-it.

export interface ExerciseRecord {
  id: string
  name: string
  equipment: Equipment
  tracking: Tracking
  primary: string[]
  secondary: string[]
  libraryId: string | null
  /** Link-u i YouTube që shtoi përdoruesi (SPEC §12). */
  videoUrl: string | null
}

export interface Segment {
  weightKg: number | null
  reps: number
}

export interface SetRecord {
  id: string
  slotId: string | null
  exerciseId: string
  setNumber: number
  weightKg: number | null
  reps: number | null
  seconds: number | null
  rir: number | null
  rpe: number | null
  technique: Technique['type']
  segments: Segment[]
  loggedAt: string
  notes: string | null
}

export interface TrainingSnapshot {
  programId: string
  programName: string
  stateId: string
  pointer: Pointer
  completed: boolean
  /** "Java 0" ose "Faza 1 · Java 2". */
  label: string
  blocks: Block[]
  plan: SessionPlan
  exercises: Record<string, ExerciseRecord>
  /** Stërvitja e nisur për këtë tregues, nëse ka. */
  session: { id: string; startedAt: string; sets: SetRecord[] } | null
}

const byPosition = (a: LocalRow, b: LocalRow) => Number(a.position) - Number(b.position)

function toExercise(row: LocalRow): ExerciseRecord {
  return {
    id: row.id,
    name: String(row.name),
    equipment: row.equipment as Equipment,
    tracking: (row.tracking as Tracking | undefined) ?? 'weight_reps',
    primary: (row.primary_muscles as string[] | undefined) ?? [],
    secondary: (row.secondary_muscles as string[] | undefined) ?? [],
    libraryId: (row.library_id as string | null | undefined) ?? null,
    videoUrl: (row.video_url as string | null | undefined) ?? null,
  }
}

function toSet(row: LocalRow): SetRecord {
  return {
    id: row.id,
    slotId: (row.slot_id as string | null | undefined) ?? null,
    exerciseId: String(row.exercise_id),
    setNumber: Number(row.set_number),
    weightKg: numberOrNull(row.weight_kg),
    reps: numberOrNull(row.reps),
    seconds: numberOrNull(row.seconds),
    rir: numberOrNull(row.rir),
    rpe: numberOrNull(row.rpe),
    technique: (row.technique as Technique['type'] | null | undefined) ?? 'none',
    segments: ((row.segments as { weight_kg: number | null; reps: number }[] | null | undefined) ?? []).map((segment) => ({
      weightKg: segment.weight_kg,
      reps: segment.reps,
    })),
    loggedAt: String(row.logged_at),
    notes: (row.notes as string | null | undefined) ?? null,
  }
}

async function settings(store: LocalStore) {
  return (await store.all('user_settings'))[0]
}

/** Krijon Shortcut to Size, ose plotëson atë që ekziston (skeleti i versionit 0.2.0), pa dyfishuar. */
export async function ensureShortcutToSize(store: LocalStore): Promise<LocalRow> {
  const definition = SHORTCUT_TO_SIZE.program
  const existing = (await store.all('programs')).find((program) => program.source === 'shortcut_to_size')
  const program = existing ?? (await store.put('programs', { name: SHORTCUT_TO_SIZE.name, source: 'shortcut_to_size' }))

  let blocks = (await store.where('program_blocks', 'program_id', program.id)).sort(byPosition)
  if (blocks.length === 0) {
    blocks = await store.insertMany(
      'program_blocks',
      definition.blocks.map(({ position, name, weeks }) => ({ program_id: program.id, position, name, weeks })),
    )
  }
  let days = (await store.where('program_days', 'program_id', program.id)).sort(byPosition)
  if (days.length === 0) {
    days = await store.insertMany(
      'program_days',
      definition.days.map(({ position, name }) => ({ program_id: program.id, position, name })),
    )
  }

  const hasSlots = (await store.where('program_slots', 'program_id', program.id)).length > 0
  if (!hasSlots) {
    const exerciseIds = await ensureExercises(store)
    const blockId = new Map(definition.blocks.map((block) => [block.id, blocks[block.position].id]))
    const dayId = new Map(definition.days.map((day) => [day.id, days[day.position].id]))
    const slotRows = await store.insertMany(
      'program_slots',
      definition.slots.map((slot) => ({
        program_id: program.id,
        day_id: dayId.get(slot.dayId),
        position: slot.position,
        exercise_id: exerciseIds.get(slot.exerciseId),
        sets: slot.sets,
        rest_seconds: slot.restSeconds,
      })),
    )
    const slotId = new Map(definition.slots.map((slot, index) => [slot.id, slotRows[index].id]))
    await store.insertMany(
      'slot_prescriptions',
      definition.overrides.map((row) => ({
        program_id: program.id,
        slot_id: slotId.get(row.slotId),
        block_id: row.blockId ? blockId.get(row.blockId) : null,
        week: row.week,
        exercise_id: row.exerciseId ? exerciseIds.get(row.exerciseId) : null,
        sets: row.sets ?? null,
        rest_seconds: row.restSeconds ?? null,
        prescription: row.prescription ?? null,
        technique: row.technique ?? null,
      })),
    )
  }

  const [state] = await store.where('program_state', 'program_id', program.id)
  if (!state) {
    await store.put('program_state', { program_id: program.id, run: 1, block_id: blocks[0].id, week: 1, day_id: days[0].id })
  }
  return program
}

/** Përditësimi nga 0.2.0: Shortcut to Size që ekziston merr slotet; asnjë program i ri nuk krijohet. */
export async function upgradeShortcutToSize(store: LocalStore) {
  const existing = (await store.all('programs')).find((program) => program.source === 'shortcut_to_size')
  if (existing) {
    await ensureShortcutToSize(store)
    await renameShortcutExercises(store, existing.id)
  }
}

/**
 * Emrat e ushtrimeve të Shortcut to Size që ndryshuan për të ndjekur PDF-në (V62): programet e krijuara
 * më parë mbajnë emrin e vjetër. Ushtrimi i programit rimërohet në vend (id-ja mbetet, kështu slotet,
 * videot dhe rregullat nuk lëvizin), vetëm kur nuk ka asnjë set të regjistruar, që historiku të mos
 * ndryshojë; një ushtrim i përdoruesit jashtë programit nuk preket, dhe një emër që ekziston nuk dyfishohet.
 */
async function renameShortcutExercises(store: LocalStore, programId: string) {
  const [slots, overrides, exercises] = await Promise.all([
    store.where('program_slots', 'program_id', programId),
    store.where('slot_prescriptions', 'program_id', programId),
    store.all('exercises'),
  ])
  const used = new Set([...slots.map((row) => row.exercise_id), ...overrides.map((row) => row.exercise_id)])
  const names = new Set(exercises.map((row) => String(row.name).toLowerCase()))
  for (const [from, to] of SHORTCUT_RENAMES) {
    if (names.has(to.toLowerCase())) continue
    const row = exercises.find((exercise) => String(exercise.name).toLowerCase() === from.toLowerCase() && used.has(exercise.id))
    if (!row || (await store.where('set_logs', 'exercise_id', row.id)).length > 0) continue
    await store.put('exercises', { id: row.id, name: to })
    names.add(to.toLowerCase())
  }
}

/** Ushtrimet e programit, të krijuara një herë; një ushtrim me të njëjtin emër ripërdoret. */
async function ensureExercises(store: LocalStore) {
  const existing = new Map((await store.all('exercises')).map((row) => [String(row.name).toLowerCase(), row.id]))
  const missing = SHORTCUT_TO_SIZE.exercises.filter((exercise) => !existing.has(exercise.name.toLowerCase()))
  const created = await store.insertMany(
    'exercises',
    missing.map((exercise) => ({
      name: exercise.name,
      library_id: exercise.libraryId,
      equipment: exercise.equipment,
      tracking: exercise.tracking,
      primary_muscles: exercise.primary,
      secondary_muscles: exercise.secondary,
    })),
  )
  created.forEach((row) => existing.set(String(row.name).toLowerCase(), row.id))
  return new Map(SHORTCUT_TO_SIZE.exercises.map((exercise) => [exercise.id, existing.get(exercise.name.toLowerCase())!]))
}

/** Programi si model i motorit (blloqe, ditë, slote, rregulla), edhe pa tregues: për editorin. */
export async function programModel(store: LocalStore, programId: string) {
  const [program, blocks, days, slots, overrides, exerciseRows, [state]] = await Promise.all([
    store.get('programs', programId),
    store.where('program_blocks', 'program_id', programId),
    store.where('program_days', 'program_id', programId),
    store.where('program_slots', 'program_id', programId),
    store.where('slot_prescriptions', 'program_id', programId),
    store.all('exercises'),
    store.where('program_state', 'program_id', programId),
  ])
  if (!program) return null
  const exercises = Object.fromEntries(exerciseRows.map((row) => [row.id, toExercise(row)]))
  const engine: Program = {
    id: programId,
    blocks: blocks.map((row) => ({ id: row.id, position: Number(row.position), name: String(row.name), weeks: Number(row.weeks) })),
    days: days.map((row) => ({ id: row.id, position: Number(row.position), name: String(row.name) })),
    slots: slots.map((row) => ({
      id: row.id,
      dayId: String(row.day_id),
      position: Number(row.position),
      exerciseId: String(row.exercise_id),
      sets: Number(row.sets),
      restSeconds: Number(row.rest_seconds),
    })),
    overrides: overrides.map(
      (row): SlotOverride => ({
        slotId: String(row.slot_id),
        blockId: (row.block_id as string | null) ?? null,
        week: numberOrNull(row.week),
        exerciseId: (row.exercise_id as string | null) ?? null,
        sets: numberOrNull(row.sets),
        restSeconds: numberOrNull(row.rest_seconds),
        prescription: (row.prescription as Prescription | null) ?? null,
        technique: (row.technique as Technique | null) ?? null,
        progression: (row.progression as ProgressionRule | null | undefined) ?? null,
      }),
    ),
    exercises,
    progression: (program.progression as ProgressionRule | null | undefined) ?? null,
  }
  return { row: program, state: state as LocalRow | undefined, engine, exercises }
}

async function loadProgram(store: LocalStore, programId: string) {
  const model = await programModel(store, programId)
  const state = model?.state
  if (!model || !state?.block_id || !state.day_id || model.engine.blocks.length === 0 || model.engine.days.length === 0) return null
  const pointer: Pointer = {
    run: Number(state.run ?? 1),
    blockId: String(state.block_id),
    week: Number(state.week),
    dayId: String(state.day_id),
    completed: Boolean(state.completed_at),
  }
  return { ...model, state, pointer }
}

/** Programi aktiv si model i motorit, me treguesin; null pa program aktiv. */
export async function activeProgram(store: LocalStore) {
  const programId = (await settings(store))?.active_program_id as string | undefined
  return programId ? loadProgram(store, programId) : null
}

/** Seanca e nisur për treguesin e tanishëm, nëse ka. */
export async function openSession(store: LocalStore, programId: string, pointer: Pointer) {
  const sessions = await store.where('workout_sessions', 'program_id', programId)
  return sessions.find(
    (row) =>
      row.status === 'in_progress' &&
      row.run === pointer.run &&
      row.block_id === pointer.blockId &&
      row.week === pointer.week &&
      row.day_id === pointer.dayId,
  )
}

/**
 * Kohëzgjatja e vlerësuar e stërvitjes së radhës (si "~45 min" te editori), për orën e vaktit pas
 * stërvitjes (V62); null pa program aktiv, pa stërvitje të mbetur ose pa ushtrime.
 */
export async function plannedWorkoutMinutes(store: LocalStore): Promise<number | null> {
  const loaded = await activeProgram(store)
  if (!loaded || loaded.pointer.completed) return null
  const minutes = workoutMinutes(planSession(loaded.engine, loaded.pointer).slots)
  return minutes > 0 ? minutes : null
}

/** Gjithçka që i duhet ekranit Sot dhe seancës: plani i stërvitjes së radhës dhe seanca e nisur. */
export async function trainingSnapshot(store: LocalStore): Promise<TrainingSnapshot | null> {
  const loaded = await activeProgram(store)
  if (!loaded) return null
  const { row, state, engine, pointer, exercises } = loaded
  const planned = planSession(engine, pointer)
  const session = await openSession(store, row.id, pointer)
  // "Seanca më e lehtë" (V50): setet dhe RIR-i e stërvitjes së ditës ndryshojnë këtu, në vendin e vetëm ku
  // vendosen, që Sot, njoftimi i seancës dhe seanca të thonë të njëjtën gjë; pesha: `workoutWeights`.
  const lighter = await lighterDay(store, workoutKey(pointer), session ? { startedAt: session.started_at as string | null, date: session.date as string } : null)
  const plan = lighter ? { ...planned, slots: lightenPlan(planned.slots) } : planned
  const sets = session ? (await store.where('set_logs', 'session_id', session.id)).map(toSet) : []
  sets.sort((a, b) => a.loggedAt.localeCompare(b.loggedAt))
  return {
    programId: row.id,
    programName: String(row.name),
    stateId: state.id,
    pointer,
    completed: pointer.completed,
    label: blockWeekLabel(plan),
    blocks: engine.blocks,
    plan,
    exercises,
    session: session ? { id: session.id, startedAt: String(session.started_at), sets } : null,
  }
}

/** Nis stërvitjen e radhës, ose kthen atë që është nisur. */
export async function startWorkout(store: LocalStore): Promise<string> {
  const loaded = await activeProgram(store)
  if (!loaded) throw new Error('Nuk ka program aktiv.')
  const { row, state, pointer } = loaded
  const open = await openSession(store, row.id, pointer)
  if (open) return open.id
  // Nisja e stërvitjes në një ditë të shtyrë e anulon shtyrjen (V50): nesër nuk ka dy stërvitje.
  await (await import('./day-choice')).cancelPostponement(store)
  const startedAt = store.now()
  const session = await store.put('workout_sessions', {
    program_id: row.id,
    run: pointer.run,
    block_id: pointer.blockId,
    week: pointer.week,
    day_id: pointer.dayId,
    date: localDate(startedAt),
    status: 'in_progress',
    started_at: startedAt.toISOString(),
  })
  if (!state.started_at) await store.put('program_state', { id: state.id, started_at: startedAt.toISOString() })
  return session.id
}

/**
 * Seanca e stërvitjes së radhës në një datë të dhënë (kutia e AI-së, V2-E2-14: "dje bëra…"): ajo e nisur,
 * ose një e re me atë datë. Pa program aktiv, null.
 */
export async function sessionForNext(store: LocalStore, date: string): Promise<string | null> {
  const loaded = await activeProgram(store)
  if (!loaded || loaded.pointer.completed) return null
  const { row, state, pointer } = loaded
  const open = await openSession(store, row.id, pointer)
  if (open) return open.id
  const now = store.now()
  const startedAt = date === localDate(now) ? now : new Date(`${date}T12:00:00`)
  const session = await store.put('workout_sessions', {
    program_id: row.id,
    run: pointer.run,
    block_id: pointer.blockId,
    week: pointer.week,
    day_id: pointer.dayId,
    date,
    status: 'in_progress',
    started_at: startedAt.toISOString(),
  })
  if (!state.started_at) await store.put('program_state', { id: state.id, started_at: startedAt.toISOString() })
  return session.id
}

export interface SetInput {
  /** Për të ndryshuar një set të ruajtur (p.sh. për t'i shtuar segmentin e rest-pause). */
  id?: string
  /**
   * Id-ja e një seti të ri, kur ekrani e shfaq para se baza ta ruajë (V58, "Zhbëj"); një set që ekziston
   * për të njëjtin slot dhe numër e mban id-në e vet.
   */
  newId?: string
  sessionId: string
  /** slotId null: ushtrim shtesë jashtë stërvitjes (kutia e AI-së, V2-E2-14), i njohur nga ushtrimi. */
  slot: Pick<PlannedSlot, 'exerciseId' | 'position'> & { slotId: string | null }
  setNumber: number
  weightKg?: number | null
  reps?: number | null
  seconds?: number | null
  rir?: number | null
  rpe?: number | null
  technique?: Technique['type']
  segments?: Segment[]
  notes?: string | null
  /** Koha e prekjes kur seti ruhet më vonë se ajo (seti nga njoftimi, V2-E1-08); përndryshe tani. */
  loggedAt?: string
}

export async function saveSet(store: LocalStore, input: SetInput) {
  // Një set për seancë, slot dhe numër: një prekje e dytë ose një ekran i vonuar e ndryshon, nuk e dyfishon.
  const existing = input.id
    ? await store.get('set_logs', input.id)
    : (await store.where('set_logs', 'session_id', input.sessionId)).find(
        (row) =>
          (row.slot_id ?? null) === input.slot.slotId &&
          (input.slot.slotId !== null || row.exercise_id === input.slot.exerciseId) &&
          Number(row.set_number) === input.setNumber,
      )
  return toSet(
    await store.put('set_logs', {
      id: existing?.id ?? input.id ?? input.newId,
      session_id: input.sessionId,
      slot_id: input.slot.slotId,
      exercise_id: input.slot.exerciseId,
      position: input.slot.position,
      set_number: input.setNumber,
      weight_kg: input.weightKg ?? null,
      reps: input.reps ?? null,
      seconds: input.seconds ?? null,
      rir: input.rir ?? null,
      rpe: input.rpe ?? null,
      technique: input.technique ?? 'none',
      segments:
        input.segments === undefined
          ? (existing?.segments ?? null)
          : input.segments.length
            ? input.segments.map((segment) => ({ weight_kg: segment.weightKg, reps: segment.reps }))
            : null,
      notes: input.notes ?? null,
      logged_at: existing?.logged_at ?? input.loggedAt ?? store.now().toISOString(),
    }),
  )
}

/**
 * "Zhbëj" te seanca (SPEC §0.3g, V58): heq setin e sapo ruajtur me fshirje të butë, që fshirja të arrijë
 * edhe në Supabase; pas një segmenti heq vetëm segmentin, dhe seti pret segmentin përsëri. Rekordet,
 * peshat dhe njoftimi i seancës e rillogarisin vetë nga setet. Një set që s'ekziston nuk prish asgjë.
 */
export async function undoSet(store: LocalStore, id: string, { segment = false }: { segment?: boolean } = {}) {
  const row = await store.get('set_logs', id)
  if (!row) return
  if (segment) await store.put('set_logs', { id, segments: null })
  else await store.remove('set_logs', id)
}

/** Treguesi kalon përpara; pas stërvitjes së fundit programi shënohet "Përfunduar". */
async function moveForward(store: LocalStore, loaded: NonNullable<Awaited<ReturnType<typeof activeProgram>>>, at: Date) {
  const next = advance(loaded.engine, loaded.pointer)
  await store.put('program_state', {
    id: loaded.state.id,
    run: next.run,
    block_id: next.blockId,
    week: next.week,
    day_id: next.dayId,
    completed_at: next.completed ? at.toISOString() : null,
  })
}

/** Mbyll stërvitjen dhe e çon treguesin te e radha. */
export async function finishWorkout(store: LocalStore, sessionId: string) {
  const loaded = await activeProgram(store)
  const session = await store.get('workout_sessions', sessionId)
  if (!loaded || !session || session.status !== 'in_progress') return
  const at = store.now()
  await store.put('workout_sessions', { id: sessionId, status: 'completed', ended_at: at.toISOString() })
  await moveForward(store, loaded, at)
}

/** "Kapërce këtë stërvitje": vetëm me dorë, kurrë vetvetiu (§4). */
export async function skipWorkout(store: LocalStore) {
  const loaded = await activeProgram(store)
  if (!loaded || loaded.pointer.completed) return
  const at = store.now()
  const open = await openSession(store, loaded.row.id, loaded.pointer)
  const values = { status: 'skipped', ended_at: at.toISOString() }
  if (open) await store.put('workout_sessions', { id: open.id, ...values })
  else {
    const { pointer } = loaded
    await store.put('workout_sessions', {
      program_id: loaded.row.id,
      run: pointer.run,
      block_id: pointer.blockId,
      week: pointer.week,
      day_id: pointer.dayId,
      date: localDate(at),
      ...values,
    })
  }
  await moveForward(store, loaded, at)
}

/** Rinis programin e përfunduar nga një bllok (Shortcut to Size: Faza 1), si xhiro e re. */
export async function restartProgram(store: LocalStore, blockId: string) {
  const loaded = await activeProgram(store)
  if (!loaded) return
  const next = restart(loaded.engine, loaded.pointer, blockId)
  await store.put('program_state', {
    id: loaded.state.id,
    run: next.run,
    block_id: next.blockId,
    week: next.week,
    day_id: next.dayId,
    started_at: null,
    completed_at: null,
  })
}

/** Treguesi i programit te java 1 e bllokut të parë, dita e parë, kur programi s'ka ende një. */
export async function ensureProgramState(store: LocalStore, programId: string) {
  const [state] = await store.where('program_state', 'program_id', programId)
  if (state) return
  const [block] = (await store.where('program_blocks', 'program_id', programId)).sort(byPosition)
  const [day] = (await store.where('program_days', 'program_id', programId)).sort(byPosition)
  await store.put('program_state', { program_id: programId, run: 1, block_id: block?.id ?? null, week: 1, day_id: day?.id ?? null })
}

/** Programi aktiv ndërrohet; secili mban historinë dhe treguesin e vet. */
export async function switchProgram(store: LocalStore, programId: string) {
  const row = await settings(store)
  await ensureProgramState(store, programId)
  await store.put('user_settings', { id: row?.id, active_program_id: programId })
}

/**
 * Ushtrimi i bibliotekës si ushtrim i përdoruesit, një herë për çdo ushtrim të bibliotekës. Një
 * ushtrim me të njëjtin emër (p.sh. nga Shortcut to Size) ripërdoret, që historia të mbetet bashkë.
 */
export async function exerciseFromLibrary(store: LocalStore, library: LibraryExercise) {
  const [existing] = await store.where('exercises', 'library_id', library.id)
  if (existing) return existing.id
  const sameName = (await store.all('exercises')).find((row) => String(row.name).toLowerCase() === library.name.toLowerCase())
  if (sameName) return sameName.id
  const row = await store.put('exercises', {
    library_id: library.id,
    name: library.name,
    equipment: library.equipment,
    tracking: library.equipment === 'bodyweight' ? 'bodyweight_reps' : 'weight_reps',
    primary_muscles: muscleKeys(library.primary),
    secondary_muscles: muscleKeys(library.secondary).filter((key) => !muscleKeys(library.primary).includes(key)),
  })
  return row.id
}

/**
 * "Ndrysho ushtrimin për këtë fazë" (§6): ushtrimi i ri zë vendin e të tanishmit në çdo javë të
 * bllokut ku sloti e ka këtë ushtrim. Blloqet e tjera dhe seancat e kaluara nuk ndryshojnë.
 */
export async function replaceExerciseForBlock(
  store: LocalStore,
  change: { plan: SessionPlan; slotId: string } & ({ exerciseId: string } | { library: LibraryExercise }),
) {
  const loaded = await activeProgram(store)
  if (!loaded) return
  const { plan, slotId } = change
  const current = plan.slots.find((slot) => slot.slotId === slotId)?.exerciseId
  const exerciseId = 'library' in change ? await exerciseFromLibrary(store, change.library) : change.exerciseId
  const weeks = Array.from({ length: plan.blockWeeks }, (_, index) => index + 1)
  const sameIn = weeks.filter((week) => {
    const weekPlan = planSession(loaded.engine, { ...loaded.pointer, blockId: plan.blockId, week, dayId: plan.dayId })
    return weekPlan.slots.find((slot) => slot.slotId === slotId)?.exerciseId === current
  })
  const scopes = sameIn.length === weeks.length ? [null] : sameIn
  const rows = await store.where('slot_prescriptions', 'slot_id', slotId)
  for (const week of scopes) {
    const row = rows.find((candidate) => candidate.block_id === plan.blockId && (candidate.week ?? null) === week)
    await store.put('slot_prescriptions', {
      id: row?.id,
      program_id: loaded.row.id,
      slot_id: slotId,
      block_id: plan.blockId,
      week,
      exercise_id: exerciseId,
    })
  }
}

export interface TrainingHistory {
  sets: HistorySet[]
  worked: WorkedSession[]
  overrides: Record<string, { oneRmKg: number; setAt: string }>
  weightSteps: Partial<Record<Equipment, number>>
}

/** Historia e të gjitha stërvitjeve, për 1RM-në, referencat, rekordet dhe rikuperimin. */
export async function trainingHistory(store: LocalStore): Promise<TrainingHistory> {
  const [sessions, blocks, setRows, exerciseRows, overrideRows, row] = await Promise.all([
    store.all('workout_sessions'),
    store.all('program_blocks'),
    store.all('set_logs'),
    store.all('exercises'),
    store.all('one_rm_overrides'),
    settings(store),
  ])
  const sessionById = new Map(sessions.map((session) => [session.id, session]))
  const blockById = new Map(blocks.map((block) => [block.id, block]))
  const primary = new Map(exerciseRows.map((exercise) => [exercise.id, (exercise.primary_muscles as string[] | undefined) ?? []]))
  const sets: HistorySet[] = []
  for (const set of setRows) {
    const session = sessionById.get(String(set.session_id))
    if (!session) continue
    const block = blockById.get(String(session.block_id))
    sets.push({
      id: set.id,
      exerciseId: String(set.exercise_id),
      sessionId: session.id,
      run: Number(session.run ?? 1),
      blockPosition: Number(block?.position ?? 0),
      blockName: String(block?.name ?? ''),
      blockWeeks: Number(block?.weeks ?? 1),
      week: Number(session.week ?? 1),
      setNumber: Number(set.set_number),
      weightKg: numberOrNull(set.weight_kg),
      reps: numberOrNull(set.reps),
      rir: numberOrNull(set.rir),
      isWarmup: Boolean(set.is_warmup),
      loggedAt: String(set.logged_at),
    })
  }
  sets.sort((a, b) => a.loggedAt.localeCompare(b.loggedAt))
  const worked = sessions
    .filter((session) => session.status === 'completed' && session.ended_at)
    .sort((a, b) => String(a.ended_at).localeCompare(String(b.ended_at)))
    .map((session) => ({
      endedAt: String(session.ended_at),
      primaryKeys: [...new Set(sets.filter((set) => set.sessionId === session.id).flatMap((set) => primary.get(set.exerciseId) ?? []))],
    }))
  const overrides: TrainingHistory['overrides'] = {}
  for (const override of overrideRows.sort((a, b) => String(a.set_at).localeCompare(String(b.set_at)))) {
    overrides[String(override.exercise_id)] = { oneRmKg: Number(override.one_rm_kg), setAt: String(override.set_at) }
  }
  return { sets, worked, overrides, weightSteps: (row?.weight_steps as TrainingHistory['weightSteps'] | undefined) ?? {} }
}

export interface ProgramView {
  programId: string
  programName: string
  pointer: Pointer
  overview: ProgramOverview
  exercises: Record<string, ExerciseRecord>
  /** Plani i çdo stërvitjeje të programit, jo vetëm i asaj të radhës. */
  plan: (blockId: string, week: number, dayId: string) => SessionPlan
}

/** Programi aktiv javë pas jave, për ekranin Programi. */
export async function programView(store: LocalStore): Promise<ProgramView | null> {
  const loaded = await activeProgram(store)
  if (!loaded) return null
  const sessions = await store.where('workout_sessions', 'program_id', loaded.row.id)
  const marks: SessionMark[] = sessions.map((session) => ({
    run: Number(session.run ?? 1),
    blockId: String(session.block_id),
    week: Number(session.week),
    dayId: String(session.day_id),
    status: session.status as SessionMark['status'],
  }))
  const { engine, pointer } = loaded
  return {
    programId: loaded.row.id,
    programName: String(loaded.row.name),
    pointer,
    overview: programOverview(engine, pointer, marks),
    exercises: loaded.exercises,
    plan: (blockId, week, dayId) => planSession(engine, { ...pointer, blockId, week, dayId, completed: false }),
  }
}

/** Link-u i videos së ushtrimit; null e heq. */
export async function setExerciseVideo(store: LocalStore, exerciseId: string, url: string | null) {
  await store.put('exercises', { id: exerciseId, video_url: url })
}

export interface SummaryRecord {
  exerciseId: string
  exerciseName: string
  setId: string
  setNumber: number
  weightKg: number
  reps: number
  e1rmKg: number
  previousBestKg: number
  gainKg: number
}

export interface SessionSummary {
  id: string
  status: string
  run: number
  /** "Java 0", "Faza 1", siç ruhet te blloku (emri sipas gjuhës: `programBlockName`). */
  blockName: string
  blockWeeks: number
  /** Java brenda bllokut, nga 1. */
  week: number
  /** "Stërvitja N". */
  dayNumber: number
  dayName: string
  startedAt: string | null
  endedAt: string | null
  /** Nga fillimi te mbyllja; null kur seanca s'ka të dyja ose u shënua më pas (V74). */
  durationSeconds: number | null
  /** Setet e regjistruara pa ngrohjet; segmentet janë pjesë e setit të tyre. */
  workSets: number
  /** Rekordet e e1RM-së kundrejt historisë para seancës (si te historiku), më i madhi i pari. */
  records: SummaryRecord[]
  /**
   * Volumi javor i grupit me më shumë sete në seancë (kryesori 1, ndihmësi 0,5; SPEC §11): java
   * kalendarike deri te mbyllja e seancës dhe pjesa e vetë seancës. Null pa sete pune.
   */
  volume: { groupId: string; week: number; today: number } | null
}

/** Grupi kryesor i seancës (`sessionVolume` i historikut), me volumin e javës deri te mbyllja e saj. */
function weekVolume(history: HistorySet[], sessionId: string, exercises: LocalRow[], at: Date): SessionSummary['volume'] {
  const primary = Object.fromEntries(exercises.map((row) => [row.id, (row.primary_muscles as string[] | undefined) ?? []]))
  const secondary = Object.fromEntries(exercises.map((row) => [row.id, (row.secondary_muscles as string[] | undefined) ?? []]))
  const muscles = Object.fromEntries(exercises.map((row) => [row.id, { primary: primary[row.id], secondary: secondary[row.id] }]))
  const mine = history.filter((set) => set.sessionId === sessionId && !set.isWarmup)
  const [top] = sessionVolume(mine, muscles, MUSCLE_GROUPS)
  const group = MUSCLE_GROUPS.find((candidate) => candidate.id === top?.groupId)
  if (!top || !group) return null
  const until = history.filter((set) => set.loggedAt <= at.toISOString())
  return { groupId: group.id, week: muscleLoad(until, primary, secondary, [group], at).get(group.id) ?? 0, today: top.sets }
}

/** Mbyllja e seancës (bordi "Mbyll"): stërvitja, kohëzgjatja, setet e punës, rekordet dhe volumi i javës. */
export async function sessionSummary(store: LocalStore, sessionId: string): Promise<SessionSummary | null> {
  const session = await store.get('workout_sessions', sessionId)
  if (!session) return null
  const [block, days, sets, exercises, history] = await Promise.all([
    store.get('program_blocks', String(session.block_id)),
    store.where('program_days', 'program_id', String(session.program_id)),
    store.where('set_logs', 'session_id', sessionId),
    store.all('exercises'),
    trainingHistory(store),
  ])
  const ordered = days.sort(byPosition)
  const dayIndex = ordered.findIndex((day) => day.id === session.day_id)
  const names = new Map(exercises.map((row) => [row.id, String(row.name)]))
  const byId = new Map(history.sets.map((set) => [set.id, set]))
  const startedAt = (session.started_at as string | null | undefined) ?? null
  const endedAt = (session.ended_at as string | null | undefined) ?? null
  return {
    id: session.id,
    status: String(session.status),
    run: Number(session.run ?? 1),
    blockName: String(block?.name ?? ''),
    blockWeeks: Number(block?.weeks ?? 1),
    week: Number(session.week ?? 1),
    dayNumber: dayIndex + 1,
    dayName: String(ordered[dayIndex]?.name ?? ''),
    startedAt,
    endedAt,
    // Fillim dhe mbyllje në të njëjtën orë: stërvitje e shënuar më pas (V74), pa kohëzgjatje të matur.
    durationSeconds: startedAt && endedAt && startedAt !== endedAt ? Math.max(0, Math.round((Date.parse(endedAt) - Date.parse(startedAt)) / 1000)) : null,
    workSets: sets.filter((set) => !set.is_warmup).length,
    records: sessionBests(history.sets, sessionId).map((record) => {
      const set = byId.get(record.setId)
      return {
        exerciseId: record.exerciseId,
        exerciseName: names.get(record.exerciseId) ?? '',
        setId: record.setId,
        setNumber: set?.setNumber ?? 0,
        weightKg: set?.weightKg ?? 0,
        reps: set?.reps ?? 0,
        e1rmKg: record.e1rmKg,
        previousBestKg: record.previousBestKg,
        gainKg: record.gainKg,
      }
    }),
    volume: weekVolume(history.sets, sessionId, exercises, new Date(endedAt ?? store.now().toISOString())),
  }
}
