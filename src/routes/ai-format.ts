import type { I18n } from '@/i18n'
import { NBSP } from '@/i18n/format'

// Tekstet e AI-së në të dyja gjuhët (V2-E1-11): shumat në euro, madhësia e skedarit dhe emri i muajit.

type T = I18n['t']
type Fmt = I18n['fmt']

/** Simboli sipas gjuhës (CLDR): pas shumës në shqip ("1,40 €", hapësirë që nuk thyhet), para saj në anglisht ("€1.40"). */
const withEuro = (fmt: Fmt, amount: string) => (fmt.locale === 'sq' ? `${amount}${NBSP}€` : `€${amount}`)

/**
 * "1,40 €" / "€1.40", me `digits` shifra pas presjes (0,001 € për koston e një mesazhi të kutisë). Nën
 * shifrën e fundit "<0,01 €", që një lexim i vogël të mos duket falas.
 */
export function euro(fmt: Fmt, value: number, digits = 2): string {
  const options = { minDigits: digits, maxDigits: digits }
  const smallest = 10 ** -digits
  if (value > 0 && value < smallest / 2) return `<${withEuro(fmt, fmt.number(smallest, options))}`
  return withEuro(fmt, fmt.number(value, options))
}

/** Kufiri si numër i plotë kur është i tillë: "10 €" / "€10". */
export function euroLimit(fmt: Fmt, value: number): string {
  return Number.isInteger(value) ? withEuro(fmt, fmt.number(value)) : euro(fmt, value)
}

/** "2,3 MB", "640 kB". */
export function fileSize(fmt: Fmt, bytes: number): string {
  const mb = bytes / (1024 * 1024)
  if (mb >= 1) return fmt.unit(mb, 'MB', { minDigits: 1, maxDigits: 1 })
  return fmt.unit(Math.max(1, Math.round(bytes / 1024)), 'kB')
}

/** "Nëntori" / "November" nga "2026-11-01". */
export function monthName(t: T, month: string): string {
  return t(`ai.month.${Number(month.slice(5, 7))}` as 'ai.month.1')
}
