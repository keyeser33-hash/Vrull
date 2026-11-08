import type { MessageKey } from '@/i18n'
import type { Prescription, RepRange } from '@/program/types'

// Forma e recetës te ndërtuesi (SPEC §4): gjashtë llojet, me fushat si tekst që lejojnë presjen ose
// pikën dhjetore. Gabimet janë çelësa të katalogut (`builder.recipe.error.*`) me parametrat e tyre.
// Kur ndërrohet lloji, fushat e tjera ruajnë vlerat e tyre.

export type PrescriptionType = Prescription['type']

/** Radha te fleta: intervali me RIR i pari, si ushtrimi i ri i ndërtuesit. */
export const PRESCRIPTION_TYPES: PrescriptionType[] = ['rir', 'rep_ladder', 'timed', 'percent_1rm', 'linear', 'rpe']

export interface RangeRow {
  min: string
  max: string
  beyond: boolean
}

export interface PercentRow {
  percent: string
  reps: string
  amrap: boolean
}

export interface PrescriptionDraft {
  type: PrescriptionType
  ladder: RangeRow[]
  increaseMin: string
  increaseMax: string
  seconds: string
  weeks: PercentRow[]
  startKg: string
  incrementKg: string
  linearReps: string
  failures: string
  deloadPercent: string
  repsMin: string
  repsMax: string
  repsBeyond: boolean
  rpe: string
  rirMin: string
  rirMax: string
}

export type FormError = { key: Extract<MessageKey, `builder.recipe.error.${string}`>; params?: { number: number } }
export type ParseResult = { ok: true; value: Prescription } | { ok: false; error: FormError }

/** Receta e ushtrimit të ri te ndërtuesi (SPEC §4, V2-E1-10): 8–12 përsëritje me RIR 2. */
export const DEFAULT_PRESCRIPTION: Prescription = { type: 'rir', reps: { min: 8, max: 12 }, rir: { min: 2, max: 2 } }

const DEFAULT: PrescriptionDraft = {
  type: 'rir',
  ladder: [
    [12, 15],
    [9, 11],
    [6, 8],
    [3, 5],
  ].map(([min, max]) => ({ min: String(min), max: String(max), beyond: false })),
  increaseMin: '',
  increaseMax: '',
  seconds: '30',
  weeks: [
    [85, 5],
    [90, 3],
    [95, 1],
  ].map(([percent, reps]) => ({ percent: String(percent), reps: String(reps), amrap: true })),
  startKg: '20',
  incrementKg: '2.5',
  linearReps: '5',
  failures: '3',
  deloadPercent: '10',
  repsMin: '8',
  repsMax: '12',
  repsBeyond: false,
  rpe: '8',
  rirMin: '2',
  rirMax: '2',
}

/** Forma e një recete; `number` i shkruan numrat sipas gjuhës (`fmt.number`: 2,5 / 2.5). */
export function prescriptionDraft(prescription: Prescription | undefined | null, number: (value: number) => string = String): PrescriptionDraft {
  const text = (value: number | null | undefined) => (value === null || value === undefined ? '' : number(value))
  const rangeRow = (range: RepRange): RangeRow => ({ min: text(range.min), max: text(range.max), beyond: Boolean(range.beyond) })
  const draft: PrescriptionDraft = {
    ...DEFAULT,
    ladder: [...DEFAULT.ladder],
    weeks: [...DEFAULT.weeks],
    incrementKg: number(2.5),
  }
  if (!prescription) return draft
  draft.type = prescription.type
  switch (prescription.type) {
    case 'rep_ladder':
      draft.ladder = prescription.ladder.map(rangeRow)
      draft.increaseMin = text(prescription.blockIncreaseKg?.min)
      draft.increaseMax = text(prescription.blockIncreaseKg?.max)
      break
    case 'timed':
      draft.seconds = text(prescription.seconds)
      break
    case 'percent_1rm':
      draft.weeks = prescription.weeks.map((week) => ({ percent: text(week.percent), reps: text(week.reps), amrap: Boolean(week.amrap) }))
      break
    case 'linear':
      draft.startKg = text(prescription.startKg)
      draft.incrementKg = text(prescription.incrementKg)
      draft.linearReps = text(prescription.reps)
      draft.failures = text(prescription.failuresBeforeDeload)
      draft.deloadPercent = text(prescription.deloadPercent)
      break
    case 'rpe':
    case 'rir': {
      const reps = rangeRow(prescription.reps)
      draft.repsMin = reps.min
      draft.repsMax = reps.max
      draft.repsBeyond = reps.beyond
      if (prescription.type === 'rpe') draft.rpe = text(prescription.rpe)
      else {
        draft.rirMin = text(prescription.rir.min)
        draft.rirMax = text(prescription.rir.max)
      }
      break
    }
  }
  return draft
}

class Invalid extends Error {
  readonly error: FormError
  constructor(error: FormError) {
    super(error.key)
    this.error = error
  }
}

/** Numri nga teksti: presja ose pika dhjetore; null kur fusha është bosh. */
function parseNumber(value: string): number | null {
  const trimmed = value.trim().replace(',', '.')
  if (trimmed === '') return null
  return /^\d+(\.\d+)?$/.test(trimmed) ? Number(trimmed) : Number.NaN
}

function required(value: string, min: number, max: number, error: FormError, { integer = true, step }: { integer?: boolean; step?: number } = {}) {
  const parsed = parseNumber(value)
  const valid =
    parsed !== null &&
    !Number.isNaN(parsed) &&
    parsed >= min &&
    parsed <= max &&
    (!integer || Number.isInteger(parsed)) &&
    (step === undefined || Number.isInteger(Math.round((parsed / step) * 1000) / 1000))
  if (!valid) throw new Invalid(error)
  return parsed
}

/** Intervali i një jave (`week`) ose i vetëm. */
function repRange(row: RangeRow, week?: number): RepRange {
  const reps: FormError = week ? { key: 'builder.recipe.error.weekReps', params: { number: week } } : { key: 'builder.recipe.error.reps' }
  const min = required(row.min, 1, 100, reps)
  const max = row.max.trim() === '' ? null : required(row.max, 1, 100, reps)
  if (max !== null && max < min) throw new Invalid(week ? { key: 'builder.recipe.error.weekMaxBelowMin', params: { number: week } } : { key: 'builder.recipe.error.maxBelowMin' })
  return row.beyond ? { min, max, beyond: true } : { min, max }
}

function parse(draft: PrescriptionDraft): Prescription {
  switch (draft.type) {
    case 'rep_ladder': {
      if (draft.ladder.length === 0) throw new Invalid({ key: 'builder.recipe.error.weekRequired' })
      const ladder = draft.ladder.map((row, index) => repRange(row, index + 1))
      const both = draft.increaseMin.trim() !== '' || draft.increaseMax.trim() !== ''
      if (!both) return { type: 'rep_ladder', ladder }
      const increase: FormError = { key: 'builder.recipe.error.increase' }
      const min = required(draft.increaseMin, 0, 50, increase, { integer: false })
      const max = required(draft.increaseMax, 0, 50, increase, { integer: false })
      if (max < min) throw new Invalid({ key: 'builder.recipe.error.increaseOrder' })
      return { type: 'rep_ladder', ladder, blockIncreaseKg: { min, max } }
    }
    case 'timed':
      return { type: 'timed', seconds: required(draft.seconds, 5, 600, { key: 'builder.recipe.error.seconds' }) }
    case 'percent_1rm': {
      if (draft.weeks.length === 0) throw new Invalid({ key: 'builder.recipe.error.weekRequired' })
      return {
        type: 'percent_1rm',
        weeks: draft.weeks.map((week, index) => {
          const params = { number: index + 1 }
          const percent = required(week.percent, 1, 100, { key: 'builder.recipe.error.percent', params }, { integer: false })
          const reps = required(week.reps, 1, 30, { key: 'builder.recipe.error.percentReps', params })
          return week.amrap ? { percent, reps, amrap: true } : { percent, reps }
        }),
      }
    }
    case 'linear':
      return {
        type: 'linear',
        startKg: required(draft.startKg, 0, 500, { key: 'builder.recipe.error.startKg' }, { integer: false }),
        incrementKg: required(draft.incrementKg, 0.25, 20, { key: 'builder.recipe.error.incrementKg' }, { integer: false }),
        reps: required(draft.linearReps, 1, 30, { key: 'builder.recipe.error.linearReps' }),
        failuresBeforeDeload: required(draft.failures, 1, 10, { key: 'builder.recipe.error.failures' }),
        deloadPercent: required(draft.deloadPercent, 1, 50, { key: 'builder.recipe.error.deload' }, { integer: false }),
      }
    case 'rpe':
    case 'rir': {
      const reps = repRange({ min: draft.repsMin, max: draft.repsMax, beyond: draft.repsBeyond })
      if (draft.type === 'rpe') {
        const rpe = required(draft.rpe, 5, 10, { key: 'builder.recipe.error.rpe' }, { integer: false, step: 0.5 })
        return { type: 'rpe', reps, rpe }
      }
      // RIR-i zgjidhet te receta e ushtrimit (çipat 0–4+); fleta e mban siç ishte.
      const min = parseNumber(draft.rirMin) ?? 2
      const max = parseNumber(draft.rirMax) ?? min
      return { type: 'rir', reps, rir: { min: Number.isNaN(min) ? 2 : min, max: Number.isNaN(max) ? min : Math.max(min, max) } }
    }
  }
}

export function prescriptionFromDraft(draft: PrescriptionDraft): ParseResult {
  try {
    return { ok: true, value: parse(draft) }
  } catch (error) {
    if (error instanceof Invalid) return { ok: false, error: error.error }
    throw error
  }
}
