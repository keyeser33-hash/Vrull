import type { DayMode } from '@/readiness/readiness'
import { readinessView } from './readiness-view'
import type { LocalStore } from './store'

/** Pamja e ditës sot (gatishmëria dhe çelësi "Pamja ndjek gjendjen"); `normal` pa check-in. */
export async function dayModeNow(store: LocalStore): Promise<DayMode> {
  return (await readinessView(store)).mode
}
