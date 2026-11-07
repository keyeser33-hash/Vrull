import type { Target, Technique } from '@/program/types'

// Tekstet e stërvitjes sipas DESIGN.md: presje dhjetore, data "e hënë 07.12", ora 24h.

/** 47,5 · 50 · 22,25 */
export const kg = (value: number) => String(Math.round(value * 100) / 100).replace('.', ',')

const range = (min: number, max: number | null) => (max === null ? `${min}+` : `${min}–${max}`)

export function targetText(target: Target): string {
  switch (target.kind) {
    case 'reps':
      if (target.min === 0 && target.max === null) return 'Përsëritje të lira'
      return `${range(target.min, target.max)} përsëritje${target.beyond ? ', deri në dështim' : ''}`
    case 'timed':
      return `${target.seconds} sekonda`
    case 'percent_1rm':
      return `${target.reps}${target.amrap ? '+' : ''} përsëritje me ${target.percent}%`
    case 'linear':
      return `${target.reps} përsëritje`
  }
}

/** "4 × 12–15", "3 × 60 s" */
export function setsText(sets: number, target: Target): string {
  switch (target.kind) {
    case 'reps':
      return `${sets} × ${range(target.min, target.max)}`
    case 'timed':
      return `${sets} × ${target.seconds} s`
    case 'percent_1rm':
    case 'linear':
      return `${sets} × ${target.reps}`
  }
}

export function techniqueText(technique: Technique): string | null {
  switch (technique.type) {
    case 'rest_pause':
      return 'rest-pause'
    case 'drop_set':
      return 'drop set'
    case 'to_failure':
      return 'deri në dështim'
    case 'none':
      return null
  }
}

const WEEKDAYS = ['e diel', 'e hënë', 'e martë', 'e mërkurë', 'e enjte', 'e premte', 'e shtunë']

/** "e hënë 07.12" */
export function dateLabel(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${WEEKDAYS[date.getDay()]} ${pad(date.getDate())}.${pad(date.getMonth() + 1)}`
}

/** "1:30", "18:42", "1:02:03" */
export function clock(totalSeconds: number) {
  const seconds = Math.max(0, Math.round(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = String(seconds % 60).padStart(2, '0')
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`
}
