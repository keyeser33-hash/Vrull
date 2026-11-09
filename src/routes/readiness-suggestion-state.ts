import type { TodayView } from '@/data/today'

// Gjendja e sugjerimit për pjesët e tjera të Sot (V50, V2-E3-06). Skeleti i valës: e plotëson agjenti i E3-06.
/** Sugjerimi pret vendimin: "Fillo stërvitjen" nuk është veprimi kryesor i ekranit (një prush për ekran). */
export function useSuggestionPending(_view: TodayView): boolean {
  return false
}
