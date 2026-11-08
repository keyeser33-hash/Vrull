import type { Target } from '@/program/types'

// Tekstet e stërvitjes sipas DESIGN.md: presje dhjetore, data "e hënë 07.12", ora 24h.

/** Numër me presje dhjetore, deri në dy shifra: 47,5 · 50 · 22,25 · 1,5. */
export const decimal = (value: number) => String(Math.round(value * 100) / 100).replace('.', ',')

/** Pesha në kg, pa njësinë. */
export const kg = decimal

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
