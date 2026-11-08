import { planSession } from '@/program/engine'
import type { LibraryExercise } from '@/program/library'
import { type Scope, slotRules, type SlotRules } from '@/program/rules'
import type { Block, Prescription, Program, ProgressionRule, SessionPlan, Technique } from '@/program/types'
import type { LocalStore } from './store'
import type { LocalRow } from './tables'
import { exerciseFromLibrary, type ExerciseRecord, programModel } from './training'

// Editori i programeve (SPEC §4, TH-11): krijo, kopjo dhe ndrysho programe, blloqe, ditë,
// slote dhe rregullat e tyre sipas bllokut dhe javës. Çdo veprim shkruan përmes store-it; motori
// (src/program/engine.ts) i lexon rregullat. Ndryshimet vlejnë nga stërvitja e radhës: seancat
// e kaluara ruajnë ushtrimet dhe setet e tyre.

const byPosition = (a: LocalRow, b: LocalRow) => Number(a.position) - Number(b.position)

async function rows(store: LocalStore, table: 'program_blocks' | 'program_days', programId: string) {
  return (await store.where(table, 'program_id', programId)).sort(byPosition)
}

/** Pozicionet 0..n-1 pas një heqjeje ose lëvizjeje. */
async function renumber(store: LocalStore, table: 'program_blocks' | 'program_days' | 'program_slots', ordered: LocalRow[]) {
  for (const [position, row] of ordered.entries()) {
    if (Number(row.position) !== position) await store.put(table, { id: row.id, position })
  }
}

/** Treguesi i programit drejt një blloku dhe një dite që ekzistojnë (pas shtimit ose heqjes së tyre). */
async function repairState(store: LocalStore, programId: string) {
  const [state] = await store.where('program_state', 'program_id', programId)
  if (!state) return
  const blocks = await rows(store, 'program_blocks', programId)
  const days = await rows(store, 'program_days', programId)
  const blockOk = blocks.some((block) => block.id === state.block_id)
  const dayOk = days.some((day) => day.id === state.day_id)
  if (blockOk && dayOk) return
  await store.put('program_state', {
    id: state.id,
    block_id: blockOk ? state.block_id : (blocks[0]?.id ?? null),
    week: blockOk ? state.week : 1,
    day_id: dayOk ? state.day_id : (days[0]?.id ?? null),
  })
}

export async function createProgram(store: LocalStore, name: string): Promise<string> {
  return (await store.put('programs', { name: name.trim(), source: 'custom' })).id
}

export async function renameProgram(store: LocalStore, programId: string, name: string) {
  await store.put('programs', { id: programId, name: name.trim() })
}

/** Kopje e plotë: blloqet, ditët, slotet dhe rregullat, me id të reja; pa historinë. */
export async function duplicateProgram(store: LocalStore, programId: string, name: string): Promise<string> {
  const copy = await createProgram(store, name)
  const blockIds = new Map<string, string>()
  for (const block of await rows(store, 'program_blocks', programId)) {
    blockIds.set(block.id, (await store.put('program_blocks', { program_id: copy, position: block.position, name: block.name, weeks: block.weeks })).id)
  }
  const dayIds = new Map<string, string>()
  for (const day of await rows(store, 'program_days', programId)) {
    dayIds.set(day.id, (await store.put('program_days', { program_id: copy, position: day.position, name: day.name })).id)
  }
  const slotIds = new Map<string, string>()
  for (const slot of await store.where('program_slots', 'program_id', programId)) {
    const created = await store.put('program_slots', {
      program_id: copy,
      day_id: dayIds.get(String(slot.day_id)),
      position: slot.position,
      exercise_id: slot.exercise_id,
      sets: slot.sets,
      rest_seconds: slot.rest_seconds,
      notes: slot.notes ?? null,
    })
    slotIds.set(slot.id, created.id)
  }
  const rules = await store.where('slot_prescriptions', 'program_id', programId)
  await store.insertMany(
    'slot_prescriptions',
    rules.map((rule) => ({
      ...ruleValues(rule),
      program_id: copy,
      slot_id: slotIds.get(String(rule.slot_id)),
      block_id: rule.block_id ? blockIds.get(String(rule.block_id)) : null,
      week: rule.week ?? null,
    })),
  )
  return copy
}

/** Heq programin dhe gjithçka të tij (jo seancat e kaluara). Programi aktiv nuk fshihet. */
export async function deleteProgram(store: LocalStore, programId: string) {
  const [settings] = await store.all('user_settings')
  if (settings?.active_program_id === programId) throw new Error('Programi aktiv nuk fshihet. Zgjidh një tjetër më parë.')
  for (const table of ['slot_prescriptions', 'program_slots', 'program_days', 'program_blocks', 'program_state'] as const) {
    for (const row of await store.where(table, 'program_id', programId)) await store.remove(table, row.id)
  }
  await store.remove('programs', programId)
}

export async function addBlock(store: LocalStore, programId: string, block: { name: string; weeks: number }): Promise<string> {
  const position = (await rows(store, 'program_blocks', programId)).length
  const id = (await store.put('program_blocks', { program_id: programId, position, name: block.name.trim(), weeks: block.weeks })).id
  await repairState(store, programId)
  return id
}

/** Emri ose javët e bllokut. Kur blloku shkurtohet, treguesi brenda tij kalon te java e fundit. */
export async function updateBlock(store: LocalStore, blockId: string, changes: { name?: string; weeks?: number }) {
  const block = await store.put('program_blocks', {
    id: blockId,
    ...(changes.name ? { name: changes.name.trim() } : {}),
    ...(changes.weeks ? { weeks: changes.weeks } : {}),
  })
  if (!changes.weeks) return
  const [state] = await store.where('program_state', 'program_id', String(block.program_id))
  if (state?.block_id === blockId && Number(state.week) > changes.weeks) await store.put('program_state', { id: state.id, week: changes.weeks })
}

/** Kopje e bllokut menjëherë pas tij, me rregullat që vlejnë vetëm për të. */
export async function copyBlock(store: LocalStore, blockId: string): Promise<string> {
  const block = await store.get('program_blocks', blockId)
  if (!block) throw new Error('Blloku nuk gjendet.')
  const programId = String(block.program_id)
  const ordered = await rows(store, 'program_blocks', programId)
  const created = await store.put('program_blocks', { program_id: programId, position: Number(block.position) + 1, name: `${block.name} (kopje)`, weeks: block.weeks })
  const index = ordered.findIndex((row) => row.id === blockId)
  await renumber(store, 'program_blocks', [...ordered.slice(0, index + 1), created, ...ordered.slice(index + 1)])
  const rules = (await store.where('slot_prescriptions', 'program_id', programId)).filter((rule) => rule.block_id === blockId)
  await store.insertMany(
    'slot_prescriptions',
    rules.map((rule) => ({ ...ruleValues(rule), program_id: programId, slot_id: rule.slot_id, block_id: created.id, week: rule.week ?? null })),
  )
  return created.id
}

export async function removeBlock(store: LocalStore, blockId: string) {
  const block = await store.get('program_blocks', blockId)
  if (!block) return
  const programId = String(block.program_id)
  if ((await rows(store, 'program_blocks', programId)).length === 1) throw new Error('Programi duhet të ketë të paktën një bllok.')
  for (const rule of await store.where('slot_prescriptions', 'program_id', programId)) {
    if (rule.block_id === blockId) await store.remove('slot_prescriptions', rule.id)
  }
  await store.remove('program_blocks', blockId)
  await renumber(store, 'program_blocks', await rows(store, 'program_blocks', programId))
  await repairState(store, programId)
}

async function move(store: LocalStore, table: 'program_blocks' | 'program_days', id: string, direction: -1 | 1) {
  const row = await store.get(table, id)
  if (!row) return
  const ordered = await rows(store, table, String(row.program_id))
  const index = ordered.findIndex((candidate) => candidate.id === id)
  const target = index + direction
  if (target < 0 || target >= ordered.length) return
  ;[ordered[index], ordered[target]] = [ordered[target], ordered[index]]
  await renumber(store, table, ordered)
}

export const moveBlock = (store: LocalStore, blockId: string, direction: -1 | 1) => move(store, 'program_blocks', blockId, direction)

export async function addDay(store: LocalStore, programId: string, name: string): Promise<string> {
  const position = (await rows(store, 'program_days', programId)).length
  const id = (await store.put('program_days', { program_id: programId, position, name: name.trim() })).id
  await repairState(store, programId)
  return id
}

export async function renameDay(store: LocalStore, dayId: string, name: string) {
  await store.put('program_days', { id: dayId, name: name.trim() })
}

export const moveDay = (store: LocalStore, dayId: string, direction: -1 | 1) => move(store, 'program_days', dayId, direction)

export async function removeDay(store: LocalStore, dayId: string) {
  const day = await store.get('program_days', dayId)
  if (!day) return
  if ((await rows(store, 'program_days', String(day.program_id))).length === 1) throw new Error('Programi duhet të ketë të paktën një ditë.')
  for (const slot of await store.where('program_slots', 'day_id', dayId)) await removeSlot(store, slot.id)
  await store.remove('program_days', dayId)
  const programId = String(day.program_id)
  await renumber(store, 'program_days', await rows(store, 'program_days', programId))
  await repairState(store, programId)
}

export async function addSlot(
  store: LocalStore,
  dayId: string,
  slot: { exerciseId: string; sets: number; restSeconds: number },
): Promise<string> {
  const day = await store.get('program_days', dayId)
  if (!day) throw new Error('Dita nuk gjendet.')
  const position = (await store.where('program_slots', 'day_id', dayId)).length
  return (
    await store.put('program_slots', {
      program_id: day.program_id,
      day_id: dayId,
      position,
      exercise_id: slot.exerciseId,
      sets: slot.sets,
      rest_seconds: slot.restSeconds,
    })
  ).id
}

export async function updateSlot(store: LocalStore, slotId: string, changes: { exerciseId?: string; sets?: number; restSeconds?: number }) {
  await store.put('program_slots', {
    id: slotId,
    ...(changes.exerciseId ? { exercise_id: changes.exerciseId } : {}),
    ...(changes.sets ? { sets: changes.sets } : {}),
    ...(changes.restSeconds !== undefined ? { rest_seconds: changes.restSeconds } : {}),
  })
}

export async function moveSlot(store: LocalStore, slotId: string, direction: -1 | 1) {
  const slot = await store.get('program_slots', slotId)
  if (!slot) return
  const ordered = (await store.where('program_slots', 'day_id', String(slot.day_id))).sort(byPosition)
  const index = ordered.findIndex((candidate) => candidate.id === slotId)
  const target = index + direction
  if (target < 0 || target >= ordered.length) return
  ;[ordered[index], ordered[target]] = [ordered[target], ordered[index]]
  await renumber(store, 'program_slots', ordered)
}

export async function removeSlot(store: LocalStore, slotId: string) {
  const slot = await store.get('program_slots', slotId)
  if (!slot) return
  for (const rule of await store.where('slot_prescriptions', 'slot_id', slotId)) await store.remove('slot_prescriptions', rule.id)
  await store.remove('program_slots', slotId)
  const rest = (await store.where('program_slots', 'day_id', String(slot.day_id))).sort(byPosition)
  await renumber(store, 'program_slots', rest)
}

export type RuleScope = Scope

export interface RuleFields {
  exerciseId?: string | null
  sets?: number | null
  restSeconds?: number | null
  prescription?: Prescription | null
  technique?: Technique | null
  /** Rregulli i progresit të programeve të tua (V9); ruhet si rregull në çdo nivel. */
  progression?: ProgressionRule | null
}

const FIELD_COLUMNS: Record<keyof RuleFields, string> = {
  exerciseId: 'exercise_id',
  sets: 'sets',
  restSeconds: 'rest_seconds',
  prescription: 'prescription',
  technique: 'technique',
  progression: 'progression',
}

const ruleValues = (rule: LocalRow) => ({
  exercise_id: rule.exercise_id ?? null,
  sets: rule.sets ?? null,
  rest_seconds: rule.rest_seconds ?? null,
  prescription: rule.prescription ?? null,
  technique: rule.technique ?? null,
  progression: rule.progression ?? null,
})

const sameScope = (rule: LocalRow, scope: RuleScope) => (rule.block_id ?? null) === scope.blockId && (rule.week ?? null) === scope.week

/**
 * Vendos (ose heq me null) fusha për slotin në një fushëveprim: i gjithë programi, një bllok,
 * një javë, ose një javë e një blloku. Rreshti pa asnjë fushë fshihet.
 */
export async function setRule(store: LocalStore, slotId: string, scope: RuleScope, fields: RuleFields) {
  const slot = await store.get('program_slots', slotId)
  if (!slot) throw new Error('Sloti nuk gjendet.')
  const existing = (await store.where('slot_prescriptions', 'slot_id', slotId)).find((rule) => sameScope(rule, scope))
  const changes = Object.fromEntries(Object.entries(fields).map(([key, value]) => [FIELD_COLUMNS[key as keyof RuleFields], value ?? null]))
  const next = { ...(existing ? ruleValues(existing) : {}), ...changes }
  if (Object.values(next).every((value) => value === null || value === undefined)) {
    if (existing) await store.remove('slot_prescriptions', existing.id)
    return
  }
  await store.put('slot_prescriptions', {
    id: existing?.id,
    program_id: slot.program_id,
    slot_id: slotId,
    block_id: scope.blockId,
    week: scope.week,
    ...next,
  })
}

/** Rregullat e një jave (blloku dhe java) kopjohen te një javë tjetër; ato të javës së synuar zëvendësohen. */
export async function copyWeek(store: LocalStore, programId: string, from: { blockId: string; week: number }, to: { blockId: string; week: number }) {
  const rules = await store.where('slot_prescriptions', 'program_id', programId)
  for (const rule of rules.filter((candidate) => sameScope(candidate, to))) await store.remove('slot_prescriptions', rule.id)
  const source = rules.filter((candidate) => sameScope(candidate, from))
  await store.insertMany(
    'slot_prescriptions',
    source.map((rule) => ({ ...ruleValues(rule), program_id: programId, slot_id: rule.slot_id, block_id: to.blockId, week: to.week })),
  )
}

const BASE_FIELDS = ['exerciseId', 'sets', 'restSeconds'] as const

/**
 * Ndryshimi nga editori. Për gjithë programin, ushtrimi, setet dhe pushimi shkojnë te sloti vetë
 * (dhe hiqen nga rregulli pa bllok e pa javë, që të mos e mbulojnë); çdo gjë tjetër bëhet rregull.
 */
export async function editSlot(store: LocalStore, slotId: string, scope: RuleScope, fields: RuleFields) {
  if (scope.blockId !== null || scope.week !== null) return setRule(store, slotId, scope, fields)
  const base = Object.fromEntries(BASE_FIELDS.filter((key) => fields[key] !== undefined && fields[key] !== null).map((key) => [key, fields[key]]))
  if (Object.keys(base).length > 0) {
    await updateSlot(store, slotId, base)
    const rule = (await store.where('slot_prescriptions', 'slot_id', slotId)).find((row) => sameScope(row, scope))
    if (rule) await setRule(store, slotId, scope, Object.fromEntries(Object.keys(base).map((key) => [key, null])))
  }
  const rest = Object.fromEntries(Object.entries(fields).filter(([key]) => !(key in base)))
  if (Object.keys(rest).length > 0) await setRule(store, slotId, scope, rest)
}

/** Program i ri, gati për t'u plotësuar: një bllok me 4 javë dhe një ditë. */
export async function startProgram(store: LocalStore, name: string): Promise<string> {
  const programId = await createProgram(store, name)
  await addBlock(store, programId, { name: 'Blloku 1', weeks: 4 })
  await addDay(store, programId, 'Dita 1')
  return programId
}

/** Ushtrimi i slotit në një nivel, i zgjedhur nga biblioteka. */
export async function setSlotExercise(store: LocalStore, slotId: string, scope: RuleScope, library: LibraryExercise) {
  await editSlot(store, slotId, scope, { exerciseId: await exerciseFromLibrary(store, library) })
}

const SHORT_REST_GROUPS = new Set(['abdominals', 'calves'])

/** Ushtrim i ri në fund të ditës, nga biblioteka: 3 sete; pushim 90 s, 60 s për barkun dhe pulpat (§4). */
export async function addSlotFromLibrary(store: LocalStore, dayId: string, library: LibraryExercise): Promise<string> {
  const exerciseId = await exerciseFromLibrary(store, library)
  const restSeconds = library.primary.some((group) => SHORT_REST_GROUPS.has(group)) ? 60 : 90
  return addSlot(store, dayId, { exerciseId, sets: 3, restSeconds })
}

export interface ProgramSummary {
  id: string
  name: string
  active: boolean
  blocks: number
  days: number
}

/** Të gjitha programet: aktivi i pari, pastaj sipas emrit. */
export async function programList(store: LocalStore): Promise<ProgramSummary[]> {
  const [programs, blocks, days, [settings]] = await Promise.all([
    store.all('programs'),
    store.all('program_blocks'),
    store.all('program_days'),
    store.all('user_settings'),
  ])
  const count = (list: LocalRow[], programId: string) => list.filter((row) => row.program_id === programId).length
  return programs
    .map((row) => ({
      id: row.id,
      name: String(row.name),
      active: settings?.active_program_id === row.id,
      blocks: count(blocks, row.id),
      days: count(days, row.id),
    }))
    .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, 'sq'))
}

export interface EditorSlot {
  id: string
  exerciseId: string
  name: string
  sets: number
  restSeconds: number
}

export interface EditorDay {
  id: string
  number: number
  name: string
  slots: EditorSlot[]
}

export interface ProgramEditorView {
  id: string
  name: string
  active: boolean
  engine: Program
  exercises: Record<string, ExerciseRecord>
  blocks: Block[]
  days: EditorDay[]
  /** Çfarë vlen për slotin në një nivel dhe nga vjen. */
  rules: (slotId: string, scope: RuleScope) => SlotRules
  /** Plani i një dite në një bllok dhe javë, për shikimin paraprak. */
  plan: (blockId: string, week: number, dayId: string) => SessionPlan
}

export async function programEditor(store: LocalStore, programId: string): Promise<ProgramEditorView | null> {
  const [model, [settings]] = await Promise.all([programModel(store, programId), store.all('user_settings')])
  if (!model) return null
  const { engine, exercises } = model
  const order = <T extends { position: number }>(list: T[]) => [...list].sort((a, b) => a.position - b.position)
  return {
    id: programId,
    name: String(model.row.name),
    active: settings?.active_program_id === programId,
    engine,
    exercises,
    blocks: order(engine.blocks),
    days: order(engine.days).map((day, index) => ({
      id: day.id,
      number: index + 1,
      name: day.name,
      slots: order(engine.slots.filter((slot) => slot.dayId === day.id)).map((slot) => ({
        id: slot.id,
        exerciseId: slot.exerciseId,
        name: exercises[slot.exerciseId]?.name ?? 'Ushtrim i panjohur',
        sets: slot.sets,
        restSeconds: slot.restSeconds,
      })),
    })),
    rules: (slotId, scope) => slotRules(engine, slotId, scope),
    plan: (blockId, week, dayId) => planSession(engine, { run: 1, blockId, week, dayId, completed: false }),
  }
}
