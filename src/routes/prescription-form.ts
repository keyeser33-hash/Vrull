import type { Prescription, RepRange } from '@/program/types'
import { kg } from './training-format'

// Forma e recetës te editori (SPEC §4): pesë llojet, me fushat si tekst që lejojnë presjen
// dhjetore dhe gabimet me fjalë. Kur ndërrohet lloji, fushat e tjera ruajnë vlerat e tyre.

export type PrescriptionType = Prescription['type']

export const PRESCRIPTION_TYPES: { type: PrescriptionType; label: string; hint: string }[] = [
  { type: 'rep_ladder', label: 'Përsëritje sipas javës', hint: 'Intervali ndryshon çdo javë dhe përsëritet në cikël.' },
  { type: 'timed', label: 'Kohë', hint: 'Sekonda për set, si plank-u.' },
  { type: 'percent_1rm', label: 'Përqindje e 1RM', hint: 'Përqindja dhe përsëritjet sipas javës, si 5/3/1.' },
  { type: 'linear', label: 'Progresion linear', hint: 'Pesha rritet kur mbyllen të gjitha përsëritjet.' },
  { type: 'rpe', label: 'Përsëritje me RPE', hint: 'Sa i rëndë duhet të ndihet seti, nga 5 deri në 10.' },
  { type: 'rir', label: 'Përsëritje me RIR', hint: 'Sa përsëritje duhet të mbeten në rezervë.' },
]

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

const text = (value: number | null | undefined) => (value === null || value === undefined ? '' : kg(value))
const rangeRow = (range: RepRange): RangeRow => ({ min: text(range.min), max: text(range.max), beyond: Boolean(range.beyond) })

const DEFAULT: PrescriptionDraft = {
  type: 'rep_ladder',
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
  incrementKg: '2,5',
  linearReps: '5',
  failures: '3',
  deloadPercent: '10',
  repsMin: '8',
  repsMax: '12',
  repsBeyond: false,
  rpe: '8',
  rirMin: '1',
  rirMax: '2',
}

export function prescriptionDraft(prescription: Prescription | undefined | null): PrescriptionDraft {
  const draft = { ...DEFAULT, ladder: [...DEFAULT.ladder], weeks: [...DEFAULT.weeks] }
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

export type ParseResult = { ok: true; value: Prescription } | { ok: false; error: string }

class FormError extends Error {}

/** Numri nga teksti: presja si pikë dhjetore; null kur fusha është bosh. */
function number(value: string): number | null {
  const trimmed = value.trim().replace(',', '.')
  if (trimmed === '') return null
  return /^\d+(\.\d+)?$/.test(trimmed) ? Number(trimmed) : Number.NaN
}

function required(value: string, min: number, max: number, message: string, { integer = true, step }: { integer?: boolean; step?: number } = {}) {
  const parsed = number(value)
  const valid =
    parsed !== null &&
    !Number.isNaN(parsed) &&
    parsed >= min &&
    parsed <= max &&
    (!integer || Number.isInteger(parsed)) &&
    (step === undefined || Number.isInteger(Math.round((parsed / step) * 1000) / 1000))
  if (!valid) throw new FormError(message)
  return parsed
}

function repRange(row: RangeRow, prefix: string): RepRange {
  const min = required(row.min, 1, 100, `${prefix}përsëritjet duhet të jenë nga 1 deri në 100.`)
  const max = row.max.trim() === '' ? null : required(row.max, 1, 100, `${prefix}përsëritjet duhet të jenë nga 1 deri në 100.`)
  if (max !== null && max < min) throw new FormError(`${prefix}maksimumi duhet të jetë sa minimumi ose më shumë.`)
  return row.beyond ? { min, max, beyond: true } : { min, max }
}

function parse(draft: PrescriptionDraft): Prescription {
  switch (draft.type) {
    case 'rep_ladder': {
      if (draft.ladder.length === 0) throw new FormError('Shto të paktën një javë.')
      const ladder = draft.ladder.map((row, index) => repRange(row, `Java ${index + 1}: `))
      const both = draft.increaseMin.trim() !== '' || draft.increaseMax.trim() !== ''
      if (!both) return { type: 'rep_ladder', ladder }
      const message = 'Shtesa mes blloqeve duhet të jetë nga 0 deri në 50 kg.'
      const min = required(draft.increaseMin, 0, 50, message, { integer: false })
      const max = required(draft.increaseMax, 0, 50, message, { integer: false })
      if (max < min) throw new FormError('Shtesa më e madhe duhet të jetë sa më e vogla ose më shumë.')
      return { type: 'rep_ladder', ladder, blockIncreaseKg: { min, max } }
    }
    case 'timed':
      return { type: 'timed', seconds: required(draft.seconds, 5, 600, 'Kohëzgjatja duhet të jetë nga 5 deri në 600 sekonda.') }
    case 'percent_1rm': {
      if (draft.weeks.length === 0) throw new FormError('Shto të paktën një javë.')
      return {
        type: 'percent_1rm',
        weeks: draft.weeks.map((week, index) => {
          const prefix = `Java ${index + 1}: `
          const percent = required(week.percent, 1, 100, `${prefix}përqindja duhet të jetë nga 1 deri në 100.`, { integer: false })
          const reps = required(week.reps, 1, 30, `${prefix}përsëritjet duhet të jenë nga 1 deri në 30.`)
          return week.amrap ? { percent, reps, amrap: true } : { percent, reps }
        }),
      }
    }
    case 'linear':
      return {
        type: 'linear',
        startKg: required(draft.startKg, 0, 500, 'Pesha e nisjes duhet të jetë nga 0 deri në 500 kg.', { integer: false }),
        incrementKg: required(draft.incrementKg, 0.25, 20, 'Shtesa duhet të jetë nga 0,25 deri në 20 kg.', { integer: false }),
        reps: required(draft.linearReps, 1, 30, 'Përsëritjet duhet të jenë nga 1 deri në 30.'),
        failuresBeforeDeload: required(draft.failures, 1, 10, 'Dështimet para uljes duhet të jenë nga 1 deri në 10.'),
        deloadPercent: required(draft.deloadPercent, 1, 50, 'Ulja duhet të jetë nga 1 deri në 50%.', { integer: false }),
      }
    case 'rpe':
    case 'rir': {
      const reps = repRange({ min: draft.repsMin, max: draft.repsMax, beyond: draft.repsBeyond }, '')
      if (draft.type === 'rpe') {
        const rpe = required(draft.rpe, 5, 10, 'RPE duhet të jetë nga 5 deri në 10.', { integer: false, step: 0.5 })
        return { type: 'rpe', reps, rpe }
      }
      const message = 'RIR duhet të jetë nga 0 deri në 5.'
      const min = required(draft.rirMin, 0, 5, message)
      const max = required(draft.rirMax, 0, 5, message)
      if (max < min) throw new FormError('RIR: maksimumi duhet të jetë sa minimumi ose më shumë.')
      return { type: 'rir', reps, rir: { min, max } }
    }
  }
}

export function prescriptionFromDraft(draft: PrescriptionDraft): ParseResult {
  try {
    return { ok: true, value: parse(draft) }
  } catch (error) {
    if (error instanceof FormError) {
      const message = error.message
      return { ok: false, error: message.charAt(0).toUpperCase() + message.slice(1) }
    }
    throw error
  }
}

const range = (reps: RepRange) => (reps.max === null ? `${reps.min}+` : `${reps.min}–${reps.max}`)

/** Teksti i shkurtër i recetës në rreshtin e editorit. */
export function prescriptionSummary(prescription: Prescription | undefined | null): string {
  if (!prescription) return 'Pa recetë'
  switch (prescription.type) {
    case 'rep_ladder':
      return prescription.ladder.map(range).join(', ')
    case 'timed':
      return `${prescription.seconds} sekonda`
    case 'percent_1rm':
      return prescription.weeks.map((week) => `${kg(week.percent)}% × ${week.reps}${week.amrap ? '+' : ''}`).join(', ')
    case 'linear':
      return `${prescription.reps} përsëritje, +${kg(prescription.incrementKg)} kg`
    case 'rpe':
      return `${range(prescription.reps)} me RPE ${kg(prescription.rpe)}`
    case 'rir':
      return `${range(prescription.reps)} me RIR ${prescription.rir.min}–${prescription.rir.max}`
  }
}
