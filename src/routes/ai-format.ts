import type { I18n } from '@/i18n'

// Tekstet e AI-së në të dyja gjuhët (V2-E1-11): shumat në euro, madhësia e skedarit dhe emri i muajit.

type T = I18n['t']
type Fmt = I18n['fmt']

/** "€1,40" / "€1.40"; nën një cent "<€0,01", që një lexim i vogël të mos duket falas. */
export function euro(fmt: Fmt, value: number): string {
  const cents = { minDigits: 2, maxDigits: 2 }
  if (value > 0 && value < 0.005) return `<€${fmt.number(0.01, cents)}`
  return `€${fmt.number(value, cents)}`
}

/** Kufiri si numër i plotë kur është i tillë: "€10". */
export function euroLimit(fmt: Fmt, value: number): string {
  return Number.isInteger(value) ? `€${fmt.number(value)}` : euro(fmt, value)
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
