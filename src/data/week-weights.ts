import { localDate } from '@/lib/calendar'
import { weightStep } from '@/program/loads'
import type { ProgramWeek } from '@/program/types'
import { lighterWeight } from '@/progress/weekly-goals'
import {
  acceptAll,
  postpone,
  type WeekRef,
  type WeekWeightDecision,
  type WeekWeightRow,
  weekToReview,
  weekWeights,
} from '@/progress/week-weights'
import type { LocalStore } from './store'
import { activeProgram, openSession, trainingHistory } from './training'
import { naturalId } from './natural-id'
import { lightenWeights } from '@/readiness/lighter-session'
import { lighterDates, lighterDay } from './lighter-day'
import { lighterFirstSession } from './welcome-back'

// Peshat e javës (V23) mbi bazën lokale: propozimi i §7 për javën që shqyrtohet dhe vendimi i
// përdoruesit (pranoi, ndryshoi, la për më vonë), i ruajtur te `week_weights`. Pesha e javës e një
// sloti del vetëm nga këtu (`workoutWeights` për një stërvitje), për çdo ekran (V2-E1-18).

export interface WeekWeightsView {
  programId: string
  run: number
  week: WeekRef
  /** Blloku dhe java; teksti në gjuhën e app-it vjen nga `programWeekLabel`. */
  block: ProgramWeek
  rows: WeekWeightRow[]
}

/** Peshat e javës që shqyrtohet (ose e javës së dhënë) të programit aktiv. */
export async function weekWeightsView(store: LocalStore, week?: WeekRef): Promise<WeekWeightsView | null> {
  return (await readWeek(store, week))?.view ?? null
}

/** Pamja e peshave të javës, me programin dhe historinë nga u llogarit. */
async function readWeek(store: LocalStore, week?: WeekRef) {
  const loaded = await activeProgram(store)
  if (!loaded) return null
  const target = week ?? weekToReview(loaded.engine, loaded.pointer)
  const block = loaded.engine.blocks.find((candidate) => candidate.id === target?.blockId)
  if (!target || !block) return null
  const run = loaded.pointer.run
  const [history, saved, open, sessions] = await Promise.all([
    trainingHistory(store),
    decisionRows(store, loaded.row.id, run, target),
    openSession(store, loaded.row.id, loaded.pointer),
    store.where('workout_sessions', 'program_id', loaded.row.id),
  ])
  // Seanca më e lehtë (V50) nuk është dështim: pesha e saj e ulur dhe setet më pak nuk e ulin propozimin e
  // peshës së radhës, ndaj setet e saj nuk hyjnë te propozimet (rekordet dhe e1RM-ja e historikut mbeten).
  const lighterOn = await lighterDates(store)
  const lighterSessions = new Set((await store.all('workout_sessions')).filter((row) => lighterOn.has(String(row.date).slice(0, 10))).map((row) => row.id))
  // Seanca e parë e javës që shqyrtohet, në këtë xhiro: rregulli i progresit lexon vetëm setet para saj.
  const weekStarts = sessions
    .filter((row) => Number(row.run) === run && row.block_id === target.blockId && Number(row.week) === target.week && row.started_at)
    .map((row) => String(row.started_at))
    .sort()
  const rows = weekWeights({
    program: loaded.engine,
    week: target,
    // Setet e seancës së hapur nuk e lëvizin peshën e javës: seti i dytë i Bench Press nuk e ndryshon
    // atë që Sot dhe Programi thanë për të para seancës. Pas mbylljes hyjnë te historia.
    history: history.sets.filter((set) => set.sessionId !== open?.id && !lighterSessions.has(set.sessionId)),
    weekStartedAt: weekStarts[0] ?? null,
    now: store.now(),
    overrides: history.overrides,
    steps: history.weightSteps,
    decisions: saved.map(
      (row): WeekWeightDecision => ({
        slotId: String(row.slot_id),
        exerciseId: String(row.exercise_id),
        weightKg: Number(row.weight_kg),
        status: row.status as WeekWeightDecision['status'],
      }),
    ),
  })
  const view: WeekWeightsView = {
    programId: loaded.row.id,
    run,
    week: target,
    block: { blockName: block.name, blockWeeks: block.weeks, week: target.week, run },
    rows,
  }
  return { view, loaded, history, open }
}

export interface WorkoutWeight extends WeekWeightRow {
  /**
   * Pesha e javës kur "Seanca e parë më e lehtë" (V43) e ul `weightKg` në 90%; null kur `weightKg` është
   * vetë pesha e javës. Sot e thotë "55 × 12–15 në vend të 62,5".
   */
  weekKg: number | null
}

/**
 * Pesha e javës e çdo sloti me peshë të një stërvitjeje (V23, SPEC §7): vendimi te `week_weights`
 * (pranuar, ndryshuar, "Më vonë"), përndryshe propozimi i §7, që për ushtrimin me histori pa e1RM
 * është pesha e fundit (§0.3a). I vetmi lexim i saj për Sot, seancën, Programin dhe njoftimin e
 * seancës (E1-08), sipas slotit. Për stërvitjen e radhës pas 7 ditësh pa seancë ("Mirë se u ktheve",
 * me çelësin të ndezur) pesha është 90% e saj, poshtë sipas hapit të pajisjes, derisa ajo mbyllet; me
 * seancën të hapur ditët dhe çelësi maten në datën e saj.
 */
export async function workoutWeights(store: LocalStore, plan: WeekRef & { dayId: string }): Promise<Map<string, WorkoutWeight>> {
  const read = await readWeek(store, { blockId: plan.blockId, week: plan.week })
  const rows = (read?.view.rows ?? []).filter((row) => row.dayId === plan.dayId)
  const pointer = read?.loaded.pointer
  const next = !!pointer && !pointer.completed && pointer.blockId === plan.blockId && pointer.week === plan.week && pointer.dayId === plan.dayId
  // Me seancën të hapur vendos data e saj, jo ora: peshat nuk ndryshojnë kur kalon mesnata (rishikimi i 0.23).
  const day = read?.open?.date ? String(read.open.date).slice(0, 10) : localDate(store.now())
  const lighter = next && rows.length > 0 && (await lighterFirstSession(store, day))
  const steps = read?.history.weightSteps ?? {}
  const weights = rows.map((row): WorkoutWeight => {
    const equipment = read?.loaded.exercises[row.exerciseId]?.equipment
    if (!lighter || row.weightKg === null || !equipment) return { ...row, weekKg: null }
    const weightKg = lighterWeight(row.weightKg, weightStep(equipment, steps))
    return { ...row, weightKg, weekKg: weightKg === row.weightKg ? null : row.weightKg }
  })
  // "Seanca më e lehtë" (V50): pesha × 0,9 pa RIR, e njëjta rregull si setet (`lighterSlots`); me "Mirë se u ktheve"
  // pesha është ulur tashmë dhe nuk ulet përsëri. Vlen për stërvitjen e ditës, jo për ditë të tjera të planit.
  if (next && weights.length > 0 && (await lighterDay(store, read?.open?.date as string | undefined))) {
    const lightened = lightenWeights(
      weights.map((row) => ({
        sets: row.sets,
        target: row.target,
        weightKg: row.weightKg,
        stepKg: weightStep(read?.loaded.exercises[row.exerciseId]?.equipment ?? 'other', steps),
      })),
      { welcomeBack: lighter },
    )
    return new Map(
      weights.map((row, index): [string, WorkoutWeight] => {
        const weightKg = lightened[index]
        return [row.slotId, { ...row, weightKg, weekKg: weightKg !== row.weightKg && row.weightKg !== null ? (row.weekKg ?? row.weightKg) : row.weekKg }]
      }),
    )
  }
  return new Map(weights.map((row): [string, WorkoutWeight] => [row.slotId, row]))
}

/** Vendimet e ruajtura për një javë të programit, në këtë xhiro. */
async function decisionRows(store: LocalStore, programId: string, run: number, week: WeekRef) {
  return (await store.where('week_weights', 'program_id', programId)).filter(
    (row) => Number(row.run) === run && row.block_id === week.blockId && Number(row.week) === week.week,
  )
}

/**
 * Id-ja e vendimit të një sloti për një javë, nga java dhe sloti (UUID versioni 8 nga SHA-256): dy vendime
 * njëkohësisht, në një telefon ose në dy, ndryshojnë të njëjtin rresht në vend që të krijojnë dy, që indeksi
 * unik i serverit do t'i refuzonte (sinkronizimi do të mbetej me një ndryshim të papranuar).
 */
export function weekWeightId(key: { programId: string; run: number; blockId: string; week: number; slotId: string }): Promise<string> {
  return naturalId(['week_weights', key.programId, key.run, key.blockId, key.week, key.slotId])
}

/** Shkruan vendimet e javës; një slot ka një rresht për javë, që ndryshohet, nuk dyfishohet. */
async function save(store: LocalStore, view: WeekWeightsView, decisions: WeekWeightDecision[]) {
  const existing = await decisionRows(store, view.programId, view.run, view.week)
  for (const decision of decisions) {
    const key = { programId: view.programId, run: view.run, blockId: view.week.blockId, week: view.week.week, slotId: decision.slotId }
    const row = {
      id: existing.find((saved) => saved.slot_id === decision.slotId)?.id ?? (await weekWeightId(key)),
      program_id: view.programId,
      run: view.run,
      block_id: view.week.blockId,
      week: view.week.week,
      slot_id: decision.slotId,
      exercise_id: decision.exerciseId,
      weight_kg: decision.weightKg,
      status: decision.status,
    }
    // Id-ja vjen nga java dhe sloti: një vendim pas fshirjes së të mëparshmit e kthen rreshtin.
    await store.put('week_weights', row, { revive: true })
  }
}

/** "Prano të gjitha": peshat e propozuara bëhen peshat e javës, përveç atyre që përdoruesi ndryshoi. */
export async function acceptWeekWeights(store: LocalStore, week: WeekRef) {
  const view = await weekWeightsView(store, week)
  if (view) await save(store, view, acceptAll(view.rows))
}

/** "Më vonë": java mban peshat e javës së kaluar; propozimi mbetet për t'u pranuar më vonë. */
export async function postponeWeekWeights(store: LocalStore, week: WeekRef) {
  const view = await weekWeightsView(store, week)
  if (view) await save(store, view, postpone(view.rows))
}

/** Pesha e një sloti për javën, e zgjedhur nga përdoruesi. */
export async function changeWeekWeight(store: LocalStore, week: WeekRef, slotId: string, weightKg: number) {
  const view = await weekWeightsView(store, week)
  const row = view?.rows.find((candidate) => candidate.slotId === slotId)
  if (!view || !row) throw new Error('Ushtrimi nuk është në këtë javë.')
  await save(store, view, [{ slotId, exerciseId: row.exerciseId, weightKg, status: 'changed' }])
}
