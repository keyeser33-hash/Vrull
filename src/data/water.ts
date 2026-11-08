import { GLASS_ML, waterTargetMl } from '@/nutrition/water'
import { dayBasics } from './nutrition'
import type { LocalStore } from './store'

// Uji i ditës (V36, V2-E2-07): një gotë me një prekje te Sot, "Kthe mbrapsht" heq të fundit.
// Rreshtat: `water_logs` (ml dhe ora), të sinkronizuar.

export interface WaterDay {
  date: string
  totalMl: number
  /** Null pa peshë. */
  targetMl: number | null
  /** Rreshti i fundit i ditës, për "Kthe mbrapsht". */
  lastId: string | null
}

export async function waterDay(store: LocalStore, date: string): Promise<WaterDay> {
  const [rows, { dayType, weightKg }] = await Promise.all([store.where('water_logs', 'date', date), dayBasics(store, date)])
  const sorted = [...rows].sort((a, b) => String(a.logged_at).localeCompare(String(b.logged_at)))
  return {
    date,
    totalMl: sorted.reduce((total, row) => total + Number(row.ml ?? 0), 0),
    targetMl: weightKg === null ? null : waterTargetMl(weightKg, dayType),
    lastId: sorted.at(-1)?.id ?? null,
  }
}

/** Shton një gotë (ose sasinë e dhënë) dhe kthen id-në e rreshtit. */
export async function addWater(store: LocalStore, date: string, at: Date = new Date(), ml = GLASS_ML): Promise<string> {
  const row = await store.put('water_logs', { date, ml, logged_at: at.toISOString() })
  return row.id
}

export async function undoWater(store: LocalStore, id: string) {
  await store.remove('water_logs', id)
}
