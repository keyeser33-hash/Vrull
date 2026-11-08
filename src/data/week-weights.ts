import { blockWeekLabel } from '@/program/engine'
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

// Peshat e javës (V23) mbi bazën lokale: propozimi i §7 për javën që shqyrtohet dhe vendimi i
// përdoruesit (pranoi, ndryshoi, la për më vonë), i ruajtur te `week_weights`. Pesha e javës e një
// sloti del vetëm nga këtu (`workoutWeights` për një stërvitje), për çdo ekran (V2-E1-18).

export interface WeekWeightsView {
  programId: string
  run: number
  week: WeekRef
  /** "Faza 1 · Java 3". */
  label: string
  rows: WeekWeightRow[]
}

/** Peshat e javës që shqyrtohet (ose e javës së dhënë) të programit aktiv. */
export async function weekWeightsView(store: LocalStore, week?: WeekRef): Promise<WeekWeightsView | null> {
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
    history: open ? history.sets.filter((set) => set.sessionId !== open.id) : history.sets,
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
  return {
    programId: loaded.row.id,
    run,
    week: target,
    label: blockWeekLabel({ blockName: block.name, blockWeeks: block.weeks, week: target.week }),
    rows,
  }
}

/**
 * Pesha e javës e çdo sloti me peshë të një stërvitjeje (V23, SPEC §7): vendimi te `week_weights`
 * (pranuar, ndryshuar, "Më vonë"), përndryshe propozimi i §7, që për ushtrimin me histori pa e1RM
 * është pesha e fundit (§0.3a). I vetmi lexim i saj për Sot, seancën, Programin dhe njoftimin e
 * seancës (E1-08), sipas slotit.
 */
export async function workoutWeights(store: LocalStore, plan: WeekRef & { dayId: string }): Promise<Map<string, WeekWeightRow>> {
  const view = await weekWeightsView(store, { blockId: plan.blockId, week: plan.week })
  return new Map((view?.rows ?? []).filter((row) => row.dayId === plan.dayId).map((row) => [row.slotId, row]))
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
export async function weekWeightId(key: { programId: string; run: number; blockId: string; week: number; slotId: string }): Promise<string> {
  const text = ['week_weights', key.programId, key.run, key.blockId, key.week, key.slotId].join('|')
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))).slice(0, 16)
  hash[6] = (hash[6] & 0x0f) | 0x80
  hash[8] = (hash[8] & 0x3f) | 0x80
  const hex = [...hash].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** Shkruan vendimet e javës; një slot ka një rresht për javë, që ndryshohet, nuk dyfishohet. */
async function save(store: LocalStore, view: WeekWeightsView, decisions: WeekWeightDecision[]) {
  const existing = await decisionRows(store, view.programId, view.run, view.week)
  for (const decision of decisions) {
    const key = { programId: view.programId, run: view.run, blockId: view.week.blockId, week: view.week.week, slotId: decision.slotId }
    await store.put('week_weights', {
      id: existing.find((row) => row.slot_id === decision.slotId)?.id ?? (await weekWeightId(key)),
      program_id: view.programId,
      run: view.run,
      block_id: view.week.blockId,
      week: view.week.week,
      slot_id: decision.slotId,
      exercise_id: decision.exerciseId,
      weight_kg: decision.weightKg,
      status: decision.status,
    })
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
