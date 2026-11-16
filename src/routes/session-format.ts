import type { SetRecord } from '@/data/training'
import type { Format, I18n, T } from '@/i18n'
import type { Reference } from '@/program/loads'
import type { Target, Tracking } from '@/program/types'

// Tekstet e seancës sipas gjuhës (V2-E1-07): intervali, receta, vlera e setit dhe kohët. Numrat
// vijnë nga `fmt` (62,5 / 62.5); fjalët nga katalogu ('session.*').

type Texts = Pick<I18n, 't' | 'fmt'>

/** "9–11", "20+"; për recetat me një numër: "5", "5+". Null për setet me kohë. */
export function rangeText(target: Target, fmt: Format): string | null {
  switch (target.kind) {
    case 'reps':
      return target.max === null ? `${fmt.number(target.min)}+` : `${fmt.number(target.min)}–${fmt.number(target.max)}`
    case 'percent_1rm':
      return `${fmt.number(target.reps)}${target.amrap ? '+' : ''}`
    case 'linear':
      return fmt.number(target.reps)
    case 'timed':
      return null
  }
}

/** Receta e setit: "9–11 përsëritje", "60 sekonda", "5+ përsëritje me 75%". */
export function targetText(target: Target, { t, fmt }: Texts): string {
  switch (target.kind) {
    case 'reps':
      if (target.min === 0 && target.max === null) return t('session.target.free')
      return t(target.beyond ? 'session.target.rangeBeyond' : 'session.target.range', { range: rangeText(target, fmt)! })
    case 'timed':
      return t('session.target.seconds', { count: target.seconds })
    case 'percent_1rm':
      return t('session.target.percent', { reps: rangeText(target, fmt)!, percent: target.percent })
    case 'linear':
      return t('session.target.reps', { count: target.reps })
  }
}

/** Seti që vjen: "62,5 × 9–11"; pa peshë vetëm receta. */
export function loadText(weightKg: number | null, target: Target, texts: Texts): string {
  const range = rangeText(target, texts.fmt)
  if (!weightKg || range === null || (target.kind === 'reps' && target.min === 0 && target.max === null)) return targetText(target, texts)
  return `${texts.fmt.number(weightKg)} × ${range}`
}

const segmentsText = (set: Pick<SetRecord, 'segments'>, fmt: Format) => set.segments.map((segment) => ` + ${fmt.number(segment.reps)}`).join('')

/** Vlera e një seti të ruajtur: "62,5 × 9 + 3" (me `unit`: "62,5 kg × 9 + 3"), "60 s", "15 përsëritje". */
export function setValue(set: SetRecord, { t, fmt }: Texts, { unit = false }: { unit?: boolean } = {}): string {
  if (set.seconds !== null && set.reps === null) return fmt.unit(set.seconds, 's')
  const reps = set.reps ?? 0
  if (!set.weightKg) {
    return set.segments.length ? `${fmt.number(reps)}${segmentsText(set, fmt)}` : t('session.target.reps', { count: reps })
  }
  return `${unit ? fmt.unit(set.weightKg, 'kg') : fmt.number(set.weightKg)} × ${fmt.number(reps)}${segmentsText(set, fmt)}`
}

/** Vetëm setet me përsëritje ndryshohen te fleta "Ndrysho setin" (pesha, përsëritjet, RIR-i), si te historiku. */
export const editable = (set: Pick<SetRecord, 'reps'>) => set.reps !== null

/** Setet e një ushtrimi te lista: "62,5 kg · 12, 10, 9, 9 + 3"; me pesha të ndryshme "12 × 11, 14 × 9". */
export function setsDetail(sets: SetRecord[], texts: Texts): string {
  const { fmt } = texts
  if (sets.every((set) => set.seconds !== null && set.reps === null)) return sets.map((set) => fmt.unit(set.seconds!, 's')).join(', ')
  const weights = new Set(sets.map((set) => set.weightKg ?? 0))
  const [weight] = weights
  if (weights.size === 1) {
    const reps = sets.map((set) => `${fmt.number(set.reps ?? 0)}${segmentsText(set, fmt)}`).join(', ')
    return weight ? `${fmt.unit(weight, 'kg')} · ${reps}` : reps
  }
  return sets.map((set) => setValue(set, texts)).join(', ')
}

const pad = (value: number) => String(value).padStart(2, '0')

/** Koha e seancës te kreu: "06:10", "1:06:10". */
export function elapsedText(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds % 60)}` : `${pad(minutes)}:${pad(seconds % 60)}`
}

/** Koha me fjalë për lexuesin e ekranit: "1 minutë e 15 sekonda", "1 orë e 6 minuta". */
export function spokenDuration(totalSeconds: number, t: T): string {
  const seconds = Math.max(0, Math.round(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const parts =
    hours > 0
      ? [t('session.spoken.hours', { count: hours }), minutes > 0 ? t('session.spoken.minutes', { count: minutes }) : null]
      : [minutes > 0 ? t('session.spoken.minutes', { count: minutes }) : null, seconds % 60 > 0 || minutes === 0 ? t('session.spoken.seconds', { count: seconds % 60 }) : null]
  const [first, second] = parts.filter((part): part is string => part !== null)
  return second ? t('session.spoken.join', { first, second }) : first
}

/** "62,5 × 9", "9" pa peshë, "60 s"; null pa referencë. */
export function previousText(previous: Reference | null, tracking: Tracking, fmt: Format): string | null {
  if (!previous) return null
  if (tracking === 'timed') return previous.reps === null ? null : fmt.number(previous.reps)
  if (previous.reps === null) return null
  return previous.weightKg ? `${fmt.number(previous.weightKg)} × ${fmt.number(previous.reps)}` : fmt.number(previous.reps)
}

/** Synimi i një seti që vjen: "6–8", "12+", "60 s"; përsëritjet e lira me vizë. */
export function targetShort(target: Target, fmt: Format) {
  if (target.kind === 'timed') return fmt.unit(target.seconds, 's')
  if (target.kind === 'reps' && target.min === 0 && target.max === null) return '–'
  return rangeText(target, fmt) ?? '–'
}
