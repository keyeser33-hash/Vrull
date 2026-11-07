import type { Macros } from '@/nutrition/targets'
import { kg } from './training-format'

// Tekstet e ushqimit sipas DESIGN.md: pika për mijëshet ("1.487 kcal"), presja dhjetore, ora 24h.

export const kcal = (value: number) => String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')

export const grams = (value: number) => `${kg(value)} g`

export const macrosLine = (macros: Macros) => `P ${Math.round(macros.proteinG)} · K ${Math.round(macros.carbsG)} · Y ${Math.round(macros.fatG)} g`

/** "pas 20 min", "pas 2 orë 50 min", "para 30 min", "tani". */
export function relativeTime(time: string, now: Date) {
  const [hours, minutes] = time.split(':').map(Number)
  const diff = hours * 60 + minutes - (now.getHours() * 60 + now.getMinutes())
  if (diff === 0) return 'tani'
  const span = Math.abs(diff)
  const text = span < 60 ? `${span} min` : `${Math.floor(span / 60)} orë${span % 60 ? ` ${span % 60} min` : ''}`
  return diff > 0 ? `pas ${text}` : `para ${text}`
}
