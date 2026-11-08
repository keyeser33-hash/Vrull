import type { Draft, Target } from '../../supabase/functions/program-import/logic'
import type { LibraryExercise } from './library'
import type { Equipment, Prescription, Program, RepRange, SlotOverride, Technique, Tracking } from './types'

// Importi i programit nga PDF me AI (V2-E1-11; bordi "Importo nga PDF"), pa UI dhe pa bazë. Drafti vjen
// nga funksioni program-import (skema dhe tipi jetojnë te logic.ts i funksionit) dhe këtu:
// 1. ushtrimet e PDF-së përputhen me ushtrimet e përdoruesit dhe me bibliotekën: e sigurta merret vetë,
//    e pasigurta bëhet pyetje ("A është kjo X?" me Po, alternativën ose Tjetër);
// 2. drafti bëhet program i motorit (blloqe, ditë, slote dhe rregulla sipas bllokut dhe javës), me id
//    të përkohshme që `data/pdf-import.ts` i kthen në rreshta.

export type { Draft as PdfDraft } from '../../supabase/functions/program-import/logic'

/** Ushtrimi i përdoruesit në telefon, kandidat për përputhje. */
export interface OwnExercise {
  id: string
  name: string
  libraryId: string | null
  tracking: Tracking
  equipment: Equipment
}

/** Çfarë bëhet ushtrimi i PDF-së: ushtrimi i përdoruesit, ai i bibliotekës, ose një ushtrim i ri. */
export type Choice =
  | ({ kind: 'own' } & OwnExercise)
  | { kind: 'library'; exercise: LibraryExercise }
  | { kind: 'new'; name: string; equipment: Equipment; muscles: string[]; timed: boolean }

/** "A është kjo X?": Po (sugjerimi), alternativa, ose Tjetër (kërkimi te biblioteka). */
export interface ExerciseQuestion {
  /** Indeksi te `draft.exercises`. */
  index: number
  pdfName: string
  page: number
  suggestion: Choice | null
  alternative: Choice | null
  /** Pa asnjë emër të njohur: "Shto si të ri" me emrin e PDF-së. */
  fallback: Choice
}

export interface Matching {
  /** Për çdo ushtrim të draftit: zgjedhja e sigurt, ose null kur pret përgjigje. */
  choices: (Choice | null)[]
  questions: ExerciseQuestion[]
}

const EQUIPMENT = new Set<Equipment>(['barbell', 'ez_bar', 'dumbbell', 'cable', 'machine', 'bodyweight', 'kettlebell', 'band', 'other'])
const norm = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase()

function newChoice(exercise: Draft['exercises'][number]): Choice {
  const equipment = EQUIPMENT.has(exercise.equipment as Equipment) ? (exercise.equipment as Equipment) : 'other'
  return { kind: 'new', name: exercise.pdf_name.trim(), equipment, muscles: exercise.muscles, timed: exercise.timed }
}

/**
 * Përputhja: emri i PDF-së që është saktësisht një ushtrim i përdoruesit ose i bibliotekës merret vetë;
 * përndryshe vlen fjala e AI-së kur është e sigurt dhe emri i saj ekziston (ose, pa emër, si ushtrim i
 * ri). Çdo gjë tjetër pyetet. Ushtrimi i përdoruesit para bibliotekës, që historia të mbetet bashkë.
 */
export function matchExercises(draft: Draft, candidates: { own: OwnExercise[]; library: LibraryExercise[] }): Matching {
  const own = new Map(candidates.own.map((exercise) => [norm(exercise.name), exercise]))
  const library = new Map(candidates.library.map((exercise) => [norm(exercise.name), exercise]))
  const find = (name: string): Choice | null => {
    if (!name.trim()) return null
    const mine = own.get(norm(name))
    if (mine) return { kind: 'own', ...mine }
    const entry = library.get(norm(name))
    return entry ? { kind: 'library', exercise: entry } : null
  }
  const choices: (Choice | null)[] = []
  const questions: ExerciseQuestion[] = []
  draft.exercises.forEach((exercise, index) => {
    const exact = find(exercise.pdf_name)
    const matched = find(exercise.match)
    let choice: Choice | null = null
    if (exact) choice = exact
    else if (exercise.sure && exercise.match.trim() === '') choice = newChoice(exercise)
    else if (exercise.sure && matched) choice = matched
    choices.push(choice)
    if (choice) return
    const alternative = find(exercise.alternative)
    questions.push({
      index,
      pdfName: exercise.pdf_name,
      page: exercise.page,
      suggestion: matched,
      alternative: alternative && choiceKey(alternative) !== (matched && choiceKey(matched)) ? alternative : null,
      fallback: newChoice(exercise),
    })
  })
  return { choices, questions }
}

/** Çelësi i një zgjedhjeje, për krahasim ("Po" dhe alternativa nuk janë i njëjti ushtrim). */
export function choiceKey(choice: Choice): string {
  if (choice.kind === 'own') return `own:${choice.id}`
  if (choice.kind === 'library') return `library:${choice.exercise.id}`
  return `new:${norm(choice.name)}`
}

export function choiceName(choice: Choice): string {
  return choice.kind === 'library' ? choice.exercise.name : choice.name
}

// ——— Drafti → programi i motorit ———

/** Receta e ushtrimit të ri te ndërtuesi (SPEC §4): 8–12 përsëritje me RIR 2, kur PDF-ja nuk jep përsëritje. */
const DEFAULT_PRESCRIPTION: Prescription = { type: 'rir', reps: { min: 8, max: 12 }, rir: { min: 2, max: 2 } }
const DEFAULT_REST = 90
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(value)))

function range(target: Target): RepRange {
  const max = target.reps_max > 0 ? Math.max(target.reps_max, target.reps_min) : null
  return target.to_failure && max !== null ? { min: target.reps_min, max, beyond: true } : { min: target.reps_min, max }
}

const plainReps = (target: Target) => target.seconds <= 0 && target.reps_min > 0 && target.rir_min < 0

function prescriptionOf(target: Target): Prescription {
  if (target.seconds > 0) return { type: 'timed', seconds: target.seconds }
  if (target.reps_min <= 0) return DEFAULT_PRESCRIPTION
  if (target.rir_min >= 0) return { type: 'rir', reps: range(target), rir: { min: target.rir_min, max: Math.max(target.rir_min, target.rir_max) } }
  return { type: 'rep_ladder', ladder: [range(target)] }
}

const techniqueOf = (target: Target): Technique => ({ type: target.last_set })

/**
 * Rregullat e një plani në një nivel (gjithë programi ose një bllok): një shkallë përsëritjesh kur çdo
 * javë është interval i thjeshtë, një recetë kur plani ka një javë, përndryshe javë për javë (plani
 * përsëritet si shkalla). Teknika e njëjtë për çdo javë jepet një herë; te gjithë programi "asnjë" nuk
 * shkruhet, te blloku po, që të mbulojë teknikat e programit.
 */
function planRows(plan: Target[], slotId: string, blockId: string | null, weeks: number): SlotOverride[] {
  const uniformTechnique = plan.every((target) => target.last_set === plan[0].last_set)
  const technique = (target: Target) => (blockId === null && target.last_set === 'none' ? {} : { technique: techniqueOf(target) })
  if (plan.length === 1 || plan.every(plainReps)) {
    const prescription: Prescription = plan.length > 1 ? { type: 'rep_ladder', ladder: plan.map(range) } : prescriptionOf(plan[0])
    const rows: SlotOverride[] = [{ slotId, blockId, week: null, prescription, ...(uniformTechnique ? technique(plan[0]) : {}) }]
    if (!uniformTechnique) {
      for (let week = 1; week <= weeks; week++) rows.push({ slotId, blockId, week, technique: techniqueOf(plan[(week - 1) % plan.length]) })
    }
    return rows
  }
  return Array.from({ length: weeks }, (_, index) => {
    const target = plan[index % plan.length]
    return { slotId, blockId, week: index + 1, prescription: prescriptionOf(target), ...(uniformTechnique ? technique(target) : { technique: techniqueOf(target) }) }
  })
}

export interface ImportedExercise {
  name: string
  choice: Choice
  tracking: Tracking
  equipment: Equipment
}

export interface ImportedProgram {
  name: string
  /** Blloqet `b0…`, ditët `d0…`, slotet `d0-s0…`, ushtrimet `x<indeksi i draftit>`. */
  program: Program
  exercises: Record<string, ImportedExercise>
}

function exerciseInfo(choice: Choice, timed: boolean): Omit<ImportedExercise, 'choice'> {
  if (choice.kind === 'own') return { name: choice.name, tracking: choice.tracking, equipment: choice.equipment }
  const equipment = choice.kind === 'library' ? choice.exercise.equipment : choice.equipment
  const tracking: Tracking = timed ? 'timed' : equipment === 'bodyweight' || equipment === 'band' ? 'bodyweight_reps' : 'weight_reps'
  return { name: choiceName(choice), tracking, equipment }
}

/** Drafti si program i motorit, me çdo ushtrim të zgjedhur (`choices` pa null). */
export function buildProgram(draft: Draft, choices: Choice[]): ImportedProgram {
  const exercises: Record<string, ImportedExercise> = {}
  draft.exercises.forEach((exercise, index) => {
    exercises[`x${index}`] = { ...exerciseInfo(choices[index], exercise.timed), choice: choices[index] }
  })
  const blocks = draft.blocks.map((block, position) => ({ id: `b${position}`, position, name: block.name.trim() || `${position + 1}`, weeks: clamp(block.weeks, 1, 52) }))
  const maxWeeks = Math.max(...blocks.map((block) => block.weeks))
  const days = draft.days.map((day, position) => ({ id: `d${position}`, position, name: day.name.trim() || `${position + 1}` }))
  const slots: Program['slots'] = []
  const overrides: SlotOverride[] = []
  draft.days.forEach((day, dayIndex) => {
    day.slots.forEach((slot, position) => {
      const slotId = `d${dayIndex}-s${position}`
      slots.push({
        id: slotId,
        dayId: `d${dayIndex}`,
        position,
        exerciseId: `x${slot.exercise}`,
        sets: clamp(slot.sets, 1, 20),
        restSeconds: slot.rest_seconds > 0 ? clamp(slot.rest_seconds, 0, 900) : DEFAULT_REST,
      })
      overrides.push(...planRows(draft.plans[slot.plan].weeks, slotId, null, maxWeeks))
      for (const change of slot.blocks) {
        const block = blocks[change.block - 1]
        if (change.exercise >= 0 || change.sets > 0) {
          overrides.push({
            slotId,
            blockId: block.id,
            week: null,
            ...(change.exercise >= 0 ? { exerciseId: `x${change.exercise}` } : {}),
            ...(change.sets > 0 ? { sets: clamp(change.sets, 1, 20) } : {}),
          })
        }
        if (change.plan >= 0) overrides.push(...planRows(draft.plans[change.plan].weeks, slotId, block.id, block.weeks))
      }
      for (const change of slot.weeks) {
        const block = change.block > 0 ? blocks[change.block - 1] : null
        overrides.push({ slotId, blockId: block?.id ?? null, week: change.week, exerciseId: `x${change.exercise}` })
      }
    })
  })
  const info = Object.fromEntries(Object.entries(exercises).map(([id, exercise]) => [id, { tracking: exercise.tracking, equipment: exercise.equipment }]))
  return { name: draft.name.trim(), program: { id: 'pdf-import', blocks, days, slots, overrides: dedupe(overrides), exercises: info }, exercises }
}

/** Rreshtat e të njëjtit nivel bashkohen (p.sh. ushtrimi i bllokut dhe receta e tij), në radhën e parë. */
function dedupe(rows: SlotOverride[]): SlotOverride[] {
  const merged = new Map<string, SlotOverride>()
  for (const row of rows) {
    const key = `${row.slotId}|${row.blockId}|${row.week}`
    merged.set(key, { ...merged.get(key), ...row })
  }
  return [...merged.values()]
}

// ——— Parapamja (bordi "Importo nga PDF") ———

export interface PreviewSlot {
  /** Emri i zgjedhur, ose emri i PDF-së kur ushtrimi (në çdo bllok ose javë) pret përgjigje. */
  name: string
  /** `name` është emri i PDF-së, në thonjëza. */
  pdfName: boolean
  check: boolean
  sets: number
  /** Receta e zakonshme e slotit (plani i tij, java e parë kur ndryshon lloj sipas javës). */
  prescription: Prescription
}

export interface PreviewDay {
  name: string
  slots: PreviewSlot[]
  toCheck: number
}

export function previewDays(draft: Draft, choices: (Choice | null)[]): PreviewDay[] {
  return draft.days.map((day) => {
    const slots = day.slots.map((slot): PreviewSlot => {
      const used = [slot.exercise, ...slot.blocks.map((change) => change.exercise).filter((index) => index >= 0), ...slot.weeks.map((change) => change.exercise)]
      const open = used.find((index) => !choices[index])
      const plan = draft.plans[slot.plan].weeks
      const base = choices[slot.exercise]
      return {
        name: open !== undefined ? draft.exercises[open].pdf_name : base ? choiceName(base) : draft.exercises[slot.exercise].pdf_name,
        pdfName: open !== undefined,
        check: open !== undefined,
        sets: clamp(slot.sets, 1, 20),
        prescription: plan.every(plainReps) && plan.length > 1 ? { type: 'rep_ladder', ladder: plan.map(range) } : prescriptionOf(plan[0]),
      }
    })
    return { name: day.name, slots, toCheck: slots.filter((slot) => slot.check).length }
  })
}

/** Numrat e kreut: blloqet, javët gjithsej, ditët dhe ushtrimet e ndryshme. */
export function draftCounts(draft: Draft) {
  return {
    blocks: draft.blocks.length,
    weeks: draft.blocks.reduce((sum, block) => sum + clamp(block.weeks, 1, 52), 0),
    days: draft.days.length,
    exercises: draft.exercises.length,
  }
}
