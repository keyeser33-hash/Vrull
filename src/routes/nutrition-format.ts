import type { I18n } from '@/i18n'
import type { Macros } from '@/nutrition/targets'

// Tekstet e ushqimit sipas gjuhës (SPEC §0.3a, Gjuhët): "2 900 kcal" / "2,900 kcal", gramët me
// hapësirë që nuk thyhet, makrot "P 40 · K 62 · Y 9 g" dhe koha relative e vaktit nga katalogu.

type Texts = Pick<I18n, 't' | 'fmt'>

/** Kaloritë pa presje dhjetore, me mijëshet e gjuhës: "1 487" / "1,487". */
export const kcalText = ({ fmt }: Texts, value: number) => fmt.number(Math.round(value))

/** "13,5 g" / "13.5 g". */
export const gramsText = ({ fmt }: Texts, value: number) => fmt.unit(value, 'g', { maxDigits: 1 })

export const macrosLine = ({ t }: Texts, macros: Macros) =>
  t('food.macros', { protein: Math.round(macros.proteinG), carbs: Math.round(macros.carbsG), fat: Math.round(macros.fatG) })

/** "pas 20 min", "pas 2 orë 50 min", "para 30 min", "tani" / "in 20 min", "30 min ago", "now". */
export function relativeTime({ t }: Texts, time: string, now: Date) {
  const [hours, minutes] = time.split(':').map(Number)
  const diff = hours * 60 + minutes - (now.getHours() * 60 + now.getMinutes())
  if (diff === 0) return t('food.time.now')
  const span = Math.abs(diff)
  const whole = Math.floor(span / 60)
  const text =
    span < 60
      ? t('food.time.minutes', { minutes: span })
      : span % 60
        ? t('food.time.hoursMinutes', { count: whole, minutes: span % 60 })
        : t('food.time.hours', { count: whole })
  return diff > 0 ? t('food.time.in', { span: text }) : t('food.time.ago', { span: text })
}

/**
 * Gramët e shkruar me dorë, në çdo gjuhë: "12,5" ose "12.5"; mijëshet me hapësirë ("1 200") ose me
 * presje para tri shifrave ("1,200"). Null kur nuk është numër pozitiv.
 */
export function parseGrams(text: string): number | null {
  const compact = text.replace(/[\s ]/g, '')
  const english = /^\d{1,3}(,\d{3})+(\.\d+)?$/.test(compact)
  const normalized = english ? compact.replace(/,/g, '') : compact.replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null
  const value = Number(normalized)
  return value > 0 ? value : null
}

/** Si `parseGrams`, por pranon edhe 0 (makrot e një etikete: "Yndyrë 0 g"). */
export function parseAmount(text: string): number | null {
  return /^0+([.,]0+)?$/.test(text.trim()) ? 0 : parseGrams(text)
}
